/**
 * Real-time layer for the dining system.
 *
 * Rooms:
 *  - `restaurant:<id>`        -> admin dashboard, POS, table overview
 *  - `restaurant:<id>:kitchen`-> Kitchen Display System (KDS)
 *  - `restaurant:<id>:waiter` -> waiter floor app
 *  - `order:<id>`             -> the customer tracking that specific order
 *
 * Every order-lifecycle change is broadcast to the relevant rooms so
 * every screen (customer / kitchen / waiter / admin) updates instantly.
 */

let ioInstance = null;

function initSockets(io) {
  ioInstance = io;

  io.on("connection", (socket) => {
    socket.on("join:restaurant", (restaurantId) => {
      socket.join(`restaurant:${restaurantId}`);
    });

    socket.on("join:kitchen", (restaurantId) => {
      socket.join(`restaurant:${restaurantId}:kitchen`);
    });

    socket.on("join:waiter", (restaurantId) => {
      socket.join(`restaurant:${restaurantId}:waiter`);
    });

    socket.on("join:order", (orderId) => {
      socket.join(`order:${orderId}`);
    });

    socket.on("disconnect", () => {
      // no-op: rooms are cleaned up automatically by socket.io
    });
  });
}

function getIO() {
  if (!ioInstance) throw new Error("Socket.io has not been initialized yet");
  return ioInstance;
}

/** Broadcast a brand-new order to admin + kitchen (triggers beep/notification). */
function emitNewOrder(restaurantId, order) {
  getIO().to(`restaurant:${restaurantId}`).emit("order:new", order);
  getIO().to(`restaurant:${restaurantId}:kitchen`).emit("order:new", order);
}

/** Broadcast a status transition (Accepted / Cooking / Ready / Served / Completed). */
function emitOrderStatusUpdate(restaurantId, order) {
  getIO().to(`restaurant:${restaurantId}`).emit("order:status", order);
  getIO().to(`restaurant:${restaurantId}:kitchen`).emit("order:status", order);
  getIO().to(`restaurant:${restaurantId}:waiter`).emit("order:status", order);
  getIO().to(`order:${order.id}`).emit("order:status", order);
}

/** "Call Waiter" button press from the customer screen. */
function emitWaiterCall(restaurantId, payload) {
  getIO().to(`restaurant:${restaurantId}:waiter`).emit("waiter:call", payload);
  getIO().to(`restaurant:${restaurantId}`).emit("waiter:call", payload);
}

/** Bill generated / payment marked paid — refreshes POS + customer screen. */
function emitPaymentUpdate(restaurantId, order) {
  getIO().to(`restaurant:${restaurantId}`).emit("order:payment", order);
  getIO().to(`order:${order.id}`).emit("order:payment", order);
}

module.exports = {
  initSockets,
  getIO,
  emitNewOrder,
  emitOrderStatusUpdate,
  emitWaiterCall,
  emitPaymentUpdate,
};
