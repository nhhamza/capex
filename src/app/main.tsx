import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Capacitor } from "@capacitor/core";
import { applyMobilePolish } from "./mobile";

// Apply mobile-specific polish (status bar, etc.)
if (Capacitor.isNativePlatform()) {
  applyMobilePolish();
}

// NOTE: demo seeding was removed to avoid client-side Firestore writes.

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element '#root' not found");
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
