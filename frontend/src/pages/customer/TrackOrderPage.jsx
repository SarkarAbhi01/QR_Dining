import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";
import { socket } from "../../socket/socket";

const STEPS = [
  { key: "PENDING", label: "Placed", desc: "We've received your order" },
  { key: "ACCEPTED", label: "Accepted", desc: "Restaurant has accepted your order" },
  { key: "COOKING", label: "Cooking", desc: "Chef is preparing your meal" },
  { key: "READY", label: "Ready", desc: "Your food is ready to be served" },
  { key: "SERVED", label: "Served", desc: "Food served! Enjoy your meal" },
];

function MiniTracker({ status }) {
  const idx = STEPS.findIndex((s) => s.key === status);
  if (status === "CANCELLED") {
    return <p className="text-xs text-rose-600 font-medium">Cancelled</p>;
  }
  return (
    <div className="flex items-center gap-1.5 mt-1">
      {STEPS.map((s, i) => (
        <span key={s.key} className={`h-1.5 flex-1 rounded-full ${i <= idx ? "bg-menuAccent" : "bg-menuInk/10"}`} />
      ))}
      <span className="text-[11px] text-menuMuted ml-1 whitespace-nowrap">{STEPS[idx]?.label}</span>
    </div>
  );
}

export default function TrackOrderPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [callSent, setCallSent] = useState(false);
  const [splitCount, setSplitCount] = useState(1);
  const [showSplit, setShowSplit] = useState(false);
  const [payingMode, setPayingMode] = useState(null); // "CASH" | "ONLINE" while in progress
  const [payMessage, setPayMessage] = useState("");

  function refresh() {
    api.get(`/public/orders/${orderId}`).then((res) => setOrder(res.data));
  }

  useEffect(() => {
    refresh();

    socket.emit("join:order", orderId);
    // Any status change on the root OR a sub-order should refresh the
    // whole session view, since the combined bill and each ticket's
    // progress all live on this one screen.
    const onUpdate = () => refresh();
    socket.on("order:status", onUpdate);
    socket.on("order:payment", onUpdate);
    socket.on("order:new", onUpdate);
    return () => {
      socket.off("order:status", onUpdate);
      socket.off("order:payment", onUpdate);
      socket.off("order:new", onUpdate);
    };
  }, [orderId]);

  async function callWaiter() {
    await api.post(`/public/orders/${orderId}/call-waiter`, { reason: "Needs assistance" });
    setCallSent(true);
    setTimeout(() => setCallSent(false), 4000);
  }

  const isSplitActive = showSplit && splitCount > 1;

  async function payByCash() {
    if (isSplitActive) return; // guarded in the UI too, but stay safe
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
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const res = await api.post(`/public/orders/${orderId}/payment-intent`, {
        mode: "ONLINE",
        splitCount: isSplitActive ? splitCount : undefined,
      });
      setOrder(res.data);
      setPayMessage("Payment successful ✅");
    } catch (err) {
      setPayMessage(err.response?.data?.message || "Payment failed, please try again.");
    } finally {
      setPayingMode(null);
    }
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-menuBg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-menuAccent border-t-transparent rounded-full animate-spin" />
          <p className="text-menuMuted text-sm">Loading your order…</p>
        </div>
      </div>
    );
  }

  const currentIndex = STEPS.findIndex((s) => s.key === order.status);
  const session = order.session || {
    subtotal: order.subtotal,
    gstAmount: order.gstAmount,
    discount: order.discount,
    totalAmount: order.totalAmount,
  };
  const perPerson = (Number(session.totalAmount) / splitCount).toFixed(2);
  const childOrders = order.childOrders || [];

  return (
    <div className="min-h-screen bg-menuBg text-menuInk">
      <div className="mx-auto w-full max-w-xl px-5 safe-top pt-6 safe-bottom pb-10">
        <p className="text-menuGold text-[11px] font-semibold tracking-[0.2em] uppercase">
          Table {order.table.tableNumber}
        </p>
        <h1 className="font-display text-2xl mt-1.5 mb-6 break-words">
          Hi {order.customerName}, here's your order
        </h1>

        {/* Main order progress tracker */}
        <div className="menu-card p-5 mb-4">
          <p className="text-xs font-semibold text-menuGold uppercase tracking-wide mb-3">Main Order</p>
          {order.status === "CANCELLED" ? (
            <p className="text-rose-600 font-medium">This order was cancelled.</p>
          ) : (
            <div className="space-y-5">
              {STEPS.map((step, idx) => {
                const done = idx <= currentIndex;
                return (
                  <div key={step.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full shrink-0 ${done ? "bg-menuAccent" : "bg-menuInk/15"}`} />
                      {idx < STEPS.length - 1 && (
                        <div className={`w-0.5 flex-1 min-h-[24px] ${idx < currentIndex ? "bg-menuAccent" : "bg-menuInk/10"}`} />
                      )}
                    </div>
                    <div className="-mt-1 min-w-0">
                      <p className={`font-medium ${done ? "text-menuInk" : "text-menuInk/40"}`}>{step.label}</p>
                      {idx === currentIndex && <p className="text-sm text-menuMuted">{step.desc}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="border-t border-menuBorder mt-4 pt-3 space-y-1 text-sm">
            {order.items.map((it) => (
              <div key={it.id} className="flex justify-between gap-3">
                <span className="min-w-0 break-words">
                  {it.quantity} × {it.menuItem.name} {it.variantLabel && `(${it.variantLabel})`}
                </span>
                <span className="shrink-0">₹{(it.price * it.quantity).toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sub-orders — each an independent kitchen ticket from "Add More Items" */}
        {childOrders.map((sub, i) => (
          <div key={sub.id} className="menu-card p-5 mb-4">
            <p className="text-xs font-semibold text-menuGold uppercase tracking-wide mb-2">
              Add-on #{i + 1}
            </p>
            <MiniTracker status={sub.status} />
            <div className="border-t border-menuBorder mt-3 pt-3 space-y-1 text-sm">
              {sub.items.map((it) => (
                <div key={it.id} className="flex justify-between gap-3">
                  <span className="min-w-0 break-words">
                    {it.quantity} × {it.menuItem.name} {it.variantLabel && `(${it.variantLabel})`}
                  </span>
                  <span className="shrink-0">₹{(it.price * it.quantity).toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Add more items */}
        {order.paymentStatus !== "PAID" && (
          <button
            onClick={() => navigate(`/menu/${order.table.qrToken}?addToOrder=${order.id}`)}
            className="menu-btn-outline w-full py-3 mb-4"
          >
            ➕ Add More Items
          </button>
        )}

        {/* Combined bill */}
        <div className="menu-card p-5 mb-4">
          <h2 className="font-display text-lg mb-3">Final Bill</h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Main Order</span>
              <span>₹{Number(order.subtotal + order.gstAmount).toFixed(0)}</span>
            </div>
            {childOrders.map((sub, i) => (
              <div key={sub.id} className="flex justify-between text-menuMuted">
                <span>Add-on #{i + 1}</span>
                <span>₹{Number(Number(sub.subtotal) + Number(sub.gstAmount)).toFixed(0)}</span>
              </div>
            ))}
            {Number(session.discount) > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <span>-₹{Number(session.discount).toFixed(0)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base border-t border-menuBorder mt-2 pt-2">
              <span>Total</span>
              <span>₹{Number(session.totalAmount).toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* Bill splitting */}
        <div className="menu-card p-5 mb-4">
          <button onClick={() => setShowSplit((s) => !s)} className="font-display text-lg w-full text-left flex items-center justify-between">
            Split the bill <span className="text-menuMuted text-base">{showSplit ? "▲" : "▼"}</span>
          </button>
          {showSplit && (
            <div className="mt-3">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => setSplitCount((c) => Math.max(1, c - 1))} className="w-8 h-8 rounded-full bg-menuBg font-bold">−</button>
                <span className="text-sm">{splitCount} {splitCount > 1 ? "people" : "person"}</span>
                <button onClick={() => setSplitCount((c) => c + 1)} className="w-8 h-8 rounded-full bg-menuBg font-bold">+</button>
              </div>
              <p className="text-sm text-menuMuted">₹{perPerson} per person</p>
              {isSplitActive && (
                <p className="text-xs text-menuAccent mt-2">
                  Split bills are paid online only — cash payment is disabled while splitting.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Payment */}
        {order.paymentStatus === "PAID" ? (
          <div className="menu-card border border-emerald-200 bg-emerald-50 p-5 mb-4 text-center">
            <p className="text-emerald-700 font-semibold">✅ Payment received — thank you!</p>
          </div>
        ) : (
          <div className="menu-card p-5 mb-4">
            <h2 className="font-display text-lg mb-3">Pay for your order</h2>
            {payMessage && <p className="text-sm text-menuAccent mb-3">{payMessage}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={payByCash}
                disabled={payingMode !== null || isSplitActive}
                className="menu-btn-outline py-3 flex flex-col items-center leading-tight disabled:opacity-30 disabled:cursor-not-allowed"
                title={isSplitActive ? "Cash isn't available when splitting the bill" : ""}
              >
                <span>💵 Pay Cash</span>
                <span className="text-[11px] font-normal opacity-80">at the counter</span>
              </button>
              <button
                onClick={payOnline}
                disabled={payingMode !== null}
                className="menu-btn-primary py-3"
              >
                {payingMode === "ONLINE" ? "Processing…" : "💳 Pay Online"}
              </button>
            </div>
            {order.paymentMode === "CASH" && order.paymentStatus !== "PAID" && (
              <p className="text-xs text-menuMuted mt-3">
                Waiting for a staff member to confirm your cash payment at the counter.
              </p>
            )}
          </div>
        )}

        {/* Call waiter */}
        <button onClick={callWaiter} className="menu-btn-outline w-full py-3.5">
          {callSent ? "Waiter notified ✓" : "🔔 Call Waiter"}
        </button>
      </div>
    </div>
  );
}
