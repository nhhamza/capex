import express from "express";
import Stripe from "stripe";
import admin from "firebase-admin";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// Initialize Firebase Admin
// For Vercel: uses FIREBASE_SERVICE_ACCOUNT env var
// For local: uses serviceAccountKey.json file
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
} else {
  admin.initializeApp({
    credential: admin.credential.cert("./serviceAccountKey.json"),
  });
}

const db = admin.firestore();

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
  res.json({ status: "ok", message: "Billing API is running" });
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
app.post("/checkout", async (req, res) => {
  console.log("📥 Checkout request received:", req.body);
  try {
    const { orgId, priceId, successUrl, cancelUrl } = req.body;

    console.log("Checking request params...", { orgId, priceId });

    if (!orgId || !priceId) {
      console.log("❌ Missing required parameters");
      return res.status(400).json({
        error: "orgId and priceId are required",
      });
    }

    console.log("Looking up org in Firestore...");
    const orgRef = db.collection("orgs").doc(orgId);
    const orgSnap = await orgRef.get();
    const org = orgSnap.data() || {};
    console.log("Org data:", org);

    let customerId = org.stripeCustomerId;
    console.log("Existing Stripe customer ID:", customerId);
    if (!customerId) {
      console.log("Creating new Stripe customer...");
      const customer = await stripe.customers.create({ metadata: { orgId } });
      customerId = customer.id;
      console.log("Created customer:", customerId);
      await orgRef.set({ stripeCustomerId: customerId }, { merge: true });
    }

    console.log("Creating checkout session...");
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer: customerId,
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      metadata: { orgId, priceId }, // Store for easy access
    });

    console.log("✅ Checkout session created:", session.id);
    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("❌ Error creating checkout session:");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    if (error.type === 'StripeInvalidRequestError') {
      console.error("Stripe error details:", error.raw);
    }
    res.status(500).json({ error: error.message });
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
