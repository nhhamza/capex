import express from "express";
import Stripe from "stripe";
import admin from "firebase-admin";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("ERROR: STRIPE_SECRET_KEY environment variable is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// Initialize Firebase Admin
// - Production: FIREBASE_SERVICE_ACCOUNT (json string)
// - Local: backend/serviceAccountKey.json
// Storage: FIREBASE_STORAGE_BUCKET (recommended) or <projectId>.appspot.com
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
      storageBucket: storageBucket || (projectId ? `${projectId}.appspot.com` : undefined),
    });
  } else {
    console.log("Initializing Firebase Admin with local file...");
    // NOTE: path is relative to backend/
    admin.initializeApp({
      credential: admin.credential.cert("./serviceAccountKey.json"),
      projectId,
      storageBucket: storageBucket || (projectId ? `${projectId}.appspot.com` : undefined),
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
const bucket = admin.storage().bucket();

// Multipart uploads (PDFs)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
});

// JSON parsing for all routes except Stripe webhook
app.use(express.json({ limit: "10mb" }));

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
    const u = await getUserDoc(req.user.uid);
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

// CORS configuration - allow multiple origins
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:5173",
  process.env.FRONTEND_URL, // Production frontend URL
].filter(Boolean); // Remove undefined values

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Webhook needs raw body, so we apply express.json() AFTER webhook route
// We'll handle this differently below

/** Map Stripe priceId -> plan + limits */
function mapPrice(priceId) {
  if (!priceId) return { plan: "free", propertyLimit: 2, seatLimit: 1 };
  
  // Match actual Stripe Price IDs
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
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const customerId = session.customer;
        if (!session.subscription) {
          return res.status(200).send("OK");
        }
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId
        );
        const priceId = subscription.items.data[0].price.id;
        const status = subscription.status;
        const customer = await stripe.customers.retrieve(customerId);
        const orgId = customer.metadata?.orgId;
        if (orgId) {
          const limits = mapPrice(priceId);
          await db
            .collection("orgs")
            .doc(orgId)
            .set(
              {
                plan: limits.plan,
                status,
                priceId,
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscription.id,
                propertyLimit: limits.propertyLimit,
                seatLimit: limits.seatLimit,
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
        }
      }

      if (
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.created"
      ) {
        const sub = event.data.object;
        const priceId = sub.items.data[0].price.id;
        const status = sub.status;
        const customer = await stripe.customers.retrieve(sub.customer);
        const orgId = customer.metadata?.orgId;
        if (orgId) {
          const limits = mapPrice(priceId);
          await db
            .collection("orgs")
            .doc(orgId)
            .set(
              {
                plan: limits.plan,
                status,
                priceId,
                stripeCustomerId: sub.customer,
                stripeSubscriptionId: sub.id,
                propertyLimit: limits.propertyLimit,
                seatLimit: limits.seatLimit,
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
        }
      }

      if (event.type === "customer.subscription.deleted") {
        const sub = event.data.object;
        const customer = await stripe.customers.retrieve(sub.customer);
        const orgId = customer.metadata?.orgId;
        if (orgId) {
          await db
            .collection("orgs")
            .doc(orgId)
            .set(
              {
                plan: "free",
                status: "canceled",
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
        }
      }

      res.status(200).send("OK");
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).send("Webhook processing failed");
    }
  }
);

// Apply JSON parser for all other routes
app.use(express.json());

// Create checkout session
app.post("/checkout", requireAuth, requireOrg, async (req, res) => {
  try {
    const { priceId, successUrl, cancelUrl } = req.body || {};
    const orgId = req.orgId;

    if (!orgId || !priceId) {
      return res.status(400).json({ error: "orgId and priceId are required" });
    }

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

    return res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("❌ Error creating checkout session:", error);
    return res.status(500).json({ error: error.message });
  }
});


// Check checkout session status and update plan
app.get("/check-session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log("🔍 Checking session status:", sessionId);
    
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription']
    });
    console.log("Session payment_status:", session.payment_status);
    console.log("Session metadata:", session.metadata);
    
    if (session.payment_status === "paid" && session.subscription) {
      const subscription = typeof session.subscription === 'string' 
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription;
        
      const priceId = subscription.items.data[0].price.id;
      const orgId = session.metadata?.orgId;
      
      if (!orgId) {
        console.error("❌ No orgId in session metadata");
        return res.status(400).json({ error: "Missing orgId in session" });
      }
      
      console.log("💳 Payment completed! Updating org:", orgId, "with price:", priceId);
      
      const limits = mapPrice(priceId);
      await db.collection("orgs").doc(orgId).set({
        plan: limits.plan,
        status: subscription.status,
        priceId,
        stripeCustomerId: session.customer,
        stripeSubscriptionId: subscription.id,
        propertyLimit: limits.propertyLimit,
        seatLimit: limits.seatLimit,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      
      console.log("✅ Plan updated to:", limits.plan);
      res.json({ 
        success: true, 
        paid: true,
        plan: limits.plan,
        status: subscription.status 
      });
    } else {
      res.json({ 
        success: true, 
        paid: false,
        payment_status: session.payment_status 
      });
    }
  } catch (error) {
    console.error("❌ Error checking session:", error);
    res.status(500).json({ error: error.message });
  }
});

// ------------------------------
// Multi-tenant App API (Firestore + Storage)
// All endpoints require Firebase Auth ID token.
// ------------------------------

const ALLOWED_CHILD_COLLECTIONS = new Set([
  "leases",
  "loans",
  "rooms",
  "recurringExpenses",
  "oneOffExpenses",
  "propertyDocs",
  "dealScenarios",
]);

function nowIso() {
  return new Date().toISOString();
}

// Bootstrap user profile + organization (signup/init)
app.post("/api/bootstrap", requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const email = req.user.email;
    const body = req.body || {};

    // If user already exists, just return it
    const existing = await getUserDoc(uid);
    if (existing) {
      return res.json({ user: existing, orgId: pickOrgId(existing) });
    }

    // Create org
    const orgName = body.orgName || "Mi organización";
    const orgRef = db.collection("organizations").doc();
    const orgId = orgRef.id;
    await orgRef.set({
      name: orgName,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    // Create user profile (store extra onboarding fields if provided)
    const profile = body.profile && typeof body.profile === "object" ? body.profile : {};
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

// Organization limits (Stripe plan stored in orgs/{orgId})
app.get("/api/org/limits", requireAuth, requireOrg, async (req, res) => {
  try {
    const snap = await db.collection("orgs").doc(req.orgId).get();
    return res.json({ orgId: req.orgId, ...(snap.exists ? snap.data() : { plan: "free" }) });
  } catch (err) {
    console.error("[org/limits] failed", err);
    return res.status(500).json({ error: "failed to load limits" });
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
    await db.collection("orgs").doc(orgId).set({ plan, updatedAt: nowIso() }, { merge: true });
    const snap = await db.collection("orgs").doc(orgId).get();
    res.json({ org: { id: orgId, ...(snap.exists ? snap.data() : { plan }) } });
  } catch (err) {
    console.error("[orgs] plan update failed", err);
    res.status(500).json({ error: "failed to update plan" });
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
    // Optionally disable auth user
    try { await admin.auth().deleteUser(uid); } catch (_) {}
    res.json({ success: true });
  } catch (err) {
    console.error("[users] delete failed", err);
    res.status(500).json({ error: "failed to delete user" });
  }
});

// Properties
app.get("/api/properties", requireAuth, requireOrg, async (req, res) => {
  try {
    const snap = await db
      .collection("properties")
      .where("organizationId", "==", req.orgId)
      .get();
    const properties = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ properties });
  } catch (err) {
    console.error("[properties] list failed", err);
    res.status(500).json({ error: "failed to list properties" });
  }
});

app.post("/api/properties", requireAuth, requireOrg, async (req, res) => {
  try {
    const payload = { ...(req.body || {}) };
    payload.organizationId = req.orgId;
    payload.createdAt = payload.createdAt || nowIso();
    payload.updatedAt = nowIso();
    const ref = await db.collection("properties").add(payload);
    const created = await ref.get();
    res.status(201).json({ property: { id: ref.id, ...created.data() } });
  } catch (err) {
    console.error("[properties] create failed", err);
    res.status(500).json({ error: "failed to create property" });
  }
});

app.put("/api/properties/:id", requireAuth, requireOrg, async (req, res) => {
  try {
    const id = req.params.id;
    const ref = db.collection("properties").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "not found" });
    const data = snap.data();
    if (data.organizationId !== req.orgId) return res.status(403).json({ error: "forbidden" });
    const payload = { ...(req.body || {}) };
    delete payload.organizationId;
    payload.updatedAt = nowIso();
    await ref.set(payload, { merge: true });
    const updated = await ref.get();
    res.json({ property: { id, ...updated.data() } });
  } catch (err) {
    console.error("[properties] update failed", err);
    res.status(500).json({ error: "failed to update property" });
  }
});

async function cascadeDeleteByProperty(orgId, propertyId) {
  const cols = [
    "leases",
    "loans",
    "rooms",
    "recurringExpenses",
    "oneOffExpenses",
    "propertyDocs",
    "dealScenarios",
  ];
  await Promise.all(
    cols.map(async (col) => {
      // To avoid composite indexes: query by organizationId, filter by propertyId in memory
      const snap = await db.collection(col).where("organizationId", "==", orgId).get();
      const toDelete = snap.docs.filter((d) => d.data().propertyId === propertyId);
      if (toDelete.length === 0) return;
      const batches = [];
      let batch = db.batch();
      let count = 0;
      for (const d of toDelete) {
        batch.delete(d.ref);
        count++;
        if (count === 450) {
          batches.push(batch.commit());
          batch = db.batch();
          count = 0;
        }
      }
      if (count > 0) batches.push(batch.commit());
      await Promise.all(batches);
    })
  );
}

app.delete("/api/properties/:id", requireAuth, requireOrg, async (req, res) => {
  try {
    const id = req.params.id;
    const ref = db.collection("properties").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "not found" });
    const data = snap.data();
    if (data.organizationId !== req.orgId) return res.status(403).json({ error: "forbidden" });
    // Delete children in parallel
    await cascadeDeleteByProperty(req.orgId, id);
    await ref.delete();
    res.json({ success: true });
  } catch (err) {
    console.error("[properties] delete failed", err);
    res.status(500).json({ error: "failed to delete property" });
  }
});

// Generic child collection CRUD (whitelisted)
app.get("/api/collection/:col", requireAuth, requireOrg, async (req, res) => {
  try {
    const col = req.params.col;
    if (!ALLOWED_CHILD_COLLECTIONS.has(col)) return res.status(400).json({ error: "invalid collection" });
    const propertyId = req.query.propertyId;
    const snap = await db.collection(col).where("organizationId", "==", req.orgId).get();
    let docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (propertyId) docs = docs.filter((d) => d.propertyId === propertyId);
    res.json({ items: docs });
  } catch (err) {
    console.error("[collection] list failed", err);
    res.status(500).json({ error: "failed to list" });
  }
});

app.post("/api/collection/:col", requireAuth, requireOrg, async (req, res) => {
  try {
    const col = req.params.col;
    if (!ALLOWED_CHILD_COLLECTIONS.has(col)) return res.status(400).json({ error: "invalid collection" });
    const payload = { ...(req.body || {}) };
    payload.organizationId = req.orgId;
    payload.createdAt = payload.createdAt || nowIso();
    payload.updatedAt = nowIso();
    const ref = await db.collection(col).add(payload);
    const created = await ref.get();
    res.status(201).json({ item: { id: ref.id, ...created.data() } });
  } catch (err) {
    console.error("[collection] create failed", err);
    res.status(500).json({ error: "failed to create" });
  }
});

app.put("/api/collection/:col/:id", requireAuth, requireOrg, async (req, res) => {
  try {
    const col = req.params.col;
    const id = req.params.id;
    if (!ALLOWED_CHILD_COLLECTIONS.has(col)) return res.status(400).json({ error: "invalid collection" });
    const ref = db.collection(col).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "not found" });
    if (snap.data().organizationId !== req.orgId) return res.status(403).json({ error: "forbidden" });
    const payload = { ...(req.body || {}) };
    delete payload.organizationId;
    payload.updatedAt = nowIso();
    await ref.set(payload, { merge: true });
    const updated = await ref.get();
    res.json({ item: { id, ...updated.data() } });
  } catch (err) {
    console.error("[collection] update failed", err);
    res.status(500).json({ error: "failed to update" });
  }
});

app.delete("/api/collection/:col/:id", requireAuth, requireOrg, async (req, res) => {
  try {
    const col = req.params.col;
    const id = req.params.id;
    if (!ALLOWED_CHILD_COLLECTIONS.has(col)) return res.status(400).json({ error: "invalid collection" });
    const ref = db.collection(col).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "not found" });
    if (snap.data().organizationId !== req.orgId) return res.status(403).json({ error: "forbidden" });
    await ref.delete();
    res.json({ success: true });
  } catch (err) {
    console.error("[collection] delete failed", err);
    res.status(500).json({ error: "failed to delete" });
  }
});

// Dashboard aggregate (parallel reads)
app.get("/api/dashboard", requireAuth, requireOrg, async (req, res) => {
  try {
    const orgId = req.orgId;
    const [
      propertiesSnap,
      leasesSnap,
      loansSnap,
      roomsSnap,
      recurringSnap,
      oneOffSnap,
      docsSnap,
      scenariosSnap,
    ] = await Promise.all([
      db.collection("properties").where("organizationId", "==", orgId).get(),
      db.collection("leases").where("organizationId", "==", orgId).get(),
      db.collection("loans").where("organizationId", "==", orgId).get(),
      db.collection("rooms").where("organizationId", "==", orgId).get(),
      db.collection("recurringExpenses").where("organizationId", "==", orgId).get(),
      db.collection("oneOffExpenses").where("organizationId", "==", orgId).get(),
      db.collection("propertyDocs").where("organizationId", "==", orgId).get(),
      db.collection("dealScenarios").where("organizationId", "==", orgId).get(),
    ]);

    const pack = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({
      properties: pack(propertiesSnap),
      leases: pack(leasesSnap),
      loans: pack(loansSnap),
      rooms: pack(roomsSnap),
      recurringExpenses: pack(recurringSnap),
      oneOffExpenses: pack(oneOffSnap),
      propertyDocs: pack(docsSnap),
      dealScenarios: pack(scenariosSnap),
    });
  } catch (err) {
    console.error("[dashboard] failed", err);
    res.status(500).json({ error: "failed to load dashboard" });
  }
});

// File upload for property docs (PDF/images)
// multipart form-data: file, propertyId, name(optional)
app.post(
  "/api/propertyDocs/upload",
  requireAuth,
  requireOrg,
  upload.single("file"),
  async (req, res) => {
    try {
      const file = req.file;
      const { propertyId, name } = req.body || {};
      if (!file) return res.status(400).json({ error: "missing file" });
      if (!propertyId) return res.status(400).json({ error: "missing propertyId" });

      // Validate property ownership
      const propSnap = await db.collection("properties").doc(propertyId).get();
      if (!propSnap.exists) return res.status(404).json({ error: "property not found" });
      if (propSnap.data().organizationId !== req.orgId) return res.status(403).json({ error: "forbidden" });

      const docRef = db.collection("propertyDocs").doc();
      const docId = docRef.id;
      const safeName = (name || file.originalname || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `orgs/${req.orgId}/properties/${propertyId}/docs/${docId}_${safeName}`;

      const gcsFile = bucket.file(storagePath);
      await gcsFile.save(file.buffer, {
        contentType: file.mimetype,
        resumable: false,
        metadata: {
          cacheControl: "public, max-age=3600",
        },
      });

      // Signed URL (long-lived)
      const [url] = await gcsFile.getSignedUrl({
        action: "read",
        expires: "2099-01-01",
      });

      const docData = {
        organizationId: req.orgId,
        propertyId,
        name: safeName,
        storagePath,
        url,
        uploadedAt: nowIso(),
        mimeType: file.mimetype,
        size: file.size,
      };

      await docRef.set(docData);
      res.status(201).json({ doc: { id: docId, ...docData } });
    } catch (err) {
      console.error("[propertyDocs/upload] failed", err);
      res.status(500).json({ error: "upload failed" });
    }
  }
);

// File upload for CapEx attachments
// multipart form-data: file, propertyId, name(optional)
app.post(
  "/api/capex/upload",
  requireAuth,
  requireOrg,
  upload.single("file"),
  async (req, res) => {
    try {
      const file = req.file;
      const { propertyId, name } = req.body || {};

      // Validate inputs
      if (!file) return res.status(400).json({ error: "missing file" });
      if (!propertyId) return res.status(400).json({ error: "missing propertyId" });

      // Validate property ownership
      const propSnap = await db.collection("properties").doc(propertyId).get();
      if (!propSnap.exists) return res.status(404).json({ error: "property not found" });
      if (propSnap.data().organizationId !== req.orgId) {
        return res.status(403).json({ error: "forbidden - property does not belong to organization" });
      }

      // Create safe filename and storage path
      const timestamp = Date.now();
      const safeName = (name || file.originalname || "attachment").replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `orgs/${req.orgId}/properties/${propertyId}/capex/${timestamp}_${safeName}`;

      // Upload to Firebase Storage
      const gcsFile = bucket.file(storagePath);
      await gcsFile.save(file.buffer, {
        contentType: file.mimetype,
        resumable: false,
        metadata: {
          cacheControl: "public, max-age=3600",
        },
      });

      // Generate signed URL (long-lived)
      const [url] = await gcsFile.getSignedUrl({
        action: "read",
        expires: "2099-01-01",
      });

      // Prepare attachment response
      const attachment = {
        name: safeName,
        storagePath,
        url,
        mimeType: file.mimetype,
        size: file.size,
      };

      res.status(201).json({ attachment });
    } catch (err) {
      console.error("[capex/upload] failed", err);
      res.status(500).json({ error: "upload failed", message: err?.message || "Internal server error" });
    }
  }
);


app.listen(PORT, () => {
  console.log(`🚀 Billing API running on http://localhost:${PORT}`);
});

// TEST ENDPOINT - Remove in production
// Manually update org plan for testing
app.post("/test-update-plan", express.json(), async (req, res) => {
  try {
    const { orgId, plan } = req.body;
    console.log("🧪 Test endpoint - updating plan:", { orgId, plan });
    
    const limits = mapPrice(
      plan === "solo" ? "price_1SRy7v1Ooy6ryYPn2mc6FKfu" :
      plan === "pro" ? "price_1SRyIm1Ooy6ryYPnczGBTB7g" :
      plan === "agency" ? "price_1SRyMA1Ooy6ryYPnzPLHOkWt" : null
    );
    
    await db.collection("orgs").doc(orgId).set({
      plan: limits.plan,
      status: "active",
      propertyLimit: limits.propertyLimit,
      seatLimit: limits.seatLimit,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    
    console.log("✅ Plan updated successfully");
    res.json({ success: true, limits });
  } catch (error) {
    console.error("❌ Error updating plan:", error);
    res.status(500).json({ error: error.message });
  }
});
