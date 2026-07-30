const prisma = require("../config/db");

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * GET /api/restaurants/:restaurantId/reports/summary
 * Answers "kitne order aaj the, kitne kal the" — today vs yesterday,
 * plus a running total, straight from the orders table.
 */
async function getSummary(req, res) {
  const { restaurantId } = req.params;
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const [todayOrders, todayRevenue, yesterdayOrders, yesterdayRevenue, statusBreakdown] = await Promise.all([
    prisma.order.count({
      where: { restaurantId, createdAt: { gte: startOfDay(today), lte: endOfDay(today) } },
    }),
    prisma.order.aggregate({
      where: { restaurantId, paymentStatus: "PAID", createdAt: { gte: startOfDay(today), lte: endOfDay(today) } },
      _sum: { totalAmount: true },
    }),
    prisma.order.count({
      where: { restaurantId, createdAt: { gte: startOfDay(yesterday), lte: endOfDay(yesterday) } },
    }),
    prisma.order.aggregate({
      where: { restaurantId, paymentStatus: "PAID", createdAt: { gte: startOfDay(yesterday), lte: endOfDay(yesterday) } },
      _sum: { totalAmount: true },
    }),
    prisma.order.groupBy({
      by: ["status"],
      where: { restaurantId, createdAt: { gte: startOfDay(today), lte: endOfDay(today) } },
      _count: { status: true },
    }),
  ]);

  res.json({
    today: { orders: todayOrders, revenue: todayRevenue._sum.totalAmount || 0 },
    yesterday: { orders: yesterdayOrders, revenue: yesterdayRevenue._sum.totalAmount || 0 },
    statusBreakdown: statusBreakdown.map((s) => ({ status: s.status, count: s._count.status })),
  });
}

/**
 * GET /api/restaurants/:restaurantId/reports/series?days=7
 * Day-by-day order count + revenue for the last N days, oldest first —
 * enough to draw a simple trend without needing a heavier analytics stack.
 */
async function getSeries(req, res) {
  const { restaurantId } = req.params;
  const days = Math.min(Number(req.query.days) || 7, 31);

  const results = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    const [orders, revenue] = await Promise.all([
      prisma.order.count({
        where: { restaurantId, createdAt: { gte: startOfDay(day), lte: endOfDay(day) } },
      }),
      prisma.order.aggregate({
        where: { restaurantId, paymentStatus: "PAID", createdAt: { gte: startOfDay(day), lte: endOfDay(day) } },
        _sum: { totalAmount: true },
      }),
    ]);
    results.push({
      date: startOfDay(day).toISOString().slice(0, 10),
      orders,
      revenue: revenue._sum.totalAmount || 0,
    });
  }

  res.json(results);
}

/**
 * GET /api/restaurants/:restaurantId/reports/download?from=&to=
 * CSV export of every order in range — gated behind `canDownloadReports`,
 * a flag only the Super Admin can flip. Restaurant Admins otherwise get a
 * clear 403 explaining who to contact, instead of a silent failure.
 */
async function downloadCsv(req, res) {
  const { restaurantId } = req.params;

  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

  if (!restaurant.canDownloadReports) {
    return res.status(403).json({
      message: "Report downloads are not enabled for your account. Ask the platform admin (Super Admin) to enable this.",
    });
  }

  const from = req.query.from ? startOfDay(req.query.from) : startOfDay(new Date());
  const to = req.query.to ? endOfDay(req.query.to) : endOfDay(new Date());

  const orders = await prisma.order.findMany({
    where: { restaurantId, createdAt: { gte: from, lte: to } },
    include: { table: true, items: { include: { menuItem: true } } },
    orderBy: { createdAt: "asc" },
  });

  const rows = [
    ["Order ID", "Date", "Table", "Customer", "Items", "Subtotal", "GST", "Discount", "Total", "Status", "Payment Status", "Payment Mode"],
  ];
  orders.forEach((o) => {
    rows.push([
      o.id,
      o.createdAt.toISOString(),
      o.table.tableNumber,
      o.customerName,
      o.items.map((i) => `${i.quantity}x ${i.menuItem.name}`).join(" | "),
      o.subtotal,
      o.gstAmount,
      o.discount,
      o.totalAmount,
      o.status,
      o.paymentStatus,
      o.paymentMode || "",
    ]);
  });

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="orders-report-${restaurantId}.csv"`);
  res.send(csv);
}

module.exports = { getSummary, getSeries, downloadCsv };
