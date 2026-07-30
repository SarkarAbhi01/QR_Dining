const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../config/db");

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, restaurantId: user.restaurantId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function sanitize(user) {
  const { password, ...safe } = user;
  return safe;
}

/** POST /api/auth/login — used by all staff roles (Super Admin -> Waiter) */
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = signToken(user);
  res.json({ token, user: sanitize(user) });
}

/**
 * POST /api/auth/staff — create Manager/Chef/Waiter accounts.
 * Only a Restaurant Admin (or Super Admin) can create staff, and only
 * within their own restaurant (tenant isolation enforced here).
 */
async function createStaff(req, res) {
  const { name, email, password, phone, role } = req.body;
  const allowedRoles = ["MANAGER", "CHEF", "WAITER"];

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ message: "Role must be MANAGER, CHEF, or WAITER" });
  }

  const restaurantId = req.user.role === "SUPER_ADMIN" ? req.body.restaurantId : req.user.restaurantId;
  if (!restaurantId) {
    return res.status(400).json({ message: "restaurantId is required" });
  }

  const hashed = await bcrypt.hash(password, 10);
  const staff = await prisma.user.create({
    data: { name, email, password: hashed, phone, role, restaurantId },
  });

  res.status(201).json(sanitize(staff));
}

/** GET /api/auth/me */
async function me(req, res) {
  res.json(sanitize(req.user));
}

/**
 * PATCH /api/auth/change-password — any logged-in staff member (Super Admin,
 * Restaurant Admin, Manager, Chef, Waiter) can change their own password.
 * Requires the current password for verification.
 */
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Current and new password are required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: "New password must be at least 6 characters" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    return res.status(401).json({ message: "Current password is incorrect" });
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

  res.json({ message: "Password updated successfully" });
}

/**
 * GET /api/auth/staff — Restaurant Admin/Manager sees their own team;
 * Super Admin can pass ?restaurantId= to inspect any restaurant's staff.
 */
async function listStaff(req, res) {
  const restaurantId = req.user.role === "SUPER_ADMIN" ? req.query.restaurantId : req.user.restaurantId;
  if (!restaurantId) {
    return res.status(400).json({ message: "restaurantId is required" });
  }

  const staff = await prisma.user.findMany({
    where: { restaurantId, role: { in: ["RESTAURANT_ADMIN", "MANAGER", "CHEF", "WAITER"] } },
    orderBy: { createdAt: "desc" },
  });

  res.json(staff.map(sanitize));
}

/** PATCH /api/auth/staff/:id/toggle — activate/deactivate a staff account */
async function toggleStaffActive(req, res) {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ message: "Staff member not found" });

  // Tenant isolation: only that restaurant's own admin (or Super Admin) can toggle
  if (req.user.role !== "SUPER_ADMIN" && target.restaurantId !== req.user.restaurantId) {
    return res.status(403).json({ message: "Cross-restaurant access denied" });
  }
  if (target.role === "RESTAURANT_ADMIN" && req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ message: "Only the platform can deactivate a Restaurant Admin" });
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { isActive: !target.isActive },
  });
  res.json(sanitize(updated));
}

module.exports = { login, createStaff, me, changePassword, listStaff, toggleStaffActive };
