const bcrypt = require("bcryptjs");
const prisma = require("../config/db");

/** POST /api/restaurants — Super Admin onboards a new hotel/restaurant/dhaba */
async function createRestaurant(req, res) {
  const { name, address, phone, adminName, adminEmail, adminPassword, subscriptionPlan } = req.body;

  const slug = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const restaurant = await prisma.restaurant.create({
    data: {
      name,
      slug: `${slug}-${Date.now().toString().slice(-5)}`,
      address,
      phone,
      subscriptionPlan: subscriptionPlan || "TRIAL",
      subscriptionStatus: "ACTIVE",
      subscriptionEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
    },
  });

  const hashed = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.user.create({
    data: {
      name: adminName,
      email: adminEmail,
      password: hashed,
      role: "RESTAURANT_ADMIN",
      restaurantId: restaurant.id,
    },
  });

  res.status(201).json({ restaurant, admin: { id: admin.id, email: admin.email, name: admin.name } });
}

/** GET /api/restaurants — Super Admin: list every tenant on the platform */
async function listRestaurants(req, res) {
  const restaurants = await prisma.restaurant.findMany({
    include: { _count: { select: { orders: true, users: true, tables: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(restaurants);
}

/** GET /api/restaurants/:id */
async function getRestaurant(req, res) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: req.params.id } });
  if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });
  res.json(restaurant);
}

/** PATCH /api/restaurants/:id/subscription — Super Admin updates plan/status */
async function updateSubscription(req, res) {
  const { subscriptionPlan, subscriptionStatus, subscriptionEndsAt } = req.body;
  const restaurant = await prisma.restaurant.update({
    where: { id: req.params.id },
    data: { subscriptionPlan, subscriptionStatus, subscriptionEndsAt },
  });
  res.json(restaurant);
}

/** GET /api/restaurants/:id/analytics — platform-wide revenue view for Super Admin */
async function platformAnalytics(req, res) {
  const [totalRestaurants, activeSubs, totalOrders, revenueAgg] = await Promise.all([
    prisma.restaurant.count(),
    prisma.restaurant.count({ where: { subscriptionStatus: "ACTIVE" } }),
    prisma.order.count(),
    prisma.order.aggregate({ where: { paymentStatus: "PAID" }, _sum: { totalAmount: true } }),
  ]);

  res.json({
    totalRestaurants,
    activeSubscriptions: activeSubs,
    totalOrders,
    totalRevenue: revenueAgg._sum.totalAmount || 0,
  });
}

/** GET /api/restaurants/:restaurantId/dashboard — restaurant-level analytics for Restaurant Admin */
async function restaurantDashboard(req, res) {
  const { restaurantId } = req.params;

  const [todayOrders, revenueAgg, bestSellers, tableWiseRevenue] = await Promise.all([
    prisma.order.count({
      where: { restaurantId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
    prisma.order.aggregate({
      where: { restaurantId, paymentStatus: "PAID" },
      _sum: { totalAmount: true },
    }),
    prisma.orderItem.groupBy({
      by: ["menuItemId"],
      where: { order: { restaurantId } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    prisma.order.groupBy({
      by: ["tableId"],
      where: { restaurantId, paymentStatus: "PAID" },
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 5,
    }),
  ]);

  res.json({
    todayOrders,
    totalRevenue: revenueAgg._sum.totalAmount || 0,
    bestSellers,
    topTables: tableWiseRevenue,
  });
}

module.exports = {
  createRestaurant,
  listRestaurants,
  getRestaurant,
  updateSubscription,
  platformAnalytics,
  restaurantDashboard,
};
