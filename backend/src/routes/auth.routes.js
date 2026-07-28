const router = require("express").Router();
const { login, createStaff, me, changePassword } = require("../controllers/auth.controller");
const { requireAuth, requireRole } = require("../middleware/auth");

router.post("/login", login);
router.get("/me", requireAuth, me);
router.patch("/change-password", requireAuth, changePassword);
router.post(
  "/staff",
  requireAuth,
  requireRole("RESTAURANT_ADMIN", "SUPER_ADMIN"),
  createStaff
);

module.exports = router;
