import express from "express";
import Stripe from "stripe";
import admin from "firebase-admin";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";

dotenv.config();

const app = express();

const isVercel = Boolean(process.env.VERCEL);

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("ERROR: STRIPE_SECRET_KEY environment variable is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// Initialize Firebase Admin
let projectId = process.env.FIREBASE_PROJECT_ID;
let storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log("Initializing Firebase Admin with environment variable...");
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    projectId = projectId || serviceAccount.project_id;
    storageBucket = storageBucket || serviceAccount.storage_bucket;
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
      storageBucket:
        storageBucket ||
        (projectId ? `${projectId}.appspot.com` : undefined),
    });
  } else {
    if (isVercel) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT is required on Vercel (do not use local serviceAccountKey.json in production)."
      );
    }
    console.log("Initializing Firebase Admin with local file...");
    admin.initializeApp({
      credential: admin.credential.cert("./serviceAccountKey.json"),
      projectId,
      storageBucket:
        storageBucket ||
        (projectId ? `${projectId}.appspot.com` : undefined),
    });
  }
  console.log("Firebase Admin initialized successfully", {
    projectId: admin.app().options.projectId,
    storageBucket: admin.app().options.storageBucket,
  });
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error);
  throw error;
}

const db = admin.firestore();

// --- Billing storage (single source of truth) ---
// Canonical billing doc: organizations/{orgId}/private/billing
const billingDocPath = (orgId) => `organizations/${orgId}/private/billing`;
const billingDocRef = (orgId) => db.doc(billingDocPath(orgId));

function nowIso() {
  return new Date().toISOString();
}

function addDaysIso(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Reads billing doc (single source of truth). */
async function readBilling(orgId) {
  const snap = await billingDocRef(orgId).get();
  if (snap.exists) return snap.data() || {};
  return { plan: "free", status: "active", propertyLimit: 2, seatLimit: 1 };
}

async function writeBilling(orgId, data) {
  await billingDocRef(orgId).set({ ...data, updatedAt: nowIso() }, { merge: true });
}

async function setOrgPlan(orgId, plan) {
  await writeBilling(orgId, { plan });
}

/**
 * Checks if billing allows access.
 * Returns: { allowed: boolean, reason?: string, graceUntil?: string }
 */
function isBillingAllowed(billing) {
  const status = billing.status || "active";
  const graceUntil = billing.graceUntil;
  const now = new Date().toISOString();

  // Active/trialing => allowed
  if (status === "active" || status === "trialing") {
    return { allowed: true };
  }

  // Canceled => blocked
  if (status === "canceled") {
    return { allowed: false, reason: "Subscription canceled" };
  }

  // past_due/unpaid => check grace period
  if (status === "past_due" || status === "unpaid") {
    if (graceUntil && now <= graceUntil) {
      return { allowed: true, reason: "Grace period active", graceUntil };
    }
    return { allowed: false, reason: "Payment overdue", graceUntil };
  }

  // Unknown status => blocked
  return { allowed: false, reason: "Unknown billing status" };
}

const bucket = admin.storage().bucket();

// Multipart uploads (PDFs)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
});

// --- Auth helpers (Firebase ID token) ---
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing Bearer token" });
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email || null, claims: decoded };
    next();
  } catch (err) {
    console.error("[auth] verifyIdToken failed", err?.message || err);
    return res.status(401).json({ error: "Invalid token" });
  }
}

async function getUserDoc(uid) {
  const snap = await db.collection("users").doc(uid).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

function pickOrgId(userDoc) {
  return userDoc?.organizationId || userDoc?.orgId || null;
}

async function requireOrg(req, res, next) {
  try {
    if (!req.user || !req.user.uid) {
      console.error("[org] No user in request");
      return res.status(401).json({ error: "Unauthorized" });
    }
    let u = await getUserDoc(req.user.uid);

    // Defensive recovery: if the user doc is missing for this UID, try to recover by email.
    // This prevents accidental "new org" creation flows on refresh/re-login.
    if (!u && req.user.email) {
      console.log("🔍 [requireOrg] User doc missing for UID:", req.user.uid, "- searching by email:", req.user.email);
      const byEmailSnap = await db
        .collection("users")
        .where("email", "==", req.user.email)
        .limit(1)
        .get();

      if (!byEmailSnap.empty) {
        const prev = { id: byEmailSnap.docs[0].id, ...byEmailSnap.docs[0].data() };
        const prevOrgId = pickOrgId(prev);
        if (prevOrgId) {
          console.log("✅ [requireOrg] RECOVERED! Found previous orgId:", prevOrgId, "for email:", req.user.email);
          const recoveredDoc = {
            ...prev,
            orgId: prevOrgId,
            organizationId: prevOrgId,
            updatedAt: nowIso(),
          };
          // Do not carry over the old document id field into Firestore.
          delete recoveredDoc.id;
          await db.collection("users").doc(req.user.uid).set(recoveredDoc, { merge: true });
          u = await getUserDoc(req.user.uid);
          console.log("✅ [requireOrg] User doc restored for UID:", req.user.uid);
        } else {
          console.warn("⚠️ [requireOrg] Found user by email but no orgId in previous doc");
        }
      } else {
        console.warn("⚠️ [requireOrg] No previous user found by email:", req.user.email);
      }
    }

    if (!u) return res.status(403).json({ error: "User profile not initialized" });
    const orgId = pickOrgId(u);
    if (!orgId) return res.status(403).json({ error: "User has no organizationId" });
    req.userDoc = u;
    req.orgId = orgId;
    next();
  } catch (err) {
    console.error("[org] failed", err);
    return res.status(500).json({ error: "Failed to load user org" });
  }
}

function requireAdmin(req, res, next) {
  const role = req.userDoc?.role;
  if (role === "admin") return next();
  return res.status(403).json({ error: "admin only" });
}

/** Middleware: check billing status and block if not allowed */
async function requireBillingOk(req, res, next) {
  try {
    const orgId = req.orgId;
    if (!orgId) return res.status(403).json({ error: "No organization" });

    const billing = await readBilling(orgId);
    const verdict = isBillingAllowed(billing);

    req.billing = billing;
    req.billingVerdict = verdict;

    if (!verdict.allowed) {
      return res.status(403).json({
        error: "billing_blocked",
        status: billing.status,
        reason: verdict.reason,
        graceUntil: verdict.graceUntil,
        message: verdict.reason || "Billing issue detected",
      });
    }

    next();
  } catch (err) {
    console.error("[billing] check failed", err);
    return res.status(500).json({ error: "Failed to verify billing" });
  }
}

// CORS configuration - allow multiple origins (comma-separated FRONTEND_URL supported)
const envOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:5173",
  ...envOrigins,
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/** Map Stripe priceId -> plan + limits */
function mapPrice(priceId) {
  if (!priceId) return { plan: "free", propertyLimit: 2, seatLimit: 1 };

  if (priceId === "price_1SRy7v1Ooy6ryYPn2mc6FKfu") {
    return { plan: "solo", propertyLimit: 10, seatLimit: 1 };
  }
  if (priceId === "price_1SRyIm1Ooy6ryYPnczGBTB7g") {
    return { plan: "pro", propertyLimit: 50, seatLimit: 3 };
  }
  if (priceId === "price_1SRyMA1Ooy6ryYPnzPLHOkWt") {
    return { plan: "agency", propertyLimit: 200, seatLimit: 10 };
  }

  return { plan: "free", propertyLimit: 2, seatLimit: 1 };
}

// Health check
app.get("/", (req, res) => {
  const healthCheck = {
    status: "ok",
    message: "Billing API is running",
    environment: {
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
      hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      hasFirebaseAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      hasFrontendUrl: !!process.env.FRONTEND_URL,
    },
    timestamp: new Date().toISOString(),
  };
  res.json(healthCheck);
});

// Stripe webhook (must be BEFORE express.json() to get raw body)
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const customerId = session.customer;
      if (!session.subscription) return res.status(200).send("OK");

      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0].price.id;
      const status = subscription.status;

      const customer = await stripe.customers.retrieve(customerId);
      const orgId = customer.metadata?.orgId;

      if (orgId) {
        const limits = mapPrice(priceId);
        await writeBilling(orgId, {
          plan: limits.plan,
          status,
          priceId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          propertyLimit: limits.propertyLimit,
          seatLimit: limits.seatLimit,
        });
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
      const sub = event.data.object;
      const priceId = sub.items.data[0].price.id;
      const status = sub.status;

      const customer = await stripe.customers.retrieve(sub.customer);
      const orgId = customer.metadata?.orgId;

      if (orgId) {
        const limits = mapPrice(priceId);
        await writeBilling(orgId, {
          plan: limits.plan,
          status,
          priceId,
          stripeCustomerId: sub.customer,
          stripeSubscriptionId: sub.id,
          propertyLimit: limits.propertyLimit,
          seatLimit: limits.seatLimit,
        });
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const customer = await stripe.customers.retrieve(sub.customer);
      const orgId = customer.metadata?.orgId;
      if (orgId) {
        await writeBilling(orgId, { plan: "free", status: "canceled" });
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const customer = await stripe.customers.retrieve(invoice.customer);
      const orgId = customer.metadata?.orgId;

      if (orgId) {
        let priceId = null;
        let status = "past_due";

        if (invoice.subscription) {
          const subId =
            typeof invoice.subscription === "string"
              ? invoice.subscription
              : invoice.subscription.id;

          const sub = await stripe.subscriptions.retrieve(subId);
          priceId = sub.items?.data?.[0]?.price?.id || null;
          status = sub.status || status;
        }

        const limits = mapPrice(priceId);
        const graceUntil = addDaysIso(nowIso(), 7);

        await writeBilling(orgId, {
          plan: limits.plan,
          status,
          priceId,
          stripeCustomerId: invoice.customer,
          stripeSubscriptionId: invoice.subscription || null,
          lastInvoiceId: invoice.id,
          lastInvoiceStatus: invoice.status || null,
          lastPaymentError: invoice.last_payment_error?.message || null,
          propertyLimit: limits.propertyLimit,
          seatLimit: limits.seatLimit,
          graceUntil,
        });
      }
    }

    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object;
      const customer = await stripe.customers.retrieve(invoice.customer);
      const orgId = customer.metadata?.orgId;

      if (orgId && invoice.subscription) {
        const subId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription.id;

        const sub = await stripe.subscriptions.retrieve(subId);
        const priceId = sub.items?.data?.[0]?.price?.id || null;
        const limits = mapPrice(priceId);

        await writeBilling(orgId, {
          plan: limits.plan,
          status: sub.status,
          priceId,
          stripeCustomerId: invoice.customer,
          stripeSubscriptionId: sub.id,
          lastInvoiceId: invoice.id,
          lastInvoiceStatus: invoice.status || null,
          lastPaymentError: null,
          propertyLimit: limits.propertyLimit,
          seatLimit: limits.seatLimit,
          graceUntil: null,
        });
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).send("Webhook processing failed");
  }
});

// Apply JSON parser for all other routes
app.use(express.json());

/**
 * ✅ FIXED: Create checkout session (AUTH REQUIRED)
 * - orgId comes from logged-in user (req.orgId), NOT from the body.
 */
app.post("/checkout", requireAuth, requireOrg, async (req, res) => {
  console.log("📥 Checkout request received:", req.body);
  try {
    const { priceId, successUrl, cancelUrl } = req.body || {};
    const orgId = req.orgId;

    if (!orgId) return res.status(400).json({ error: "Missing orgId (from user profile)" });
    if (!priceId) return res.status(400).json({ error: "priceId is required" });

    const billing = await readBilling(orgId);
    let customerId = billing.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({ metadata: { orgId } });
      customerId = customer.id;
      await writeBilling(orgId, { stripeCustomerId: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer: customerId,
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      metadata: { orgId, priceId },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("❌ Error creating checkout session:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ✅ FIXED + SECURED:
 * Check checkout session status (AUTH REQUIRED)
 * - ensures the session orgId matches req.orgId
 */
app.get("/check-session/:sessionId", requireAuth, requireOrg, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    const sessionOrgId = session.metadata?.orgId;
    if (!sessionOrgId || sessionOrgId !== req.orgId) {
      return res.status(403).json({ error: "forbidden" });
    }

    if (session.payment_status === "paid" && session.subscription) {
      const subscription =
        typeof session.subscription === "string"
          ? await stripe.subscriptions.retrieve(session.subscription)
          : session.subscription;

      const priceId = subscription.items.data[0].price.id;
      const limits = mapPrice(priceId);

      await writeBilling(req.orgId, {
        plan: limits.plan,
        status: subscription.status,
        priceId,
        stripeCustomerId: session.customer,
        stripeSubscriptionId: subscription.id,
        propertyLimit: limits.propertyLimit,
        seatLimit: limits.seatLimit,
      });

      return res.json({
        success: true,
        paid: true,
        plan: limits.plan,
        status: subscription.status,
      });
    }

    return res.json({
      success: true,
      paid: false,
      payment_status: session.payment_status,
    });
  } catch (error) {
    console.error("❌ Error checking session:", error);
    res.status(500).json({ error: error.message });
  }
});

// Catalog of collections for delete helper
const relatedCollections = Object.freeze([
  "leases",
  "loans",
  "rooms",
  "recurringExpenses",
  "oneOffExpenses",
  "propertyDocs",
  "dealScenarios",
]);

// Bootstrap user profile + organization (signup/init)
// IMPORTANT: This endpoint must be idempotent.
// We also try to *re-attach* a user to an existing organization if we can find it by email.
// This prevents the "everything disappeared" experience when a user's UID changes (provider linking,
// deleting/re-creating the auth user, etc.) or when the user doc was accidentally removed.
app.post("/api/bootstrap", requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const email = req.user.email;
    const body = req.body || {};

    // 1) If profile exists for this UID, just return it.
    const existing = await getUserDoc(uid);
    if (existing) return res.json({ user: existing, orgId: pickOrgId(existing) });

    // 2) Defensive recovery: if profile for this UID does NOT exist, try to find a prior profile by email.
    // This covers cases where the Firebase Auth UID changed between sessions.
    if (email) {
      console.log("🔍 [BOOTSTRAP] No user doc for UID, searching by email:", email);
      const byEmailSnap = await db
        .collection("users")
        .where("email", "==", email)
        .limit(1)
        .get();

      if (!byEmailSnap.empty) {
        const prev = { id: byEmailSnap.docs[0].id, ...byEmailSnap.docs[0].data() };
        const prevOrgId = pickOrgId(prev);

        if (prevOrgId) {
          console.log("✅ [BOOTSTRAP] RECOVERED! Re-using existing orgId:", prevOrgId, "for email:", email);
          const profile =
            body.profile && typeof body.profile === "object" ? body.profile : {};
          const userDoc = {
            email,
            ...profile,
            // keep previous role if present; default to admin
            role: prev.role || "admin",
            orgId: prevOrgId,
            organizationId: prevOrgId,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          };

          await db.collection("users").doc(uid).set(userDoc);
          console.log("✅ [BOOTSTRAP] User doc created with recovered orgId for UID:", uid);
          return res.json({ user: { id: uid, ...userDoc }, orgId: prevOrgId, recovered: true });
        } else {
          console.warn("⚠️ [BOOTSTRAP] Found user by email but no orgId in previous doc");
        }
      } else {
        console.log("ℹ️ [BOOTSTRAP] No previous user found by email - will create new org");
      }
    }

    const orgName = body.orgName || "Mi organización";
    const orgRef = db.collection("organizations").doc();
    const orgId = orgRef.id;

    await orgRef.set({
      name: orgName,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    await writeBilling(orgId, {
      plan: "free",
      status: "active",
      propertyLimit: 2,
      seatLimit: 1,
    });

    const profile =
      body.profile && typeof body.profile === "object" ? body.profile : {};
    const userDoc = {
      email: email || body.email || null,
      ...profile,
      role: "admin",
      orgId,
      organizationId: orgId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await db.collection("users").doc(uid).set(userDoc);

    return res.json({ user: { id: uid, ...userDoc }, orgId });
  } catch (err) {
    console.error("[bootstrap] failed", err);
    return res.status(500).json({ error: "bootstrap failed" });
  }
});

// Current user profile
app.get("/api/me", requireAuth, requireOrg, async (req, res) => {
  return res.json({
    uid: req.user.uid,
    email: req.user.email,
    orgId: req.orgId,
    user: req.userDoc,
  });
});

// Organization limits / billing status
app.get("/api/org/limits", requireAuth, requireOrg, async (req, res) => {
  try {
    const data = await readBilling(req.orgId);
    return res.json({ orgId: req.orgId, ...data });
  } catch (err) {
    console.error("[org/limits] failed", err);
    return res.status(500).json({ error: "failed to read org limits" });
  }
});

// Billing portal
app.post("/api/billing/portal", requireAuth, requireOrg, async (req, res) => {
  try {
    const billing = await readBilling(req.orgId);
    const customerId = billing.stripeCustomerId;

    if (!customerId) {
      return res.status(400).json({ error: "No Stripe customer found" });
    }

    const returnUrl =
      req.body?.returnUrl ||
      (envOrigins[0] || "http://localhost:5173");

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("[billing/portal] failed", err);
    return res.status(500).json({ error: "Failed to create portal session" });
  }
});

// Get invoices for current organization
app.get("/api/invoices", requireAuth, requireOrg, async (req, res) => {
  try {
    const billing = await readBilling(req.orgId);
    const customerId = billing.stripeCustomerId;

    if (!customerId) {
      return res.json({ invoices: [] });
    }

    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 100,
    });

    const formattedInvoices = invoices.data.map(invoice => ({
      id: invoice.id,
      number: invoice.number,
      amount: invoice.amount_paid / 100, // Convert from cents to euros
      currency: invoice.currency,
      status: invoice.status,
      created: invoice.created,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
    }));

    res.json({ invoices: formattedInvoices });
  } catch (err) {
    console.error("[invoices] list failed", err);
    return res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

// Users in current org (for seats / sharing)
app.get("/api/users", requireAuth, requireOrg, async (req, res) => {
  try {
    const orgId = req.orgId;
    const [byOrgIdSnap, byOrganizationIdSnap] = await Promise.all([
      db.collection("users").where("orgId", "==", orgId).get(),
      db.collection("users").where("organizationId", "==", orgId).get(),
    ]);
    const map = new Map();
    for (const d of [...byOrgIdSnap.docs, ...byOrganizationIdSnap.docs]) {
      map.set(d.id, { id: d.id, ...d.data() });
    }
    res.json({ users: Array.from(map.values()) });
  } catch (err) {
    console.error("[users] list failed", err);
    res.status(500).json({ error: "failed to list users" });
  }
});

// Admin actions (role/plan/user delete)
app.put("/api/users/:uid/role", requireAuth, requireOrg, requireAdmin, async (req, res) => {
  try {
    const uid = req.params.uid;
    const role = req.body?.role;
    if (!role) return res.status(400).json({ error: "missing role" });
    const ref = db.collection("users").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "user not found" });
    const orgId = pickOrgId({ id: uid, ...snap.data() });
    if (orgId !== req.orgId) return res.status(403).json({ error: "forbidden" });
    await ref.set({ role, updatedAt: nowIso() }, { merge: true });
    const updated = await ref.get();
    res.json({ user: { id: uid, ...updated.data() } });
  } catch (err) {
    console.error("[users] role update failed", err);
    res.status(500).json({ error: "failed to update role" });
  }
});

app.put("/api/orgs/:orgId/plan", requireAuth, requireOrg, requireAdmin, async (req, res) => {
  try {
    const orgId = req.params.orgId;
    if (orgId !== req.orgId) return res.status(403).json({ error: "forbidden" });
    const plan = req.body?.plan;
    if (!plan) return res.status(400).json({ error: "missing plan" });

    await setOrgPlan(orgId, plan);
    const billing = await readBilling(orgId);
    return res.json({ orgId, billing });
  } catch (err) {
    console.error("[orgs] plan update failed", err);
    return res.status(500).json({ error: "failed to update plan" });
  }
});

app.delete("/api/users/:uid", requireAuth, requireOrg, requireAdmin, async (req, res) => {
  try {
    const uid = req.params.uid;
    if (uid === req.user.uid) return res.status(400).json({ error: "cannot delete self" });
    const ref = db.collection("users").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "user not found" });
    const orgId = pickOrgId({ id: uid, ...snap.data() });
    if (orgId !== req.orgId) return res.status(403).json({ error: "forbidden" });
    await ref.delete();
    try { await admin.auth().deleteUser(uid); } catch (_) {}
    res.json({ success: true });
  } catch (err) {
    console.error("[users] delete failed", err);
    res.status(500).json({ error: "failed to delete user" });
  }
});

// Properties (PROTECTED)
app.get("/api/properties", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const snap = await db.collection("properties").where("organizationId", "==", req.orgId).get();
    res.json({ properties: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (err) {
    console.error("[properties] list failed", err);
    res.status(500).json({ error: "failed to list properties" });
  }
});

app.post("/api/properties", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const payload = req.body || {};
    payload.organizationId = req.orgId;
    const ref = db.collection("properties").doc();
    await ref.set({ ...payload, createdAt: nowIso(), updatedAt: nowIso() });
    const snap = await ref.get();
    res.json({ property: { id: ref.id, ...snap.data() } });
  } catch (err) {
    console.error("[properties] create failed", err);
    res.status(500).json({ error: "failed to create property" });
  }
});

app.put("/api/properties/:id", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const ref = db.collection("properties").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "property not found" });
    const data = snap.data();
    if (data.organizationId !== req.orgId) return res.status(403).json({ error: "forbidden" });
    const payload = req.body || {};
    delete payload.organizationId;
    await ref.set({ ...payload, updatedAt: nowIso() }, { merge: true });
    const updated = await ref.get();
    res.json({ property: { id: ref.id, ...updated.data() } });
  } catch (err) {
    console.error("[properties] update failed", err);
    res.status(500).json({ error: "failed to update property" });
  }
});

app.delete("/api/properties/:id", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const id = req.params.id;
    const ref = db.collection("properties").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "property not found" });
    const orgId = snap.data().organizationId;
    if (orgId !== req.orgId) return res.status(403).json({ error: "forbidden" });

    const batch = db.batch();
    batch.delete(ref);

    for (const col of relatedCollections) {
      const relSnap = await db.collection(col).where("organizationId", "==", orgId).get();
      relSnap.docs
        .filter(d => d.data().propertyId === id)
        .forEach(d => batch.delete(d.ref));
    }

    await batch.commit();
    res.json({ success: true });
  } catch (err) {
    console.error("[properties] delete failed", err);
    res.status(500).json({ error: "failed to delete property" });
  }
});

// Dashboard (PROTECTED)
app.get("/api/dashboard", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const orgId = req.orgId;
    const [propsSnap, leasesSnap, loansSnap, recurringSnap, oneOffSnap, roomsSnap] =
      await Promise.all([
        db.collection("properties").where("organizationId", "==", orgId).get(),
        db.collection("leases").where("organizationId", "==", orgId).get(),
        db.collection("loans").where("organizationId", "==", orgId).get(),
        db.collection("recurringExpenses").where("organizationId", "==", orgId).get(),
        db.collection("oneOffExpenses").where("organizationId", "==", orgId).get(),
        db.collection("rooms").where("organizationId", "==", orgId).get(),
      ]);

    res.json({
      properties: propsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      leases: leasesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      loans: loansSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      recurringExpenses: recurringSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      oneOffExpenses: oneOffSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      rooms: roomsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    });
  } catch (err) {
    console.error("[dashboard] failed", err);
    res.status(500).json({ error: "failed to load dashboard" });
  }
});

// Generic collection CRUD (PROTECTED)
app.get("/api/:collection", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const col = req.params.collection;
    if (!relatedCollections.includes(col)) {
      return res.status(400).json({ error: "unknown collection" });
    }
    const snap = await db.collection(col).where("organizationId", "==", req.orgId).get();
    res.json({ [col]: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (err) {
    console.error(`[${req.params.collection}] list failed`, err);
    res.status(500).json({ error: `failed to list ${req.params.collection}` });
  }
});

app.post("/api/:collection", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const col = req.params.collection;
    if (!relatedCollections.includes(col)) {
      return res.status(400).json({ error: "unknown collection" });
    }
    const payload = req.body || {};
    payload.organizationId = req.orgId;
    const ref = db.collection(col).doc();
    await ref.set({ ...payload, createdAt: nowIso(), updatedAt: nowIso() });
    const snap = await ref.get();
    res.json({ [col.slice(0, -1)]: { id: ref.id, ...snap.data() } });
  } catch (err) {
    console.error(`[${req.params.collection}] create failed`, err);
    res.status(500).json({ error: `failed to create ${req.params.collection}` });
  }
});

app.put("/api/:collection/:id", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const col = req.params.collection;
    if (!relatedCollections.includes(col)) {
      return res.status(400).json({ error: "unknown collection" });
    }
    const ref = db.collection(col).doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "not found" });
    if (snap.data().organizationId !== req.orgId) return res.status(403).json({ error: "forbidden" });
    const payload = req.body || {};
    delete payload.organizationId;
    await ref.set({ ...payload, updatedAt: nowIso() }, { merge: true });
    const updated = await ref.get();
    res.json({ [col.slice(0, -1)]: { id: ref.id, ...updated.data() } });
  } catch (err) {
    console.error(`[${req.params.collection}] update failed`, err);
    res.status(500).json({ error: `failed to update ${req.params.collection}` });
  }
});

app.delete("/api/:collection/:id", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const col = req.params.collection;
    if (!relatedCollections.includes(col)) {
      return res.status(400).json({ error: "unknown collection" });
    }
    const ref = db.collection(col).doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "not found" });
    if (snap.data().organizationId !== req.orgId) return res.status(403).json({ error: "forbidden" });
    await ref.delete();
    res.json({ success: true });
  } catch (err) {
    console.error(`[${req.params.collection}] delete failed`, err);
    res.status(500).json({ error: `failed to delete ${req.params.collection}` });
  }
});

// Generic collection CRUD with /collection prefix (for frontend compatibility)
app.get("/api/collection/:collection", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const col = req.params.collection;
    if (!relatedCollections.includes(col)) {
      return res.status(400).json({ error: "unknown collection" });
    }

    const propertyId = req.query.propertyId;
    let query = db.collection(col).where("organizationId", "==", req.orgId);

    if (propertyId) {
      query = query.where("propertyId", "==", propertyId);
    }

    const snap = await query.get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ items });
  } catch (err) {
    console.error(`[collection/${req.params.collection}] list failed`, err);
    res.status(500).json({ error: `failed to list ${req.params.collection}` });
  }
});

app.post("/api/collection/:collection", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const col = req.params.collection;
    if (!relatedCollections.includes(col)) {
      return res.status(400).json({ error: "unknown collection" });
    }
    const payload = req.body || {};
    payload.organizationId = req.orgId;
    const ref = db.collection(col).doc();
    await ref.set({ ...payload, createdAt: nowIso(), updatedAt: nowIso() });
    const snap = await ref.get();
    res.json({ item: { id: ref.id, ...snap.data() } });
  } catch (err) {
    console.error(`[collection/${req.params.collection}] create failed`, err);
    res.status(500).json({ error: `failed to create ${req.params.collection}` });
  }
});

app.put("/api/collection/:collection/:id", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const col = req.params.collection;
    if (!relatedCollections.includes(col)) {
      return res.status(400).json({ error: "unknown collection" });
    }
    const ref = db.collection(col).doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "not found" });
    if (snap.data().organizationId !== req.orgId) return res.status(403).json({ error: "forbidden" });
    const payload = req.body || {};
    delete payload.organizationId;
    await ref.set({ ...payload, updatedAt: nowIso() }, { merge: true });
    const updated = await ref.get();
    res.json({ item: { id: ref.id, ...updated.data() } });
  } catch (err) {
    console.error(`[collection/${req.params.collection}] update failed`, err);
    res.status(500).json({ error: `failed to update ${req.params.collection}` });
  }
});

app.delete("/api/collection/:collection/:id", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const col = req.params.collection;
    if (!relatedCollections.includes(col)) {
      return res.status(400).json({ error: "unknown collection" });
    }
    const ref = db.collection(col).doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "not found" });
    if (snap.data().organizationId !== req.orgId) return res.status(403).json({ error: "forbidden" });
    await ref.delete();
    res.json({ success: true });
  } catch (err) {
    console.error(`[collection/${req.params.collection}] delete failed`, err);
    res.status(500).json({ error: `failed to delete ${req.params.collection}` });
  }
});

// Property docs upload (PROTECTED)
app.post("/api/propertyDocs/upload", requireAuth, requireOrg, requireBillingOk, upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const { propertyId, name } = req.body;
    if (!propertyId) return res.status(400).json({ error: "propertyId required" });

    const propSnap = await db.collection("properties").doc(propertyId).get();
    if (!propSnap.exists) return res.status(404).json({ error: "property not found" });
    if (propSnap.data().organizationId !== req.orgId) return res.status(403).json({ error: "forbidden" });

    const docRef = db.collection("propertyDocs").doc();
    const docId = docRef.id;
    const safeName = (name || file.originalname || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `organizations/${req.orgId}/properties/${propertyId}/docs/${docId}_${safeName}`;

    const gcsFile = bucket.file(storagePath);
    await gcsFile.save(file.buffer, {
      contentType: file.mimetype,
      resumable: false,
      metadata: { cacheControl: "public, max-age=3600" },
    });

    await gcsFile.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    await docRef.set({
      organizationId: req.orgId,
      propertyId,
      name: safeName,
      url: publicUrl,
      storagePath,
      contentType: file.mimetype,
      size: file.size,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    const snap = await docRef.get();
    res.json({ doc: { id: docId, ...snap.data() } });
  } catch (err) {
    console.error("[propertyDocs/upload] failed", err);
    res.status(500).json({ error: "failed to upload doc" });
  }
});

// Capex upload (PROTECTED)
app.post("/api/capex/upload", requireAuth, requireOrg, requireBillingOk, upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const { propertyId, name } = req.body;
    if (!propertyId) return res.status(400).json({ error: "propertyId required" });

    const propSnap = await db.collection("properties").doc(propertyId).get();
    if (!propSnap.exists) return res.status(404).json({ error: "property not found" });
    if (propSnap.data().organizationId !== req.orgId) {
      return res.status(403).json({ error: "forbidden - property does not belong to organization" });
    }

    const timestamp = Date.now();
    const safeName = (name || file.originalname || "attachment").replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `organizations/${req.orgId}/properties/${propertyId}/capex/${timestamp}_${safeName}`;

    const gcsFile = bucket.file(storagePath);
    await gcsFile.save(file.buffer, {
      contentType: file.mimetype,
      resumable: false,
      metadata: { cacheControl: "public, max-age=3600" },
    });

    await gcsFile.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    res.json({
      success: true,
      url: publicUrl,
      storagePath,
      contentType: file.mimetype,
      size: file.size,
    });
  } catch (err) {
    console.error("[capex/upload] failed", err);
    res.status(500).json({ error: "failed to upload capex file" });
  }
});

// // TEST ENDPOINT - Remove in production
// app.post("/test-update-plan", express.json(), async (req, res) => {
//   try {
//     const { orgId, plan } = req.body;
//     console.log("🧪 Test endpoint - updating plan:", { orgId, plan });

//     const limits = mapPrice(
//       plan === "solo" ? "price_1SRy7v1Ooy6ryYPn2mc6FKfu" :
//       plan === "pro" ? "price_1SRyIm1Ooy6ryYPnczGBTB7g" :
//       plan === "agency" ? "price_1SRyMA1Ooy6ryYPnzPLHOkWt" : null
//     );

//     await writeBilling(orgId, {
//       plan: limits.plan,
//       status: "active",
//       propertyLimit: limits.propertyLimit,
//       seatLimit: limits.seatLimit,
//     });

//     console.log("✅ Plan updated successfully");
//     res.json({ success: true, limits });
//   } catch (error) {
//     console.error("❌ Error updating plan:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // TEST ENDPOINT - Simulate payment failure with grace period
// app.post("/test-payment-failed", express.json(), async (req, res) => {
//   try {
//     const { orgId, graceDays = 7 } = req.body;
//     console.log("🧪 Test endpoint - simulating payment failure:", { orgId, graceDays });

//     const billing = await readBilling(orgId);
//     const graceUntil = addDaysIso(nowIso(), graceDays);

//     await writeBilling(orgId, {
//       ...billing,
//       status: "past_due",
//       graceUntil,
//       lastPaymentError: "Test payment failure - card declined",
//     });

//     console.log("✅ Payment failure simulated with grace until:", graceUntil);
//     res.json({
//       success: true,
//       status: "past_due",
//       graceUntil,
//       message: `Grace period set for ${graceDays} days`
//     });
//   } catch (error) {
//     console.error("❌ Error simulating payment failure:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // TEST ENDPOINT - Simulate expired grace period (blocked)
// app.post("/test-grace-expired", express.json(), async (req, res) => {
//   try {
//     const { orgId } = req.body;
//     console.log("🧪 Test endpoint - simulating expired grace period:", { orgId });

//     const billing = await readBilling(orgId);
//     const expiredDate = addDaysIso(nowIso(), -1); // Yesterday

//     await writeBilling(orgId, {
//       ...billing,
//       status: "past_due",
//       graceUntil: expiredDate,
//       lastPaymentError: "Test payment failure - grace period expired",
//     });

//     console.log("✅ Grace period expired, user should be blocked");
//     res.json({
//       success: true,
//       status: "past_due",
//       graceUntil: expiredDate,
//       message: "Grace period expired - access should be blocked"
//     });
//   } catch (error) {
//     console.error("❌ Error simulating expired grace:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // TEST ENDPOINT - Simulate payment recovery
// app.post("/test-payment-recovered", express.json(), async (req, res) => {
//   try {
//     const { orgId } = req.body;
//     console.log("🧪 Test endpoint - simulating payment recovery:", { orgId });

//     const billing = await readBilling(orgId);

//     await writeBilling(orgId, {
//       ...billing,
//       status: "active",
//       graceUntil: null,
//       lastPaymentError: null,
//     });

//     console.log("✅ Payment recovered, access restored");
//     res.json({
//       success: true,
//       status: "active",
//       message: "Payment recovered - access restored"
//     });
//   } catch (error) {
//     console.error("❌ Error simulating payment recovery:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // TEST ENDPOINT - Check current billing status
// app.post("/test-check-billing", express.json(), async (req, res) => {
//   try {
//     const { orgId } = req.body;
//     console.log("🧪 Test endpoint - checking billing status:", { orgId });

//     const billing = await readBilling(orgId);
//     const verdict = isBillingAllowed(billing);

//     console.log("📊 Current billing status:", { billing, verdict });
//     res.json({
//       success: true,
//       billing,
//       verdict,
//       now: nowIso()
//     });
//   } catch (error) {
//     console.error("❌ Error checking billing:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

export default app;
