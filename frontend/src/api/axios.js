import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// If this build is running in production but VITE_API_URL was never set at
// build time, every request will silently target localhost — which only
// works on the machine that built/served it. Surface this loudly so it's
// caught immediately instead of showing up as a vague "Unable to load menu"
// error for real customers scanning the QR on their own phones.
if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  console.error(
    "[QR Dining] VITE_API_URL is not set — the app is falling back to " +
      "http://localhost:5000/api, which will NOT work for anyone except the " +
      "machine that built this app. Set VITE_API_URL to your live backend URL " +
      "and rebuild the frontend."
  );
}

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("qr_dining_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
