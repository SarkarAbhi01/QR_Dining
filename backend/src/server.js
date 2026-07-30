require("dotenv").config();
require("express-async-errors");

const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { Server } = require("socket.io");

const { initSockets } = require("./sockets");

const authRoutes = require("./routes/auth.routes");
const restaurantRoutes = require("./routes/restaurant.routes");
const tableRoutes = require("./routes/table.routes");
const menuRoutes = require("./routes/menu.routes");
const orderRoutes = require("./routes/order.routes");
const reportsRoutes = require("./routes/reports.routes");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || "*", methods: ["GET", "POST", "PATCH", "DELETE"] },
});
initSockets(io);

// ------------------ Global middleware ------------------
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json({ limit: "5mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ------------------ Health check ------------------
app.get("/api/health", (req, res) => res.json({ status: "ok", service: "qr-dining-backend" }));

// ------------------ Routes ------------------
app.use("/api/auth", authRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api", tableRoutes); // /api/tables/... and /api/restaurants/:id/tables
app.use("/api", menuRoutes); // /api/restaurants/:id/categories, /menu-items
app.use("/api", orderRoutes); // /api/public/orders, /api/orders/:id/...
app.use("/api", reportsRoutes); // /api/restaurants/:id/reports/...

// ------------------ 404 handler ------------------
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// ------------------ Global error handler ------------------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    message: err.message || "Something went wrong on the server",
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🍽️  QR Dining backend running on port ${PORT}`);
});
