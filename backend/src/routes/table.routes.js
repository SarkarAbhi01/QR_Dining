const router = require("express").Router();
const ctrl = require("../controllers/table.controller");
const { requireAuth, requireRole, enforceTenant } = require("../middleware/auth");

// Public — customer scans QR, no login
router.get("/tables/resolve/:qrToken", ctrl.resolveQrToken);

// Restaurant Admin / Manager — table + QR management
router.post(
  "/restaurants/:restaurantId/tables",
  requireAuth,
  requireRole("RESTAURANT_ADMIN", "MANAGER", "SUPER_ADMIN"),
  enforceTenant,
  ctrl.createTable
);
router.get(
  "/restaurants/:restaurantId/tables",
  requireAuth,
  enforceTenant,
  ctrl.listTables
);
router.patch(
  "/tables/:id",
  requireAuth,
  requireRole("RESTAURANT_ADMIN", "MANAGER", "WAITER", "SUPER_ADMIN"),
  ctrl.updateTable
);
router.post(
  "/tables/:id/regenerate-qr",
  requireAuth,
  requireRole("RESTAURANT_ADMIN", "MANAGER", "SUPER_ADMIN"),
  ctrl.regenerateQr
);
router.delete(
  "/tables/:id",
  requireAuth,
  requireRole("RESTAURANT_ADMIN", "SUPER_ADMIN"),
  ctrl.deleteTable
);

module.exports = router;
