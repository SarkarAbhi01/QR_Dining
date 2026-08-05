const router = require("express").Router();
const ctrl = require("../controllers/order.controller");
const { requireAuth, requireRole } = require("../middleware/auth");

// ----- Public (Customer, no login) -----
router.post("/public/orders", ctrl.placeOrder);
router.get("/public/orders/:id", ctrl.getOrderPublic);
router.post("/public/orders/:id/add-items", ctrl.addItemsToOrder);
router.post("/public/orders/:id/call-waiter", ctrl.callWaiter);
router.post("/public/orders/:id/payment-intent", ctrl.customerPaymentIntent);

// ----- Staff (Admin / Manager / Chef / Waiter) -----
router.get("/restaurants/:restaurantId/orders", requireAuth, ctrl.listOrders);

router.patch(
  "/orders/:id/status",
  requireAuth,
  requireRole("RESTAURANT_ADMIN", "MANAGER", "CHEF", "WAITER", "SUPER_ADMIN"),
  ctrl.updateOrderStatus
);

router.post(
  "/orders/:id/bill",
  requireAuth,
  requireRole("RESTAURANT_ADMIN", "MANAGER", "WAITER", "SUPER_ADMIN"),
  ctrl.generateBill
);

router.post(
  "/orders/:id/pay",
  requireAuth,
  requireRole("RESTAURANT_ADMIN", "MANAGER", "WAITER", "SUPER_ADMIN"),
  ctrl.markPaid
);

router.post("/orders/:id/split", ctrl.splitBill); // usable by customer screen too

module.exports = router;
