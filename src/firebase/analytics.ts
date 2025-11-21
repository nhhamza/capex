// Lazy Analytics initialization (optional; not required for Firestore)
// Loaded only when supported and in a browser context.
import { app } from "./client";

export async function initAnalytics() {
  if (typeof window === "undefined") return;
  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (await isSupported()) {
      getAnalytics(app);
      console.log("[Analytics] initialized");
    } else {
      console.warn("[Analytics] not supported");
    }
  } catch (e) {
    console.warn("[Analytics] init failed:", (e as any)?.message || e);
  }
}
