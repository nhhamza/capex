import axios from "axios";
import { auth } from "@/firebase/client";

const baseURL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

export const backendApi = axios.create({
  baseURL,
});

backendApi.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for billing_blocked errors
backendApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403 && error.response?.data?.error === "billing_blocked") {
      // Store payload in sessionStorage
      sessionStorage.setItem("billing_blocked_payload", JSON.stringify(error.response.data));
      // Redirect to blocked page
      window.location.assign("/blocked");
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);
