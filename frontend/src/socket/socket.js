import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

if (import.meta.env.PROD && !import.meta.env.VITE_SOCKET_URL) {
  console.error(
    "[QR Dining] VITE_SOCKET_URL is not set — real-time order tracking will " +
      "not work. Set VITE_SOCKET_URL to your live backend URL and rebuild."
  );
}

// One shared socket connection for the whole app (admin/kitchen/waiter/customer).
export const socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ["websocket", "polling"],
});
