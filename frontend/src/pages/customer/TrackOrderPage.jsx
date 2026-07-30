import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../api/axios";
import { socket } from "../../socket/socket";

const STEPS = [
  { key: "PENDING", label: "Placed", desc: "We've received your order" },
  { key: "ACCEPTED", label: "Accepted", desc: "Restaurant has accepted your order" },
  { key: "COOKING", label: "Cooking", desc: "Chef is preparing your meal" },
  { key: "READY", label: "Ready", desc: "Your food is ready to be served" },
  { key: "SERVED", label: "Served", desc: "Food served! Enjoy your meal" },
];

export default function TrackOrderPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [callSent, setCallSent] = useState(false);
  const [splitCount, setSplitCount] = useState(1);
  const [showSplit, setShowSplit] = useState(false);
  const [payingMode, setPayingMode] = useState(null); // "CASH" | "ONLINE" while in progress
  const [payMessage, setPayMessage] = useState("");

  useEffect(() => {
    api.get(`/public/orders/${orderId}`).then((res) => setOrder(res.data));

    socket.emit("join:order", orderId);
    const onStatus = (updated) => updated.id === orderId && setOrder(updated);
    const onPayment = (updated) => updated.id === orderId && setOrder(updated);
    socket.on("order:status", onStatus);
    socket.on("order:payment", onPayment);
    return () => {
      socket.off("order:status", onStatus);
      socket.off("order:payment", onPayment);
    };
  }, [orderId]);

  async function callWaiter() {
    await api.post(`/public/orders/${orderId}/call-waiter`, { reason: "Needs assistance" });
    setCallSent(true);
    setTimeout(() => setCallSent(false), 4000);
  }

  async function payByCash() {
    setPayingMode("CASH");
    try {
      const res = await api.post(`/public/orders/${orderId}/payment-intent`, { mode: "CASH" });
      setOrder(res.data);
      setPayMessage("Please pay at the counter — our staff has been notified you're ready to pay.");
    } finally {
      setPayingMode(null);
    }
  }

  async function payOnline() {
    setPayingMode("ONLINE");
    setPayMessage("Processing payment…");
    try {
      // Simulates a payment gateway round-trip. Swap this for a real
      // Razorpay/PhonePe checkout call when you wire up a live gateway.
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const res = await api.post(`/public/orders/${orderId}/payment-intent`, { mode: "ONLINE" });
      setOrder(res.data);
      setPayMessage("Payment successful ✅");
    } catch (err) {
      setPayMessage(err.response?.data?.message || "Payment failed, please try again.");
    } finally {
      setPayingMode(null);
    }
  }

  if (!order) {
    return <div className="min-h-screen flex items-center justify-center bg-cream text-ink">Loading order…</div>;
  }

  const currentIndex = STEPS.findIndex((s) => s.key === order.status);
  const perPerson = (Number(order.totalAmount) / splitCount).toFixed(2);

  return (
    <div className="min-h-screen bg-cream text-ink px-5 py-8 pb-24">
      <p className="text-clay text-xs tracking-widest uppercase">Table {order.table.tableNumber}</p>
      <h1 className="font-display text-2xl mt-1 mb-6">Hi {order.customerName}, here's your order</h1>

      {/* Progress tracker */}
      <div className="card !bg-white p-5 mb-5">
        {["CANCELLED"].includes(order.status) ? (
          <p className="text-chili font-medium">This order was cancelled.</p>
        ) : (
          <div className="space-y-5">
            {STEPS.map((step, idx) => {
              const done = idx <= currentIndex;
              return (
                <div key={step.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full ${done ? "bg-clay" : "bg-ink/15"}`} />
                    {idx < STEPS.length - 1 && (
                      <div className={`w-0.5 flex-1 min-h-[24px] ${idx < currentIndex ? "bg-clay" : "bg-ink/10"}`} />
                    )}
                  </div>
                  <div className="-mt-1">
                    <p className={`font-medium ${done ? "text-ink" : "text-ink/40"}`}>{step.label}</p>
                    {idx === currentIndex && <p className="text-sm text-ink/60">{step.desc}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Order items */}
      <div className="card !bg-white p-5 mb-5">
        <h2 className="font-display text-lg mb-3">Order summary</h2>
        <div className="space-y-2">
          {order.items.map((it) => (
            <div key={it.id} className="flex justify-between text-sm">
              <span>{it.quantity} × {it.menuItem.name} {it.variantLabel && `(${it.variantLabel})`}</span>
              <span>₹{(it.price * it.quantity).toFixed(0)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-ink/10 mt-3 pt-3 space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>₹{Number(order.subtotal).toFixed(0)}</span></div>
          <div className="flex justify-between"><span>GST</span><span>₹{Number(order.gstAmount).toFixed(0)}</span></div>
          {Number(order.discount) > 0 && (
            <div className="flex justify-between text-sage"><span>Discount</span><span>-₹{Number(order.discount).toFixed(0)}</span></div>
          )}
          <div className="flex justify-between font-semibold text-base pt-1"><span>Total</span><span>₹{Number(order.totalAmount).toFixed(0)}</span></div>
        </div>
        <p className="text-xs mt-2 text-ink/50">
          Payment: {order.paymentStatus === "PAID" ? "Paid ✓" : "Not yet paid — pay online or at the counter"}
        </p>
      </div>

      {/* Bill splitting */}
      <div className="card !bg-white p-5 mb-5">
        <button onClick={() => setShowSplit((s) => !s)} className="font-display text-lg w-full text-left">
          Split the bill →
        </button>
        {showSplit && (
          <div className="mt-3">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => setSplitCount((c) => Math.max(1, c - 1))} className="w-8 h-8 rounded-full bg-ink/10">-</button>
              <span>{splitCount} {splitCount > 1 ? "people" : "person"}</span>
              <button onClick={() => setSplitCount((c) => c + 1)} className="w-8 h-8 rounded-full bg-ink/10">+</button>
            </div>
            <p className="text-sm text-ink/70">₹{perPerson} per person</p>
          </div>
        )}
      </div>

      {/* Payment */}
      {order.paymentStatus === "PAID" ? (
        <div className="card !bg-sage/10 border border-sage/30 p-5 mb-5 text-center">
          <p className="text-sage font-semibold">✅ Payment received — thank you!</p>
        </div>
      ) : (
        <div className="card !bg-white p-5 mb-5">
          <h2 className="font-display text-lg mb-3">Pay for your order</h2>
          {payMessage && <p className="text-sm text-clay mb-3">{payMessage}</p>}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={payByCash}
              disabled={payingMode !== null}
              className="border-2 border-clay text-clay rounded-xl py-3 font-semibold disabled:opacity-40"
            >
              💵 Pay Cash{"\n"}<span className="block text-xs font-normal">at the counter</span>
            </button>
            <button
              onClick={payOnline}
              disabled={payingMode !== null}
              className="bg-clay text-cream rounded-xl py-3 font-semibold disabled:opacity-60"
            >
              {payingMode === "ONLINE" ? "Processing…" : "💳 Pay Online"}
            </button>
          </div>
          {order.paymentMode === "CASH" && order.paymentStatus !== "PAID" && (
            <p className="text-xs text-ink/50 mt-3">
              Waiting for a staff member to confirm your cash payment at the counter.
            </p>
          )}
        </div>
      )}

      {/* Call waiter */}
      <button
        onClick={callWaiter}
        className="w-full border-2 border-clay text-clay rounded-xl py-3 font-semibold mb-3"
      >
        {callSent ? "Waiter notified ✓" : "🔔 Call Waiter"}
      </button>
    </div>
  );
}
