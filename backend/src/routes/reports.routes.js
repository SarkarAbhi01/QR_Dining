const router = require("express").Router();
const ctrl = require("../controllers/reports.controller");
const { requireAuth, requireRole, enforceTenant } = require("../middleware/auth");

const staffOnly = requireRole("RESTAURANT_ADMIN", "MANAGER", "SUPER_ADMIN");

router.get("/restaurants/:restaurantId/reports/summary", requireAuth, staffOnly, enforceTenant, ctrl.getSummary);
router.get("/restaurants/:restaurantId/reports/series", requireAuth, staffOnly, enforceTenant, ctrl.getSeries);
router.get("/restaurants/:restaurantId/reports/download", requireAuth, staffOnly, enforceTenant, ctrl.downloadCsv);

module.exports = router;
