import { useEffect, useState } from "react";
import api from "../../api/axios";
import { socket } from "../../socket/socket";
import { useAuth } from "../../context/AuthContext";
import StaffLayout from "../../components/layout/StaffLayout";
import StatusBadge from "../../components/common/StatusBadge";

export default function POSBilling() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [discount, setDiscount] = useState(0);

  async function load() {
    const res = await api.get(`/restaurants/${user.restaurantId}/orders`);
    setOrders(res.data.filter((o) => ["SERVED", "READY", "COOKING"].includes(o.status)));
  }

  useEffect(() => {
    load();
    socket.emit("join:restaurant", user.restaurantId);
    socket.on("order:status", load);
    socket.on("order:payment", load);
    return () => {
      socket.off("order:status", load);
      socket.off("order:payment", load);
    };
  }, [user.restaurantId]);

  async function generateBill() {
    const res = await api.post(`/orders/${selected.id}/bill`, { discount: Number(discount) || 0 });
    setSelected(res.data);
    load();
  }

  async function markPaid(mode) {
    const res = await api.post(`/orders/${selected.id}/pay`, { mode });
    setSelected(res.data);
    load();
  }

  async function completeOrder() {
    await api.patch(`/orders/${selected.id}/status`, { status: "COMPLETED" });
    setSelected(null);
    load();
  }

  return (
    <StaffLayout>
      <h1 className="font-display text-2xl mb-6">POS & Billing</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {orders.map((o) => (
            <button
              key={o.id}
              onClick={() => { setSelected(o); setDiscount(o.discount || 0); }}
              className={`card p-4 text-left ${selected?.id === o.id ? "ring-2 ring-marigold" : ""}`}
            >
              <div className="flex justify-between items-center mb-1">
                <p className="font-display text-lg">Table {o.table.tableNumber}</p>
                <StatusBadge status={o.status} />
              </div>
              <p className="text-sm text-ash">{o.customerName} · ₹{Number(o.totalAmount).toFixed(0)}</p>
              <p className="text-xs mt-1">{o.paymentStatus === "PAID" ? "✅ Paid" : "⏳ Unpaid"}</p>
            </button>
          ))}
          {orders.length === 0 && <p className="text-ash col-span-full text-center py-16">No active bills right now.</p>}
        </div>

        <div className="card p-5">
          {selected ? (
            <>
              <h2 className="font-display text-lg mb-3">Bill — Table {selected.table.tableNumber}</h2>
              <div className="space-y-1 text-sm mb-3">
                {selected.items.map((it) => (
                  <div key={it.id} className="flex justify-between">
                    <span>{it.quantity} × {it.menuItem.name}</span>
                    <span>₹{(it.price * it.quantity).toFixed(0)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/10 pt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>₹{Number(selected.subtotal).toFixed(0)}</span></div>
                <div className="flex justify-between"><span>GST</span><span>₹{Number(selected.gstAmount).toFixed(0)}</span></div>
                <div className="flex justify-between items-center">
                  <span>Discount</span>
                  <input type="number" className="input !w-24 !py-1" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                </div>
                <div className="flex justify-between font-semibold text-base pt-1"><span>Total</span><span>₹{Number(selected.totalAmount).toFixed(0)}</span></div>
              </div>

              <button onClick={generateBill} className="btn-ghost w-full mt-4 text-sm">Recalculate Bill</button>

              {selected.paymentStatus !== "PAID" ? (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button onClick={() => markPaid("CASH")} className="btn-primary text-sm">Cash Paid</button>
                  <button onClick={() => markPaid("UPI")} className="btn-primary text-sm">UPI Paid</button>
                </div>
              ) : (
                <button onClick={completeOrder} className="btn-primary w-full mt-3 text-sm">Complete & Free Table</button>
              )}
            </>
          ) : (
            <p className="text-ash text-center py-10">Select an order to generate its bill</p>
          )}
        </div>
      </div>
    </StaffLayout>
  );
}
