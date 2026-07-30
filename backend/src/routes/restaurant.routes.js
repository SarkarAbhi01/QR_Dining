const router = require("express").Router();
const ctrl = require("../controllers/restaurant.controller");
const { requireAuth, requireRole, enforceTenant } = require("../middleware/auth");

// Super Admin only — platform-wide tenant management
router.post("/", requireAuth, requireRole("SUPER_ADMIN"), ctrl.createRestaurant);
router.get("/", requireAuth, requireRole("SUPER_ADMIN"), ctrl.listRestaurants);
router.get("/platform/analytics", requireAuth, requireRole("SUPER_ADMIN"), ctrl.platformAnalytics);
router.patch("/:id/subscription", requireAuth, requireRole("SUPER_ADMIN"), ctrl.updateSubscription);
router.patch("/:id/report-permission", requireAuth, requireRole("SUPER_ADMIN"), ctrl.toggleReportPermission);

// Restaurant Admin (own tenant) or Super Admin
router.get("/:id", requireAuth, ctrl.getRestaurant);
router.get(
  "/:restaurantId/dashboard",
  requireAuth,
  requireRole("SUPER_ADMIN", "RESTAURANT_ADMIN", "MANAGER"),
  enforceTenant,
  ctrl.restaurantDashboard
);

module.exports = router;
