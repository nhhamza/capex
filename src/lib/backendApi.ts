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
