const prisma = require("../config/db");
const {
  emitNewOrder,
  emitOrderStatusUpdate,
  emitWaiterCall,
  emitPaymentUpdate,
} = require("../sockets");

const VALID_TRANSITIONS = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["COOKING", "CANCELLED"],
  COOKING: ["READY"],
  READY: ["SERVED"],
  SERVED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * POST /api/public/orders — placed by the customer straight from the
 * QR digital menu. No login required, matching the "no app" requirement.
 * Step 1 of the live tracking workflow: Placed.
 */
async function placeOrder(req, res) {
  const { qrToken, customerName, customerPhone, items, notes } = req.body;
  // items: [{ menuItemId, variantLabel, quantity, price, notes }]

  if (!items || items.length === 0) {
    return res.status(400).json({ message: "Cart is empty" });
  }

  const table = await prisma.restaurantTable.findUnique({ where: { qrToken } });
  if (!table) return res.status(404).json({ message: "Invalid table QR code" });

  const restaurant = await prisma.restaurant.findUnique({ where: { id: table.restaurantId } });
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const gstAmount = Number(((subtotal * Number(restaurant.gstPercent)) / 100).toFixed(2));
  const totalAmount = Number((subtotal + gstAmount).toFixed(2));

  const order = await prisma.order.create({
    data: {
      restaurantId: table.restaurantId,
      tableId: table.id,
      customerName,
      customerPhone,
      subtotal,
      gstAmount,
      totalAmount,
      status: "PENDING",
      items: {
        create: items.map((i) => ({
          menuItemId: i.menuItemId,
          variantLabel: i.variantLabel || null,
          quantity: i.quantity,
          price: i.price,
          notes: i.notes || notes || null,
        })),
      },
    },
    include: { items: { include: { menuItem: true } }, table: true },
  });

  await prisma.restaurantTable.update({ where: { id: table.id }, data: { status: "OCCUPIED" } });

  emitNewOrder(table.restaurantId, order);
  res.status(201).json(order);
}

/** GET /api/public/orders/:id — customer live-tracking polling/fallback endpoint */
async function getOrderPublic(req, res) {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { menuItem: true } }, table: true },
  });
  if (!order) return res.status(404).json({ message: "Order not found" });
  res.json(order);
}

/** GET /api/restaurants/:restaurantId/orders — admin / KDS / waiter feed, filterable by status */
async function listOrders(req, res) {
  const { restaurantId } = req.params;
  const { status } = req.query;

  const orders = await prisma.order.findMany({
    where: { restaurantId, ...(status ? { status } : {}) },
    include: { items: { include: { menuItem: true } }, table: true },
    orderBy: { createdAt: "asc" }, // FIFO — oldest order first, exactly as the kitchen needs
  });
  res.json(orders);
}

/**
 * PATCH /api/orders/:id/status — drives steps 2-4 of the workflow:
 * Accepted -> Cooking -> Ready -> Served -> Completed.
 * Called by Waiter (Accept/Served), Chef (Cooking/Ready), or Manager.
 */
async function updateOrderStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return res.status(404).json({ message: "Order not found" });

  const allowedNext = VALID_TRANSITIONS[order.status] || [];
  if (!allowedNext.includes(status)) {
    return res.status(400).json({
      message: `Cannot move an order from ${order.status} to ${status}`,
    });
  }

  const data = { status };
  if (status === "ACCEPTED") data.acceptedById = req.user.id;
  if (status === "SERVED") data.servedById = req.user.id;
  if (status === "COMPLETED") {
    // freeing the table happens once the visit is fully wrapped up
    await prisma.restaurantTable.update({ where: { id: order.tableId }, data: { status: "VACANT" } });
  }

  const updated = await prisma.order.update({
    where: { id },
    data,
    include: { items: { include: { menuItem: true } }, table: true },
  });

  emitOrderStatusUpdate(order.restaurantId, updated);
  res.json(updated);
}

/** POST /api/public/orders/:id/call-waiter — the "Call Waiter" premium feature */
async function callWaiter(req, res) {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { table: true } });
  if (!order) return res.status(404).json({ message: "Order not found" });

  await prisma.order.update({ where: { id: order.id }, data: { waiterCallRequested: true } });

  emitWaiterCall(order.restaurantId, {
    orderId: order.id,
    tableNumber: order.table.tableNumber,
    reason: req.body.reason || "Assistance requested",
    at: new Date(),
  });

  res.json({ message: "Waiter has been notified" });
}

/**
 * POST /api/orders/:id/bill — Step 5 of the workflow: generate the
 * digital bill / POS invoice, applying GST + any discount.
 */
async function generateBill(req, res) {
  const { discount = 0 } = req.body;
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: true },
  });
  if (!order) return res.status(404).json({ message: "Order not found" });

  const totalAmount = Number((Number(order.subtotal) + Number(order.gstAmount) - discount).toFixed(2));

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { discount, totalAmount },
    include: { items: { include: { menuItem: true } }, table: true, restaurant: true },
  });

  res.json(updated);
}

/**
 * POST /api/orders/:id/pay — marks the bill Paid, either via online
 * gateway callback (mode=ONLINE/UPI) or the manager's POS screen (mode=CASH).
 */
async function markPaid(req, res) {
  const { mode, gatewayRef } = req.body;
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ message: "Order not found" });

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { paymentStatus: "PAID", paymentMode: mode },
    include: { items: { include: { menuItem: true } }, table: true },
  });

  await prisma.payment.create({
    data: {
      orderId: order.id,
      restaurantId: order.restaurantId,
      amount: order.totalAmount,
      mode,
      status: "PAID",
      gatewayRef: gatewayRef || null,
    },
  });

  emitPaymentUpdate(order.restaurantId, updated);
  res.json(updated);
}

/** POST /api/orders/:id/split — Bill Splitting premium feature (equal split preview) */
async function splitBill(req, res) {
  const { numberOfPeople } = req.body;
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (!numberOfPeople || numberOfPeople < 1) {
    return res.status(400).json({ message: "numberOfPeople must be at least 1" });
  }

  const perPerson = Number((Number(order.totalAmount) / numberOfPeople).toFixed(2));
  res.json({ totalAmount: order.totalAmount, numberOfPeople, perPerson });
}

module.exports = {
  placeOrder,
  getOrderPublic,
  listOrders,
  updateOrderStatus,
  callWaiter,
  generateBill,
  markPaid,
  splitBill,
};
