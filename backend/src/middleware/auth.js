const jwt = require("jsonwebtoken");
const prisma = require("../config/db");

/**
 * Verifies the JWT and attaches the authenticated user to req.user.
 * Staff (Admin/Manager/Chef/Waiter/SuperAdmin) routes only — customers
 * never need to log in, so they never hit this middleware.
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.split(" ")[1] : null;

    if (!token) {
      return res.status(401).json({ message: "Authentication token missing" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid or inactive account" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

/**
 * Restricts a route to a set of platform roles.
 * Usage: requireRole("SUPER_ADMIN", "RESTAURANT_ADMIN")
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to perform this action" });
    }
    next();
  };
}

/**
 * Ensures staff can only touch data belonging to their own restaurant
 * (tenant isolation). Super Admin bypasses this check.
 */
function enforceTenant(req, res, next) {
  if (req.user.role === "SUPER_ADMIN") return next();

  const paramRestaurantId = req.params.restaurantId || req.body.restaurantId;
  if (paramRestaurantId && paramRestaurantId !== req.user.restaurantId) {
    return res.status(403).json({ message: "Cross-restaurant access denied" });
  }
  next();
}

module.exports = { requireAuth, requireRole, enforceTenant };
