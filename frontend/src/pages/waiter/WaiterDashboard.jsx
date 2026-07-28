import { useEffect, useState } from "react";
import api from "../../api/axios";
import { socket } from "../../socket/socket";
import { useAuth } from "../../context/AuthContext";
import StaffLayout from "../../components/layout/StaffLayout";
import StatusBadge from "../../components/common/StatusBadge";

export default function WaiterDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [alerts, setAlerts] = useState([]);

  async function loadOrders() {
    const res = await api.get(`/restaurants/${user.restaurantId}/orders`);
    setOrders(res.data.filter((o) => !["COMPLETED", "CANCELLED"].includes(o.status)));
  }

  useEffect(() => {
    loadOrders();
    socket.emit("join:waiter", user.restaurantId);

    const onStatus = () => loadOrders();
    const onCall = (payload) => setAlerts((prev) => [payload, ...prev].slice(0, 8));

    socket.on("order:new", onStatus);
    socket.on("order:status", onStatus);
    socket.on("waiter:call", onCall);
    return () => {
      socket.off("order:new", onStatus);
      socket.off("order:status", onStatus);
      socket.off("waiter:call", onCall);
    };
  }, [user.restaurantId]);

  async function markServed(orderId) {
    await api.patch(`/orders/${orderId}/status`, { status: "SERVED" });
    loadOrders();
  }

  return (
    <StaffLayout>
      <h1 className="font-display text-2xl mb-6">Waiter Dashboard</h1>

      {alerts.length > 0 && (
        <div className="card p-4 mb-6 border-l-4 border-chili">
          <p className="text-sm font-semibold text-chili mb-2">🔔 Call Waiter alerts</p>
          <ul className="space-y-1 text-sm">
            {alerts.map((a, i) => (
              <li key={i}>Table {a.tableNumber} — {a.reason} ({new Date(a.at).toLocaleTimeString()})</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {orders.map((order) => (
          <div key={order.id} className="card p-5">
            <div className="flex justify-between items-start mb-3">
              <p className="font-display text-lg">Table {order.table.tableNumber}</p>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-sm text-ash mb-3">{order.customerName} · ₹{Number(order.totalAmount).toFixed(0)}</p>
            <ul className="text-sm space-y-1 mb-4">
              {order.items.map((it) => (
                <li key={it.id}>{it.quantity} × {it.menuItem.name}</li>
              ))}
            </ul>
            {order.status === "READY" && (
              <button onClick={() => markServed(order.id)} className="btn-primary w-full text-sm">
                Mark as Served
              </button>
            )}
          </div>
        ))}
        {orders.length === 0 && <p className="text-ash col-span-full text-center py-16">No active tables right now.</p>}
      </div>
    </StaffLayout>
  );
}
