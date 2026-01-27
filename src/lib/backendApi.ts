import axios from "axios";
import { auth } from "@/firebase/client";

const baseURL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

export const backendApi = axios.create({
  baseURL,
  // Increase timeout for Vercel cold starts (15 seconds)
  timeout: 30000,
});

backendApi.interceptors.request.use(
  async (config) => {
    // Wait for auth to initialize if needed
    const user = auth.currentUser;

    if (!user) {
      // If no user, check if we're still initializing auth
      // Wait a bit for auth to initialize
      await new Promise((resolve) => setTimeout(resolve, 100));
      const retryUser = auth.currentUser;

      if (!retryUser) {
        // Still no user - this is likely a truly unauthenticated request
        // Don't add Authorization header for public endpoints
        return config;
      }

      // User is now available, get token (force refresh to avoid expired tokens)
      try {
        const token = await retryUser.getIdToken(true); // true = force refresh
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      } catch (err) {
        console.error("[backendApi] Failed to get token:", err);
        // Continue without token - backend will reject if needed
      }
      return config;
    }

    // User is available, get token (force refresh if token is stale)
    try {
      // Check if token is about to expire (within 5 minutes)
      const tokenResult = await user.getIdTokenResult();
      const expirationTime = new Date(tokenResult.expirationTime).getTime();
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      // Force refresh if token expires soon
      const forceRefresh = expirationTime - now < fiveMinutes;

      const token = await user.getIdToken(forceRefresh);
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    } catch (err) {
      console.error("[backendApi] Failed to get token:", err);
      // Try one more time without force refresh as fallback
      try {
        const token = await user.getIdToken();
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      } catch (fallbackErr) {
        console.error(
          "[backendApi] Fallback token fetch also failed:",
          fallbackErr,
        );
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

backendApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 403 &&
      error.response?.data?.error === "billing_blocked"
    ) {
      sessionStorage.setItem(
        "billing_blocked_payload",
        JSON.stringify(error.response.data),
      );
      window.location.assign("/blocked");
    }
    return Promise.reject(error);
  },
);
