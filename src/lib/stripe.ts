import { loadStripe, Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      console.error("Missing VITE_STRIPE_PUBLISHABLE_KEY");
      return null;
    }
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

export const PLAN_PRICE_IDS = {
  solo: import.meta.env.VITE_STRIPE_SOLO_PRICE_ID || "price_solo",
  pro: import.meta.env.VITE_STRIPE_PRO_PRICE_ID || "price_pro",
  agency: import.meta.env.VITE_STRIPE_AGENCY_PRICE_ID || "price_agency",
};
