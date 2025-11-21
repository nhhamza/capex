import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { seedDatabase } from "@/mocks/seed";
import { setLogLevel } from "firebase/firestore";
import { Capacitor } from "@capacitor/core";
import { applyMobilePolish } from "./mobile";

// Apply mobile-specific polish (status bar, etc.)
if (Capacitor.isNativePlatform()) {
  applyMobilePolish();
}

// Seed the database with demo data
seedDatabase();
// Verbose Firestore logging (lite SDK) for debugging REST calls
setLogLevel("debug");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
