const prisma = require("../config/db");
const { generateTableQR } = require("../utils/qrGenerator");

/**
 * Works out which public URL the QR code should point to.
 *
 * This is the #1 cause of "QR scan opens the wrong / broken page in
 * production": CLIENT_URL in .env was left as http://localhost:5173
 * (or wasn't set at all) when the app was deployed, so every QR silently
 * baked in a URL only reachable from the developer's own laptop.
 *
 * Resolution order:
 *  1. An explicit `baseUrl` sent from the admin UI (used by "Regenerate QR"
 *     so a restaurant can fix this themselves without a redeploy).
 *  2. CLIENT_URL from the environment, as long as it isn't a localhost/
 *     private address (those are almost always a misconfiguration once
 *     the app is live).
 *  3. The Origin/Referer header of the request itself (the admin dashboard's
 *     own URL) — a reasonable last-resort guess in most single-domain setups.
 */
function resolveBaseUrl(req) {
  const candidate = req.body?.baseUrl || process.env.CLIENT_URL;
  const isLocal = (url) => !url || /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(url);

  if (candidate && !isLocal(candidate)) return candidate.replace(/\/+$/, "");

  const originHeader = req.headers.origin || req.headers.referer;
  if (originHeader && !isLocal(originHeader)) {
    return new URL(originHeader).origin;
  }

  // Nothing usable found — fall back to whatever was configured, but the
  // caller should surface a warning so the restaurant knows to fix it.
  return (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");
}

/** POST /api/restaurants/:restaurantId/tables — create a table + generate its QR */
async function createTable(req, res) {
  const { restaurantId } = req.params;
  const { tableNumber, capacity } = req.body;

  const table = await prisma.restaurantTable.create({
    data: { restaurantId, tableNumber, capacity: capacity || 4 },
  });

  const baseUrl = resolveBaseUrl(req);
  const { menuUrl, dataUrl } = await generateTableQR(baseUrl, table.qrToken);
  const updated = await prisma.restaurantTable.update({
    where: { id: table.id },
    data: { qrCodeUrl: dataUrl },
  });

  res.status(201).json({ ...updated, menuUrl });
}

/**
 * POST /api/tables/:id/regenerate-qr — re-creates a table's QR image against
 * a corrected domain. Use this after fixing CLIENT_URL, moving to a custom
 * domain, or switching from http to https, without deleting/recreating tables.
 */
async function regenerateQr(req, res) {
  const table = await prisma.restaurantTable.findUnique({ where: { id: req.params.id } });
  if (!table) return res.status(404).json({ message: "Table not found" });

  const baseUrl = resolveBaseUrl(req);
  const { menuUrl, dataUrl } = await generateTableQR(baseUrl, table.qrToken);

  const updated = await prisma.restaurantTable.update({
    where: { id: table.id },
    data: { qrCodeUrl: dataUrl },
  });

  res.json({ ...updated, menuUrl });
}

/** GET /api/restaurants/:restaurantId/tables */
async function listTables(req, res) {
  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId: req.params.restaurantId },
    orderBy: { tableNumber: "asc" },
  });
  res.json(tables);
}

/** PATCH /api/tables/:id — rename, resize, or manually change status */
async function updateTable(req, res) {
  const { tableNumber, capacity, status } = req.body;
  const table = await prisma.restaurantTable.update({
    where: { id: req.params.id },
    data: { tableNumber, capacity, status },
  });
  res.json(table);
}

/** DELETE /api/tables/:id */
async function deleteTable(req, res) {
  await prisma.restaurantTable.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

/**
 * GET /api/tables/resolve/:qrToken — public: resolves a scanned QR to
 * restaurant + table + menu, PLUS whether this table already has an
 * ongoing (unpaid) order session.
 *
 * This is what makes "order again without re-scanning, again and again,
 * until the table is freed by payment" actually safe: the check is on the
 * SERVER, keyed to the table itself — not just a button in one browser.
 * Whether the customer taps "Add More Items" in-app, or physically
 * re-scans the QR sticker on a completely different phone, they land on
 * the SAME session and everything bills together. The moment that root
 * order is marked PAID, it stops matching this lookup — the table is
 * "free" again and the next scan starts a brand-new session.
 */
async function resolveQrToken(req, res) {
  const table = await prisma.restaurantTable.findUnique({
    where: { qrToken: req.params.qrToken },
    include: {
      restaurant: {
        include: {
          categories: { orderBy: { sortOrder: "asc" } },
          menuItems: { where: { isAvailable: true } },
        },
      },
    },
  });

  if (!table) return res.status(404).json({ message: "Invalid or expired QR code" });
  if (table.restaurant.subscriptionStatus !== "ACTIVE") {
    return res.status(403).json({ message: "This restaurant's service is temporarily unavailable" });
  }

  const activeOrder = await prisma.order.findFirst({
    where: {
      tableId: table.id,
      parentOrderId: null, // only ROOT orders represent a session
      paymentStatus: { not: "PAID" },
      status: { not: "CANCELLED" },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, customerName: true, createdAt: true },
  });

  res.json({ ...table, activeOrder: activeOrder || null });
}

module.exports = { createTable, listTables, updateTable, deleteTable, resolveQrToken, regenerateQr };
