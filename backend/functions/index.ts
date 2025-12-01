import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { createCheckoutSession, stripeWebhook } from "./billing.js";
import { exportFirestoreData, scheduledBackup } from "./export.js";

// Firebase Functions emulator initializes admin automatically
// Only initialize in production if needed
try {
  if (!admin.apps || admin.apps.length === 0) {
    admin.initializeApp();
  }
} catch (error) {
  // Emulator already initialized it
  console.log("Admin already initialized");
}

// Billing functions
export const createCheckoutSessionFn = functions
  .region("us-central1")
  .https.onCall(createCheckoutSession);

export const stripeWebhookFn = functions
  .region("us-central1")
  .https.onRequest(stripeWebhook);

// Export/Backup functions
export const exportFirestoreDataFn = functions
  .region("us-central1")
  .https.onCall(exportFirestoreData);

export const scheduledBackupFn = functions
  .region("us-central1")
  .pubsub.schedule("0 2 * * *") // Daily at 2 AM UTC
  .timeZone("UTC")
  .onRun(scheduledBackup);
