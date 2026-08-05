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
 * A table's whole dining session can be more than one Order row: the
 * original order plus any "Add More Items" sub-orders placed afterwards.
 * Every sub-order links directly to the ORIGINAL (root) order via
 * parentOrderId — never to each other — so resolving "which session does
 * this order belong to" is always a single hop, no recursion needed.
 */
function rootIdOf(order) {
  return order.parentOrderId || order.id;
}

/**
 * Builds the full customer-facing / billing view of a session: the root
 * order's own items plus every sub-order (each with its own independent
 * kitchen status), and a combined running total across all of them.
 * This combined total is what "Final Bill = Main Order + Sub Order(s)"
 * means in practice — computed live until a bill is actually generated.
 */
async function buildSessionView(rootOrderId) {
  const root = await prisma.order.findUnique({
    where: { id: rootOrderId },
    include: { items: { include: { menuItem: true } }, table: true },
  });
  if (!root) return null;

  const childOrders = await prisma.order.findMany({
    where: { parentOrderId: rootOrderId },
    include: { items: { include: { menuItem: true } } },
    orderBy: { createdAt: "asc" },
  });

  const liveSubtotal = childOrders.reduce((sum, c) => sum + Number(c.subtotal), Number(root.subtotal));
  const liveGst = childOrders.reduce((sum, c) => sum + Number(c.gstAmount), Number(root.gstAmount));
  const liveTotal = Number((liveSubtotal + liveGst - Number(root.discount)).toFixed(2));

  return {
    ...root,
    childOrders,
    session: {
      subtotal: liveSubtotal,
      gstAmount: liveGst,
      discount: Number(root.discount),
      // Once paid, root.totalAmount is the frozen, final billed amount;
      // before that, keep showing the live running total as items are added.
      totalAmount: root.paymentStatus === "PAID" ? Number(root.totalAmount) : liveTotal,
    },
  };
}

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

/**
 * POST /api/public/orders/:id/add-items — the "Add More Items" flow.
 * :id is whatever order the customer is currently tracking (always the
 * root in normal use). Creates a brand-new sub-order — its own kitchen
 * ticket with its own Accept → Cooking → Ready → Served cycle — linked
 * back to the root so it bills as one combined session.
 */
async function addItemsToOrder(req, res) {
  const { items } = req.body;
  if (!items || items.length === 0) {
    return res.status(400).json({ message: "No items provided" });
  }

  const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Order not found" });

  const rootId = rootIdOf(existing);
  const root = await prisma.order.findUnique({ where: { id: rootId } });
  if (!root) return res.status(404).json({ message: "Order not found" });

  if (root.paymentStatus === "PAID") {
    return res.status(400).json({
      message: "This order has already been billed and paid. Please place a fresh order for more items.",
    });
  }

  const restaurant = await prisma.restaurant.findUnique({ where: { id: root.restaurantId } });
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const gstAmount = Number(((subtotal * Number(restaurant.gstPercent)) / 100).toFixed(2));
  const totalAmount = Number((subtotal + gstAmount).toFixed(2));

  const subOrder = await prisma.order.create({
    data: {
      restaurantId: root.restaurantId,
      tableId: root.tableId,
      customerName: root.customerName,
      customerPhone: root.customerPhone,
      parentOrderId: rootId,
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
          notes: i.notes || null,
        })),
      },
    },
    include: { items: { include: { menuItem: true } }, table: true },
  });

  // Kitchen/Waiter/Admin see this exactly like a fresh incoming order —
  // it needs its own Accept/Cook/Serve just like the original.
  emitNewOrder(root.restaurantId, subOrder);

  const session = await buildSessionView(rootId);
  res.status(201).json(session);
}

/** GET /api/public/orders/:id — customer live-tracking polling/fallback endpoint */
async function getOrderPublic(req, res) {
  const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Order not found" });

  const session = await buildSessionView(rootIdOf(existing));
  res.json(session);
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
  // parentOrderId is included automatically (it's a plain scalar column) —
  // the frontend uses it to badge sub-orders as "Add-on" tickets.
  res.json(orders);
}

/**
 * PATCH /api/orders/:id/status — drives steps 2-4 of the workflow:
 * Accepted -> Cooking -> Ready -> Served -> Completed. Works identically
 * for a root order or a sub-order — each has its own independent status.
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
  if (status === "COMPLETED" && !order.parentOrderId) {
    // Only freeing the table when the ROOT order completes — a sub-order
    // finishing shouldn't vacate a table that's still mid-session.
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
 * digital bill / POS invoice for the WHOLE session (main order + every
 * sub-order), applying GST + any discount, then freezing that total onto
 * the root order.
 */
async function generateBill(req, res) {
  const { discount = 0 } = req.body;
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ message: "Order not found" });
  const rootId = rootIdOf(order);

  const root = await prisma.order.findUnique({ where: { id: rootId } });
  const childOrders = await prisma.order.findMany({ where: { parentOrderId: rootId } });

  const combinedSubtotal = childOrders.reduce((sum, c) => sum + Number(c.subtotal), Number(root.subtotal));
  const combinedGst = childOrders.reduce((sum, c) => sum + Number(c.gstAmount), Number(root.gstAmount));
  const totalAmount = Number((combinedSubtotal + combinedGst - Number(discount)).toFixed(2));

  await prisma.order.update({
    where: { id: rootId },
    data: { discount, totalAmount },
  });

  const session = await buildSessionView(rootId);
  res.json(session);
}

/**
 * POST /api/orders/:id/pay — marks the WHOLE session Paid (root order,
 * covering itself + every sub-order), either via online gateway callback
 * (mode=ONLINE/UPI) or the manager's POS screen (mode=CASH).
 */
async function markPaid(req, res) {
  const { mode, gatewayRef } = req.body;
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ message: "Order not found" });
  const rootId = rootIdOf(order);

  const updated = await prisma.order.update({
    where: { id: rootId },
    data: { paymentStatus: "PAID", paymentMode: mode },
    include: { items: { include: { menuItem: true } }, table: true },
  });

  await prisma.payment.create({
    data: {
      orderId: rootId,
      restaurantId: updated.restaurantId,
      amount: updated.totalAmount,
      mode,
      status: "PAID",
      gatewayRef: gatewayRef || null,
    },
  });

  emitPaymentUpdate(updated.restaurantId, updated);
  res.json(await buildSessionView(rootId));
}

/**
 * POST /api/orders/:id/split — Bill Splitting preview across the WHOLE
 * session (main + sub-orders combined), not just this one order row.
 */
async function splitBill(req, res) {
  const { numberOfPeople } = req.body;
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (!numberOfPeople || numberOfPeople < 1) {
    return res.status(400).json({ message: "numberOfPeople must be at least 1" });
  }

  const session = await buildSessionView(rootIdOf(order));
  const perPerson = Number((session.session.totalAmount / numberOfPeople).toFixed(2));
  res.json({ totalAmount: session.session.totalAmount, numberOfPeople, perPerson });
}

/**
 * POST /api/public/orders/:id/payment-intent — customer picks how they'll
 * pay for the WHOLE session (root order covers itself + all sub-orders).
 *  - CASH: only allowed when the bill is NOT being split — doesn't mark
 *    paid, just flags intent and pings the floor staff to collect at the
 *    counter.
 *  - ONLINE: required whenever the customer has chosen to split the bill
 *    (splitCount > 1) — simulates a successful gateway payment and marks
 *    the whole session paid immediately. Swap for a real Razorpay/PhonePe
 *    order + webhook confirmation when you wire up a live gateway.
 */
async function customerPaymentIntent(req, res) {
  const { mode, splitCount } = req.body; // "CASH" | "ONLINE"
  if (!["CASH", "ONLINE"].includes(mode)) {
    return res.status(400).json({ message: "mode must be CASH or ONLINE" });
  }
  if (splitCount && Number(splitCount) > 1 && mode !== "ONLINE") {
    return res.status(400).json({ message: "Split-bill payments must be made online." });
  }

  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { table: true } });
  if (!order) return res.status(404).json({ message: "Order not found" });
  const rootId = rootIdOf(order);
  const root = rootId === order.id ? order : await prisma.order.findUnique({ where: { id: rootId }, include: { table: true } });

  if (root.paymentStatus === "PAID") {
    return res.status(400).json({ message: "This order is already paid" });
  }

  if (mode === "CASH") {
    const updated = await prisma.order.update({
      where: { id: rootId },
      data: { paymentMode: "CASH" },
      include: { items: { include: { menuItem: true } }, table: true },
    });
    emitWaiterCall(root.restaurantId, {
      orderId: rootId,
      tableNumber: root.table.tableNumber,
      reason: `Ready to pay ₹${updated.totalAmount} in cash`,
      at: new Date(),
    });
    return res.json(await buildSessionView(rootId));
  }

  // mode === "ONLINE" — simulated gateway success, bills the full session
  const session = await buildSessionView(rootId);
  const updated = await prisma.order.update({
    where: { id: rootId },
    data: {
      paymentStatus: "PAID",
      paymentMode: "ONLINE",
      totalAmount: session.session.totalAmount,
    },
    include: { items: { include: { menuItem: true } }, table: true },
  });
  await prisma.payment.create({
    data: {
      orderId: rootId,
      restaurantId: root.restaurantId,
      amount: updated.totalAmount,
      mode: "ONLINE",
      status: "PAID",
      gatewayRef: `SIMULATED-${Date.now()}`,
    },
  });
  emitPaymentUpdate(root.restaurantId, updated);
  res.json(await buildSessionView(rootId));
}

module.exports = {
  placeOrder,
  addItemsToOrder,
  getOrderPublic,
  listOrders,
  updateOrderStatus,
  callWaiter,
  generateBill,
  markPaid,
  splitBill,
  customerPaymentIntent,
};
