/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID: string;
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_CHECKOUT_SUCCESS_URL?: string;
  readonly VITE_CHECKOUT_CANCEL_URL?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly VITE_STRIPE_PRICE_SOLO?: string;
  readonly VITE_STRIPE_PRICE_PRO?: string;
  readonly VITE_STRIPE_PRICE_AGENCY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
