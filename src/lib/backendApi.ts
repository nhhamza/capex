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

backendApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 403 &&
      error.response?.data?.error === "billing_blocked"
    ) {
      sessionStorage.setItem(
        "billing_blocked_payload",
        JSON.stringify(error.response.data)
      );
      window.location.assign("/blocked");
    }
    return Promise.reject(error);
  }
);
