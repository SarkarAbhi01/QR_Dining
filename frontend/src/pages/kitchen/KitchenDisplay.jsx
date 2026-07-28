import { useEffect, useState } from "react";
import api from "../../api/axios";
import { socket } from "../../socket/socket";
import { useAuth } from "../../context/AuthContext";
import StaffLayout from "../../components/layout/StaffLayout";

const NEXT_STATUS = { ACCEPTED: "COOKING", COOKING: "READY" };
const NEXT_LABEL = { ACCEPTED: "Start Cooking", COOKING: "Mark Ready" };

export default function KitchenDisplay() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);

  async function loadOrders() {
    const res = await api.get(`/restaurants/${user.restaurantId}/orders`);
    // Kitchen only cares about active kitchen-stage orders, oldest first (FIFO)
    setOrders(res.data.filter((o) => ["PENDING", "ACCEPTED", "COOKING"].includes(o.status)));
  }

  useEffect(() => {
    loadOrders();
    socket.emit("join:kitchen", user.restaurantId);

    const beep = () => new Audio("data:audio/wav;base64,UklGRhwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=").play().catch(() => {});
    const onNew = () => { beep(); loadOrders(); };
    const onStatus = () => loadOrders();

    socket.on("order:new", onNew);
    socket.on("order:status", onStatus);
    return () => {
      socket.off("order:new", onNew);
      socket.off("order:status", onStatus);
    };
  }, [user.restaurantId]);

  async function advance(order) {
    const status = order.status === "PENDING" ? "ACCEPTED" : NEXT_STATUS[order.status];
    await api.patch(`/orders/${order.id}/status`, { status });
    loadOrders();
  }

  return (
    <StaffLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl">Kitchen Display</h1>
        <span className="badge bg-marigold/20 text-marigold">{orders.length} active orders</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {orders.map((order) => (
          <div key={order.id} className="card p-5 border-l-4 border-marigold">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-display text-lg">Table {order.table.tableNumber}</p>
                <p className="text-xs text-ash">{new Date(order.createdAt).toLocaleTimeString()}</p>
              </div>
              <span className={`badge ${order.status === "COOKING" ? "bg-clay/20 text-clay" : "bg-ash/20 text-ash"}`}>
                {order.status}
              </span>
            </div>
            <ul className="space-y-1.5 mb-4">
              {order.items.map((it) => (
                <li key={it.id} className="text-sm flex justify-between">
                  <span>{it.quantity} × {it.menuItem.name} {it.variantLabel && `(${it.variantLabel})`}</span>
                </li>
              ))}
            </ul>
            <button onClick={() => advance(order)} className="btn-primary w-full text-sm">
              {order.status === "PENDING" ? "Accept Order" : NEXT_LABEL[order.status]}
            </button>
          </div>
        ))}
        {orders.length === 0 && (
          <p className="text-ash col-span-full text-center py-16">No active orders right now.</p>
        )}
      </div>
    </StaffLayout>
  );
}
