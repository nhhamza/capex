import { getFirestore } from "firebase-admin/firestore";
import * as functions from "firebase-functions";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

// Get Firestore instance
const getDb = () => getFirestore();

/** Map Stripe priceId -> plan + limits */
function mapPrice(priceId?: string) {
  if (!priceId) return { plan: "free", propertyLimit: 2, seatLimit: 1 };
  if (priceId.includes("SOLO"))
    return { plan: "solo", propertyLimit: 10, seatLimit: 1 };
  if (priceId.includes("PRO"))
    return { plan: "pro", propertyLimit: 50, seatLimit: 3 };
  if (priceId.includes("AGENCY"))
    return { plan: "agency", propertyLimit: 200, seatLimit: 10 };
  return { plan: "free", propertyLimit: 2, seatLimit: 1 };
}

// Plan prices for reference (in EUR)
export const PLAN_PRICES = {
  free: 0,
  solo: 4.99,
  pro: 9.99,
  agency: 19.99,
};

export async function createCheckoutSession(
  data: any,
  context: functions.https.CallableContext
) {
  const { orgId, priceId, successUrl, cancelUrl } = data;

  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }
  if (!orgId || !priceId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "orgId and priceId are required"
    );
  }

  const orgRef = getDb().collection("orgs").doc(orgId);
  const orgSnap = await orgRef.get();
  const org = orgSnap.data() || {};

  let customerId = org.stripeCustomerId as string | undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({ metadata: { orgId } });
    customerId = customer.id;
    await orgRef.set({ stripeCustomerId: customerId }, { merge: true });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    customer: customerId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
  });

  return { url: session.url };
}

export async function stripeWebhook(
  req: functions.https.Request,
  res: functions.Response
) {
  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;

  try {
    // Firebase Functions provides rawBody
    const body = (req as any).rawBody;
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("Webhook signature failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerId = session.customer as string;
    if (!session.subscription) {
      res.status(200).send("OK");
      return;
    }
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0].price.id;
    const status = subscription.status;
    const customer = (await stripe.customers.retrieve(
      customerId
    )) as Stripe.Customer;
    const orgId = customer.metadata?.orgId;
    if (orgId) {
      const limits = mapPrice(priceId);
      await getDb().collection("orgs").doc(orgId).set(
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
    const sub = event.data.object as Stripe.Subscription;
    const priceId = sub.items.data[0].price.id;
    const status = sub.status;
    const customer = (await stripe.customers.retrieve(
      sub.customer as string
    )) as Stripe.Customer;
    const orgId = customer.metadata?.orgId;
    if (orgId) {
      const limits = mapPrice(priceId);
      await getDb().collection("orgs").doc(orgId).set(
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
    const sub = event.data.object as Stripe.Subscription;
    const customer = (await stripe.customers.retrieve(
      sub.customer as string
    )) as Stripe.Customer;
    const orgId = customer.metadata?.orgId;
    if (orgId) {
      await getDb().collection("orgs").doc(orgId).set(
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
}
