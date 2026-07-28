const router = require("express").Router();
const ctrl = require("../controllers/menu.controller");
const { requireAuth, requireRole, enforceTenant } = require("../middleware/auth");

const staffOnly = requireRole("RESTAURANT_ADMIN", "MANAGER", "SUPER_ADMIN");

router.post("/restaurants/:restaurantId/categories", requireAuth, staffOnly, enforceTenant, ctrl.createCategory);
router.get("/restaurants/:restaurantId/categories", ctrl.listCategories); // public: menu browsing

router.post("/restaurants/:restaurantId/menu-items", requireAuth, staffOnly, enforceTenant, ctrl.createMenuItem);
router.get("/restaurants/:restaurantId/menu-items", ctrl.listMenuItems); // public: menu browsing

router.patch("/menu-items/:id", requireAuth, staffOnly, ctrl.updateMenuItem);
router.patch("/menu-items/:id/availability", requireAuth, staffOnly, ctrl.toggleAvailability);
router.delete("/menu-items/:id", requireAuth, staffOnly, ctrl.deleteMenuItem);

module.exports = router;
