// app.js (ESM) - COPY/PASTE FULL FILE
import express from "express";
import Stripe from "stripe";
import admin from "firebase-admin";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";

dotenv.config();

const app = express();

const isVercel = Boolean(process.env.VERCEL);

// -------------------- Stripe --------------------
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("ERROR: STRIPE_SECRET_KEY environment variable is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_missing", {
  apiVersion: "2024-06-20",
});

// -------------------- Firebase Admin --------------------
let firebaseReady = true;

let projectId = process.env.FIREBASE_PROJECT_ID;
let storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log("Initializing Firebase Admin with FIREBASE_SERVICE_ACCOUNT env...");
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    projectId = projectId || serviceAccount.project_id;
    storageBucket = storageBucket || serviceAccount.storage_bucket;

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
      storageBucket: storageBucket || (projectId ? `${projectId}.appspot.com` : undefined),
    });
  } else {
    if (isVercel) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT is required on Vercel (do not use local serviceAccountKey.json in production)."
      );
    }
    console.log("Initializing Firebase Admin with local ./serviceAccountKey.json ...");
    admin.initializeApp({
      credential: admin.credential.cert("./serviceAccountKey.json"),
      projectId,
      storageBucket: storageBucket || (projectId ? `${projectId}.appspot.com` : undefined),
    });
  }

  firebaseReady = true;
  console.log("Firebase Admin initialized successfully", {
    projectId: admin.app().options.projectId,
    storageBucket: admin.app().options.storageBucket,
  });
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error);
  firebaseReady = false;
}

const db = firebaseReady ? admin.firestore() : null;

let bucket = null;
if (firebaseReady) {
  try {
    bucket = admin.storage().bucket();
    console.log("Firebase Storage bucket initialized:", bucket.name);
  } catch (err) {
    console.error("Failed to initialize Firebase Storage bucket:", err?.message);
    console.error("Make sure FIREBASE_STORAGE_BUCKET is set in environment variables");
    firebaseReady = false;
  }
}

// -------------------- Helpers --------------------
function nowIso() {
  return new Date().toISOString();
}

function addDaysIso(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// Canonical billing doc: organizations/{orgId}/private/billing
const billingDocPath = (orgId) => `organizations/${orgId}/private/billing`;
const billingDocRef = (orgId) => db.doc(billingDocPath(orgId));

async function readBilling(orgId) {
  const snap = await billingDocRef(orgId).get();
  if (snap.exists) return snap.data() || {};
  return { plan: "free", status: "active", propertyLimit: 1, seatLimit: 1 };
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

  if (status === "active" || status === "trialing") return { allowed: true };
  if (status === "canceled") return { allowed: false, reason: "Subscription canceled" };

  if (status === "past_due" || status === "unpaid") {
    if (graceUntil && now <= graceUntil) return { allowed: true, reason: "Grace period active", graceUntil };
    return { allowed: false, reason: "Payment overdue", graceUntil };
  }

  return { allowed: false, reason: "Unknown billing status" };
}

function pickOrgId(userDoc) {
  return userDoc?.organizationId || userDoc?.orgId || null;
}

async function getUserDoc(uid) {
  if (!db) return null;
  const snap = await db.collection("users").doc(uid).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

// -------------------- Upload --------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// -------------------- CORS (robusto en Vercel, sin 500 en preflight) --------------------
const envOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => s.replace(/\/$/, "")); // quita slash final

const allowedOrigins = new Set(
  [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:5173",
    "https://propietarioplus.com",
    "https://www.propietarioplus.com",
    ...envOrigins,
  ].map((s) => s.replace(/\/$/, ""))
);

function isAllowedOrigin(origin) {
  if (!origin) return true; // server-to-server / curl
  const normalized = String(origin).replace(/\/$/, "");
  return allowedOrigins.has(normalized);
}

// (A) Middleware que SIEMPRE setea headers si el origin es allowed
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  return next();
});

// (B) CORS package (no lanza error -> evita 500). Si no allowed, no pone header y el browser lo bloquea.
const corsOptions = {
  origin: (origin, callback) => {
    // ✅ clave: NUNCA devolver Error aquí
    // - Si es allowed => true
    // - Si no es allowed => false (sin error)
    return callback(null, isAllowedOrigin(origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Stripe-Signature"],
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));



// (C) Preflight manual universal (control total para Authorization header)
app.options("*", (req, res) => {
  const origin = req.headers.origin;

  if (!origin) return res.sendStatus(204);

  if (!isAllowedOrigin(origin)) {
    console.log("[CORS PREFLIGHT BLOCKED]", {
      origin,
      allowedOrigins: Array.from(allowedOrigins),
      envOrigins,
    });
    // Sin ACAO => el browser lo bloqueará igualmente
    return res.sendStatus(403);
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  res.setHeader(
    "Access-Control-Allow-Headers",
    req.headers["access-control-request-headers"] || "Authorization,Content-Type,Stripe-Signature"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    req.headers["access-control-request-method"] || "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );

  return res.sendStatus(204);
});

// (D) Bloque extra que ya tenías: lo dejamos sin “regresiones”, pero sin efectos colaterales.
//     (No bloquea ni re-define listas: solo loguea si quieres auditar.)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) return next();

  const normalized = String(origin).replace(/\/$/, "");
  const allowed = allowedOrigins.has(normalized);

  // Solo log para depurar
  if (!allowed) {
    // Puedes comentar esto si hace ruido
    // console.log("[CORS OBSERVE - not allowed]", { origin, normalized });
  }

  return next();
});

// Stripe webhook MUST be before express.json()
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
    // --- Checkout complete ---
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // Only process if payment was successful
      if (session.payment_status !== "paid") {
        console.log("[Webhook] Checkout session not paid, skipping", {
          sessionId: session.id,
          paymentStatus: session.payment_status,
        });
        return res.status(200).send("OK");
      }

      const customerId = session.customer;
      if (!session.subscription) {
        console.log("[Webhook] No subscription in session, skipping");
        return res.status(200).send("OK");
      }

      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription.id;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0].price.id;
      const status = subscription.status;

      const customer = await stripe.customers.retrieve(customerId);
      const orgId = customer.metadata?.orgId;

      if (orgId && db) {
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

    // --- Subscription updates/creates ---
    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
      const sub = event.data.object;
      const priceId = sub.items.data[0].price.id;
      const status = sub.status;

      const customer = await stripe.customers.retrieve(sub.customer);
      const orgId = customer.metadata?.orgId;

      if (orgId && db) {
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

    // --- Subscription deleted ---
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const customer = await stripe.customers.retrieve(sub.customer);
      const orgId = customer.metadata?.orgId;
      if (orgId && db) {
        await writeBilling(orgId, { plan: "free", status: "canceled" });
      }
    }

    // --- Payment failed ---
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const customer = await stripe.customers.retrieve(invoice.customer);
      const orgId = customer.metadata?.orgId;

      if (orgId && db) {
        let priceId = null;
        let status = "past_due";

        if (invoice.subscription) {
          const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id;
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

    // --- Payment succeeded ---
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object;
      const customer = await stripe.customers.retrieve(invoice.customer);
      const orgId = customer.metadata?.orgId;

      if (orgId && db && invoice.subscription) {
        const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id;
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

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Error processing webhook:", error);
    return res.status(500).send("Webhook processing failed");
  }
});

// JSON parser for all other routes
app.use(express.json());

// -------------------- Auth --------------------
async function requireAuth(req, res, next) {
  try {
    if (!firebaseReady) return res.status(503).json({ error: "firebase_not_configured" });

    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing Bearer token" });

    const decoded = await admin.auth().verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email || null, claims: decoded };
    return next();
  } catch (err) {
    console.error("[auth] verifyIdToken failed", err?.message || err);
    return res.status(401).json({ error: "Invalid token" });
  }
}

async function requireOrg(req, res, next) {
  if (!req.user?.uid) return res.status(401).json({ error: "unauthorized" });
  if (!firebaseReady || !db) return res.status(503).json({ error: "firebase_not_configured" });

  try {
    const u = await getUserDoc(req.user.uid);
    if (!u) return res.status(403).json({ error: "not_initialized" });

    const orgId = pickOrgId(u);
    if (!orgId) return res.status(403).json({ error: "not_initialized" });

    req.userDoc = u;
    req.orgId = orgId;
    return next();
  } catch (err) {
    console.error("[org] firestore read failed:", err);
    return res.status(503).json({
      error: "org_lookup_failed",
      message: err?.message || String(err),
    });
  }
}

function requireAdmin(req, res, next) {
  const role = req.userDoc?.role;
  if (role === "admin") return next();
  return res.status(403).json({ error: "admin only" });
}

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

    return next();
  } catch (err) {
    console.error("[billing] check failed", err);
    return res.status(500).json({ error: "Failed to verify billing" });
  }
}

// -------------------- Price map --------------------
function mapPrice(priceId) {
  if (!priceId) return { plan: "free", propertyLimit: 2, seatLimit: 1 };

  // Read price IDs from environment variables
  const PRICE_SOLO = process.env.STRIPE_PRICE_SOLO;
  const PRICE_PRO = process.env.STRIPE_PRICE_PRO;
  const PRICE_AGENCY = process.env.STRIPE_PRICE_AGENCY;

  if (priceId === PRICE_SOLO) return { plan: "solo", propertyLimit: 10, seatLimit: 1 };
  if (priceId === PRICE_PRO) return { plan: "pro", propertyLimit: 50, seatLimit: 3 };
  if (priceId === PRICE_AGENCY) return { plan: "agency", propertyLimit: 200, seatLimit: 10 };

  // Fallback to free if price not recognized
  console.warn(`[mapPrice] Unknown priceId: ${priceId}, defaulting to free plan`);
  return { plan: "free", propertyLimit: 2, seatLimit: 1 };
}

// -------------------- Health --------------------
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Billing API is running",
    environment: {
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
      hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      hasFirebaseAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      hasFrontendUrl: !!process.env.FRONTEND_URL,
    },
    timestamp: new Date().toISOString(),
  });
});

// Optional Firestore health
app.get("/api/health/firestore", async (req, res) => {
  if (!firebaseReady || !db) return res.status(503).json({ status: "error", message: "firebase_not_configured" });
  try {
    await db.collection("_health").doc("ping").get();
    return res.json({ status: "ok" });
  } catch (err) {
    return res.status(503).json({ status: "error", message: err?.message || String(err) });
  }
});

// Firebase Storage health check
app.get("/api/health/storage", async (req, res) => {
  const diagnostics = {
    firebaseReady,
    hasBucket: !!bucket,
    bucketName: bucket?.name || null,
    storageBucketEnv: process.env.FIREBASE_STORAGE_BUCKET || null,
    projectId: admin.app()?.options?.projectId || null,
    configuredStorageBucket: admin.app()?.options?.storageBucket || null,
  };

  if (!firebaseReady) {
    return res.status(503).json({
      status: "error",
      message: "Firebase is not initialized",
      diagnostics,
    });
  }

  if (!bucket) {
    return res.status(503).json({
      status: "error",
      message: "Storage bucket is not configured. Check FIREBASE_STORAGE_BUCKET environment variable.",
      diagnostics,
    });
  }

  try {
    // Try to list files to verify bucket access
    await bucket.getFiles({ maxResults: 1 });
    return res.json({
      status: "ok",
      message: "Firebase Storage is working correctly",
      diagnostics,
    });
  } catch (err) {
    return res.status(503).json({
      status: "error",
      message: `Storage bucket access failed: ${err?.message || String(err)}`,
      diagnostics,
      error: {
        code: err?.code,
        message: err?.message,
      },
    });
  }
});

// -------------------- Signup init (ONLY place to create org/profile) --------------------
app.post("/api/signup/initialize", requireAuth, async (req, res) => {
  if (!firebaseReady || !db) return res.status(503).json({ error: "firebase_not_configured" });

  try {
    const uid = req.user.uid;
    const email = req.user.email || null;
    const body = req.body || {};

    // Must be explicit
    if (!body.createOrg) return res.status(400).json({ error: "createOrg_required" });

    const userRef = db.collection("users").doc(uid);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);

      // Idempotent: already initialized -> return
      if (snap.exists) {
        const existing = { id: uid, ...snap.data() };
        return { alreadyInitialized: true, user: existing, orgId: pickOrgId(existing) };
      }

      const orgName = body.orgName || "Mi organización";
      const profile = body.profile && typeof body.profile === "object" ? body.profile : {};

      const orgRef = db.collection("organizations").doc();
      const orgId = orgRef.id;

      tx.set(orgRef, { name: orgName, createdAt: nowIso(), updatedAt: nowIso() });

      tx.set(
        db.doc(billingDocPath(orgId)),
        { plan: "free", status: "active", propertyLimit: 2, seatLimit: 1, createdAt: nowIso(), updatedAt: nowIso() },
        { merge: true }
      );

      const userDoc = {
        email: email || body.email || null,
        ...profile,
        role: "admin",
        orgId,
        organizationId: orgId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };

      tx.set(userRef, userDoc);

      return { alreadyInitialized: false, user: { id: uid, ...userDoc }, orgId };
    });

    return res.json(result);
  } catch (err) {
    console.error("[signup/initialize] failed", err);
    return res.status(500).json({ error: "signup_initialize_failed" });
  }
});

// -------------------- Me --------------------
app.get("/api/me", requireAuth, requireOrg, async (req, res) => {
  return res.json({
    uid: req.user.uid,
    email: req.user.email,
    orgId: req.orgId,
    user: req.userDoc,
  });
});

// -------------------- Limits/Billing --------------------
app.get("/api/org/limits", requireAuth, requireOrg, async (req, res) => {
  try {
    const data = await readBilling(req.orgId);
    return res.json({ orgId: req.orgId, ...data });
  } catch (err) {
    console.error("[org/limits] failed", err);
    return res.status(500).json({ error: "failed to read org limits" });
  }
});

// -------------------- Users --------------------
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

    return res.json({ users: Array.from(map.values()) });
  } catch (err) {
    console.error("[users] list failed", err);
    return res.status(500).json({ error: "failed to list users" });
  }
});

// -------------------- Checkout helpers (AUTH REQUIRED) --------------------
app.post("/checkout", requireAuth, requireOrg, async (req, res) => {
  try {
    const { priceId, successUrl, cancelUrl } = req.body || {};
    const orgId = req.orgId;

    if (!orgId) return res.status(400).json({ error: "Missing orgId (from user profile)" });
    if (!priceId) return res.status(400).json({ error: "priceId is required" });

    const billing = await readBilling(orgId);
    let customerId = billing.stripeCustomerId;

    // Validar si el customer existe en el modo actual de Stripe
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
      } catch (err) {
        // Customer no existe (probablemente de otro modo - test vs live)
        console.log(`[checkout] Customer ${customerId} no existe, creando uno nuevo...`);
        customerId = null;
      }
    }

    // Crear customer si no existe o era inválido
    if (!customerId) {
      const customer = await stripe.customers.create({ metadata: { orgId } });
      customerId = customer.id;
      await writeBilling(orgId, { stripeCustomerId: customerId });
      console.log(`[checkout] Nuevo customer creado: ${customerId}`);
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

    return res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("❌ Error creating checkout session:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.get("/check-session/:sessionId", requireAuth, requireOrg, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
    const sessionOrgId = session.metadata?.orgId;

    if (!sessionOrgId || sessionOrgId !== req.orgId) return res.status(403).json({ error: "forbidden" });

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

      return res.json({ success: true, paid: true, plan: limits.plan, status: subscription.status });
    }

    return res.json({ success: true, paid: false, payment_status: session.payment_status });
  } catch (error) {
    console.error("❌ Error checking session:", error);
    return res.status(500).json({ error: error.message });
  }
});

// -------------------- Collections --------------------
const relatedCollections = Object.freeze([
  "leases",
  "loans",
  "rooms",
  "recurringExpenses",
  "oneOffExpenses",
  "propertyDocs",
  "dealScenarios",
]);

// -------------------- Properties CRUD --------------------
app.get("/api/properties", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const snap = await db.collection("properties").where("organizationId", "==", req.orgId).get();
    return res.json({ properties: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (err) {
    console.error("[properties] list failed", err);
    return res.status(500).json({ error: "failed to list properties" });
  }
});

app.post("/api/properties", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const payload = req.body || {};
    payload.organizationId = req.orgId;

    const ref = db.collection("properties").doc();
    await ref.set({ ...payload, createdAt: nowIso(), updatedAt: nowIso() });

    const snap = await ref.get();
    return res.json({ property: { id: ref.id, ...snap.data() } });
  } catch (err) {
    console.error("[properties] create failed", err);
    return res.status(500).json({ error: "failed to create property" });
  }
});

app.put("/api/properties/:id", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const ref = db.collection("properties").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "property not found" });
    if (snap.data().organizationId !== req.orgId) return res.status(403).json({ error: "forbidden" });

    const payload = req.body || {};
    delete payload.organizationId;

    await ref.set({ ...payload, updatedAt: nowIso() }, { merge: true });

    const updated = await ref.get();
    return res.json({ property: { id: ref.id, ...updated.data() } });
  } catch (err) {
    console.error("[properties] update failed", err);
    return res.status(500).json({ error: "failed to update property" });
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
      relSnap.docs.filter((d) => d.data().propertyId === id).forEach((d) => batch.delete(d.ref));
    }

    await batch.commit();
    return res.json({ success: true });
  } catch (err) {
    console.error("[properties] delete failed", err);
    return res.status(500).json({ error: "failed to delete property" });
  }
});

// -------------------- Dashboard --------------------
app.get("/api/dashboard", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const orgId = req.orgId;

    const [propsSnap, leasesSnap, loansSnap, recurringSnap, oneOffSnap, roomsSnap] = await Promise.all([
      db.collection("properties").where("organizationId", "==", orgId).get(),
      db.collection("leases").where("organizationId", "==", orgId).get(),
      db.collection("loans").where("organizationId", "==", orgId).get(),
      db.collection("recurringExpenses").where("organizationId", "==", orgId).get(),
      db.collection("oneOffExpenses").where("organizationId", "==", orgId).get(),
      db.collection("rooms").where("organizationId", "==", orgId).get(),
    ]);

    return res.json({
      properties: propsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      leases: leasesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      loans: loansSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      recurringExpenses: recurringSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      oneOffExpenses: oneOffSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      rooms: roomsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    });
  } catch (err) {
    console.error("[dashboard] failed", err);
    return res.status(500).json({ error: "failed to load dashboard" });
  }
});

// -------------------- Stripe Mode Check --------------------
app.get("/api/stripe-mode", requireAuth, async (req, res) => {
  try {
    const key = process.env.STRIPE_SECRET_KEY || "";
    const prefix = key.startsWith("sk_live_")
      ? "sk_live_"
      : key.startsWith("sk_test_")
      ? "sk_test_"
      : "unknown";

    // Llamada real a Stripe para confirmar el modo
    const account = await stripe.accounts.retrieve();

    return res.json({
      ok: true,
      keyPrefix: prefix,
      livemode: !!account.livemode,
      accountId: account.id,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || String(err),
    });
  }
});

// -------------------- Generic collection CRUD --------------------
app.get("/api/:collection", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const col = req.params.collection;
    if (!relatedCollections.includes(col)) return res.status(400).json({ error: "unknown collection" });

    const snap = await db.collection(col).where("organizationId", "==", req.orgId).get();
    return res.json({ [col]: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (err) {
    console.error(`[${req.params.collection}] list failed`, err);
    return res.status(500).json({ error: `failed to list ${req.params.collection}` });
  }
});

app.post("/api/:collection", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const col = req.params.collection;
    if (!relatedCollections.includes(col)) return res.status(400).json({ error: "unknown collection" });

    const payload = req.body || {};
    payload.organizationId = req.orgId;

    const ref = db.collection(col).doc();
    await ref.set({ ...payload, createdAt: nowIso(), updatedAt: nowIso() });

    const snap = await ref.get();
    return res.json({ [col.slice(0, -1)]: { id: ref.id, ...snap.data() } });
  } catch (err) {
    console.error(`[${req.params.collection}] create failed`, err);
    return res.status(500).json({ error: `failed to create ${req.params.collection}` });
  }
});

app.put("/api/:collection/:id", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const col = req.params.collection;
    if (!relatedCollections.includes(col)) return res.status(400).json({ error: "unknown collection" });

    const ref = db.collection(col).doc(req.params.id);
    const snap = await ref.get();

    if (!snap.exists) return res.status(404).json({ error: "not found" });
    if (snap.data().organizationId !== req.orgId) return res.status(403).json({ error: "forbidden" });

    const payload = req.body || {};
    delete payload.organizationId;

    await ref.set({ ...payload, updatedAt: nowIso() }, { merge: true });

    const updated = await ref.get();
    return res.json({ [col.slice(0, -1)]: { id: ref.id, ...updated.data() } });
  } catch (err) {
    console.error(`[${req.params.collection}] update failed`, err);
    return res.status(500).json({ error: `failed to update ${req.params.collection}` });
  }
});

app.delete("/api/:collection/:id", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const col = req.params.collection;
    if (!relatedCollections.includes(col)) return res.status(400).json({ error: "unknown collection" });

    const ref = db.collection(col).doc(req.params.id);
    const snap = await ref.get();

    if (!snap.exists) return res.status(404).json({ error: "not found" });
    if (snap.data().organizationId !== req.orgId) return res.status(403).json({ error: "forbidden" });

    await ref.delete();
    return res.json({ success: true });
  } catch (err) {
    console.error(`[${req.params.collection}] delete failed`, err);
    return res.status(500).json({ error: `failed to delete ${req.params.collection}` });
  }
});

// -------------------- Compatibility /collection/:collection --------------------
app.get("/api/collection/:collection", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const col = req.params.collection;
    if (!relatedCollections.includes(col)) return res.status(400).json({ error: "unknown collection" });

    const propertyId = req.query.propertyId;
    let query = db.collection(col).where("organizationId", "==", req.orgId);
    if (propertyId) query = query.where("propertyId", "==", propertyId);

    const snap = await query.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.json({ items });
  } catch (err) {
    console.error(`[collection/${req.params.collection}] list failed`, err);
    return res.status(500).json({ error: `failed to list ${req.params.collection}` });
  }
});

app.post("/api/collection/:collection", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const col = req.params.collection;
    if (!relatedCollections.includes(col)) return res.status(400).json({ error: "unknown collection" });

    const payload = req.body || {};
    payload.organizationId = req.orgId;

    const ref = db.collection(col).doc();
    await ref.set({ ...payload, createdAt: nowIso(), updatedAt: nowIso() });

    const snap = await ref.get();
    return res.json({ item: { id: ref.id, ...snap.data() } });
  } catch (err) {
    console.error(`[collection/${req.params.collection}] create failed`, err);
    return res.status(500).json({ error: `failed to create ${req.params.collection}` });
  }
});

app.put("/api/collection/:collection/:id", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const col = req.params.collection;
    if (!relatedCollections.includes(col)) return res.status(400).json({ error: "unknown collection" });

    const ref = db.collection(col).doc(req.params.id);
    const snap = await ref.get();

    if (!snap.exists) return res.status(404).json({ error: "not found" });
    if (snap.data().organizationId !== req.orgId) return res.status(403).json({ error: "forbidden" });

    const payload = req.body || {};
    delete payload.organizationId;

    await ref.set({ ...payload, updatedAt: nowIso() }, { merge: true });

    const updated = await ref.get();
    return res.json({ item: { id: ref.id, ...updated.data() } });
  } catch (err) {
    console.error(`[collection/${req.params.collection}] update failed`, err);
    return res.status(500).json({ error: `failed to update ${req.params.collection}` });
  }
});

app.delete("/api/collection/:collection/:id", requireAuth, requireOrg, requireBillingOk, async (req, res) => {
  try {
    const col = req.params.collection;
    if (!relatedCollections.includes(col)) return res.status(400).json({ error: "unknown collection" });

    const ref = db.collection(col).doc(req.params.id);
    const snap = await ref.get();

    if (!snap.exists) return res.status(404).json({ error: "not found" });
    if (snap.data().organizationId !== req.orgId) return res.status(403).json({ error: "forbidden" });

    await ref.delete();
    return res.json({ success: true });
  } catch (err) {
    console.error(`[collection/${req.params.collection}] delete failed`, err);
    return res.status(500).json({ error: `failed to delete ${req.params.collection}` });
  }
});

// -------------------- Uploads --------------------
app.post("/api/propertyDocs/upload", requireAuth, requireOrg, requireBillingOk, upload.single("file"), async (req, res) => {
  try {
    console.log("[propertyDocs/upload] Starting upload...", {
      hasFile: !!req.file,
      propertyId: req.body?.propertyId,
      orgId: req.orgId,
    });

    if (!firebaseReady) {
      console.error("[propertyDocs/upload] Firebase not ready");
      return res.status(503).json({ error: "firebase_not_configured", message: "Firebase is not initialized" });
    }

    if (!bucket) {
      console.error("[propertyDocs/upload] Storage bucket not configured");
      return res.status(503).json({ error: "storage_not_configured", message: "Firebase Storage bucket is not configured" });
    }

    const file = req.file;
    if (!file) {
      console.error("[propertyDocs/upload] No file in request");
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { propertyId, name } = req.body;
    if (!propertyId) {
      console.error("[propertyDocs/upload] No propertyId provided");
      return res.status(400).json({ error: "propertyId required" });
    }

    console.log("[propertyDocs/upload] Checking property ownership...");
    const propSnap = await db.collection("properties").doc(propertyId).get();
    if (!propSnap.exists) {
      console.error("[propertyDocs/upload] Property not found:", propertyId);
      return res.status(404).json({ error: "property not found" });
    }
    if (propSnap.data().organizationId !== req.orgId) {
      console.error("[propertyDocs/upload] Property doesn't belong to org");
      return res.status(403).json({ error: "forbidden" });
    }

    const docRef = db.collection("propertyDocs").doc();
    const docId = docRef.id;

    const safeName = (name || file.originalname || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `organizations/${req.orgId}/properties/${propertyId}/docs/${docId}_${safeName}`;

    console.log("[propertyDocs/upload] Uploading to storage:", storagePath);
    const gcsFile = bucket.file(storagePath);
    await gcsFile.save(file.buffer, {
      contentType: file.mimetype,
      resumable: false,
      metadata: { cacheControl: "public, max-age=3600" },
    });

    console.log("[propertyDocs/upload] Generating signed URL...");
    // Generate signed URL valid for 7 days (instead of makePublic)
    const [signedUrl] = await gcsFile.getSignedUrl({
      action: "read",
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    const publicUrl = signedUrl;

    console.log("[propertyDocs/upload] Saving to Firestore...");
    await docRef.set({
      organizationId: req.orgId,
      propertyId,
      name: safeName,
      url: publicUrl,
      storagePath,
      contentType: file.mimetype,
      size: file.size,
      uploadedAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    const snap = await docRef.get();
    console.log("[propertyDocs/upload] Upload successful:", docId);
    return res.json({ doc: { id: docId, ...snap.data() } });
  } catch (err) {
    console.error("[propertyDocs/upload] failed:", {
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
    });
    return res.status(500).json({
      error: "failed to upload doc",
      message: err?.message || "Unknown error",
      code: err?.code,
    });
  }
});

app.post("/api/capex/upload", requireAuth, requireOrg, requireBillingOk, upload.single("file"), async (req, res) => {
  try {
    console.log("[capex/upload] Starting upload...", {
      hasFile: !!req.file,
      propertyId: req.body?.propertyId,
      orgId: req.orgId,
    });

    if (!firebaseReady) {
      console.error("[capex/upload] Firebase not ready");
      return res.status(503).json({ error: "firebase_not_configured", message: "Firebase is not initialized" });
    }

    if (!bucket) {
      console.error("[capex/upload] Storage bucket not configured");
      return res.status(503).json({ error: "storage_not_configured", message: "Firebase Storage bucket is not configured" });
    }

    const file = req.file;
    if (!file) {
      console.error("[capex/upload] No file in request");
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { propertyId, name } = req.body;
    if (!propertyId) {
      console.error("[capex/upload] No propertyId provided");
      return res.status(400).json({ error: "propertyId required" });
    }

    console.log("[capex/upload] Checking property ownership...");
    const propSnap = await db.collection("properties").doc(propertyId).get();
    if (!propSnap.exists) {
      console.error("[capex/upload] Property not found:", propertyId);
      return res.status(404).json({ error: "property not found" });
    }
    if (propSnap.data().organizationId !== req.orgId) {
      console.error("[capex/upload] Property doesn't belong to org");
      return res.status(403).json({ error: "forbidden - property does not belong to organization" });
    }

    const timestamp = Date.now();
    const safeName = (name || file.originalname || "attachment").replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `organizations/${req.orgId}/properties/${propertyId}/capex/${timestamp}_${safeName}`;

    console.log("[capex/upload] Uploading to storage:", storagePath);
    const gcsFile = bucket.file(storagePath);
    await gcsFile.save(file.buffer, {
      contentType: file.mimetype,
      resumable: false,
      metadata: { cacheControl: "public, max-age=3600" },
    });

    console.log("[capex/upload] Generating signed URL...");
    // Generate signed URL valid for 7 days (instead of makePublic)
    const [signedUrl] = await gcsFile.getSignedUrl({
      action: "read",
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    const publicUrl = signedUrl;

    console.log("[capex/upload] Upload successful");
    return res.json({
      attachment: {
        name: safeName,
        url: publicUrl,
        storagePath,
        mimeType: file.mimetype,
      },
    });
  } catch (err) {
    console.error("[capex/upload] failed:", {
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
    });
    return res.status(500).json({
      error: "failed to upload capex file",
      message: err?.message || "Unknown error",
      code: err?.code,
    });
  }
});

export default app;
