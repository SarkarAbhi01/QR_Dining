import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";

export default function MenuPage() {
  const { qrToken } = useParams();
  const navigate = useNavigate();

  const [table, setTable] = useState(null);
  const [error, setError] = useState("");
  const [debugInfo, setDebugInfo] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [cart, setCart] = useState({}); // { menuItemId: { item, qty, variant } }
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    api
      .get(`/tables/resolve/${qrToken}`)
      .then((res) => {
        setTable(res.data);
        setActiveCategory(res.data.restaurant.categories[0]?.id);
      })
      .catch((err) => {
        // Reconstruct exactly what URL was actually called and what came
        // back, so the failure point is visible on-screen — no DevTools
        // needed to diagnose a wrong domain / missing "/api" / stale build.
        const attemptedUrl = `${err.config?.baseURL || "(no baseURL set)"}${err.config?.url || ""}`;
        setDebugInfo({
          attemptedUrl,
          status: err.response?.status ?? "no response (network/CORS failure)",
          body: err.response?.data ? JSON.stringify(err.response.data) : "(none)",
        });

        if (err.response) {
          // Server responded, e.g. 404 "Invalid or expired QR code"
          setError(err.response.data?.message || "Unable to load menu");
        } else {
          // No response at all = the API server couldn't be reached from
          // this device — almost always VITE_API_URL pointing at the wrong
          // (e.g. localhost) address for a production build.
          setError(
            "Could not connect to the restaurant's server. If you are the restaurant owner, check that VITE_API_URL in the frontend's production build points to your live backend URL, not localhost."
          );
        }
      });
  }, [qrToken]);

  const itemsByCategory = useMemo(() => {
    if (!table) return {};
    const map = {};
    table.restaurant.menuItems.forEach((item) => {
      map[item.categoryId] = map[item.categoryId] || [];
      map[item.categoryId].push(item);
    });
    return map;
  }, [table]);

  const cartList = Object.values(cart);
  const cartTotal = cartList.reduce((sum, c) => sum + c.price * c.qty, 0);
  const cartCount = cartList.reduce((sum, c) => sum + c.qty, 0);

  function addToCart(item, variant) {
    const key = variant ? `${item.id}-${variant.label}` : item.id;
    const price = variant ? variant.price : Number(item.price);
    setCart((prev) => ({
      ...prev,
      [key]: {
        menuItemId: item.id,
        name: item.name,
        variantLabel: variant?.label || null,
        price,
        qty: (prev[key]?.qty || 0) + 1,
      },
    }));
  }

  function updateQty(key, delta) {
    setCart((prev) => {
      const next = { ...prev };
      const newQty = (next[key]?.qty || 0) + delta;
      if (newQty <= 0) delete next[key];
      else next[key] = { ...next[key], qty: newQty };
      return next;
    });
  }

  async function placeOrder() {
    if (!customerName || !customerPhone) return;
    setPlacing(true);
    try {
      const res = await api.post("/public/orders", {
        qrToken,
        customerName,
        customerPhone,
        items: cartList.map((c) => ({
          menuItemId: c.menuItemId,
          variantLabel: c.variantLabel,
          quantity: c.qty,
          price: c.price,
        })),
      });
      navigate(`/track/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Could not place order");
    } finally {
      setPlacing(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream text-ink px-6">
        <div className="text-center max-w-lg">
          <p className="font-display text-2xl mb-2">Menu unavailable</p>
          <p className="text-ink/60 mb-4">{error}</p>
          {debugInfo && (
            <div className="text-left bg-ink text-cream text-xs rounded-xl p-4 font-mono space-y-1 overflow-x-auto">
              <p className="text-marigold font-semibold mb-1">Debug info (share this with support):</p>
              <p><span className="text-ash">Called URL:</span> {debugInfo.attemptedUrl}</p>
              <p><span className="text-ash">Status:</span> {debugInfo.status}</p>
              <p><span className="text-ash">Response:</span> {debugInfo.body}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!table) {
    return <div className="min-h-screen flex items-center justify-center bg-cream text-ink">Loading menu…</div>;
  }

  return (
    <div className="min-h-screen bg-cream text-ink pb-32">
      {/* Header */}
      <header className="px-5 pt-8 pb-5 bg-ink text-cream rounded-b-3xl">
        <p className="text-marigold text-xs tracking-widest uppercase">Table {table.tableNumber}</p>
        <h1 className="font-display text-3xl mt-1">{table.restaurant.name}</h1>
        {table.restaurant.address && <p className="text-ash text-sm mt-1">{table.restaurant.address}</p>}
      </header>

      {/* Category tabs */}
      <div className="sticky top-0 z-10 bg-cream/95 backdrop-blur px-5 py-3 flex gap-2 overflow-x-auto border-b border-ink/10">
        {table.restaurant.categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat.id ? "bg-clay text-cream" : "bg-ink/5 text-ink/70"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Menu items */}
      <div className="px-5 py-4 space-y-4">
        {(itemsByCategory[activeCategory] || []).map((item) => (
          <div key={item.id} className="bg-white rounded-2xl p-4 flex gap-4 shadow-sm">
            {item.imageUrl && (
              <img src={item.imageUrl} alt={item.name} className="w-20 h-20 rounded-xl object-cover" />
            )}
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span
                    className={`inline-block w-3 h-3 border rounded-sm mr-2 align-middle ${
                      item.isVeg ? "border-sage" : "border-chili"
                    }`}
                  >
                    <span className={`block w-1.5 h-1.5 m-auto mt-0.5 rounded-full ${item.isVeg ? "bg-sage" : "bg-chili"}`} />
                  </span>
                  <span className="font-semibold">{item.name}</span>
                </div>
              </div>
              {item.description && <p className="text-sm text-ink/60 mt-1">{item.description}</p>}

              {item.variants ? (
                <div className="flex flex-wrap gap-2 mt-3">
                  {item.variants.map((v) => (
                    <button
                      key={v.label}
                      onClick={() => addToCart(item, v)}
                      className="text-xs border border-clay/40 text-clay px-3 py-1.5 rounded-full hover:bg-clay hover:text-cream transition-colors"
                    >
                      {v.label} · ₹{v.price}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-between mt-3">
                  <span className="font-semibold">₹{Number(item.price)}</span>
                  <button onClick={() => addToCart(item)} className="btn-primary !px-3 !py-1.5 text-sm">
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {(itemsByCategory[activeCategory] || []).length === 0 && (
          <p className="text-center text-ink/50 py-10">No items in this category yet.</p>
        )}
      </div>

      {/* Floating cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto">
          <button
            onClick={() => setCheckoutOpen(true)}
            className="w-full bg-clay text-cream rounded-2xl px-5 py-4 flex items-center justify-between shadow-card font-semibold"
          >
            <span>{cartCount} item{cartCount > 1 ? "s" : ""} · ₹{cartTotal.toFixed(0)}</span>
            <span>View Cart →</span>
          </button>
        </div>
      )}

      {/* Checkout drawer */}
      {checkoutOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-20">
          <div className="bg-white text-ink w-full max-w-md mx-auto rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto">
            <h2 className="font-display text-xl mb-4">Your order — Table {table.tableNumber}</h2>

            <div className="space-y-3 mb-5">
              {cartList.map((c) => {
                const key = c.variantLabel ? `${c.menuItemId}-${c.variantLabel}` : c.menuItemId;
                return (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{c.name} {c.variantLabel && `(${c.variantLabel})`}</p>
                      <p className="text-xs text-ink/50">₹{c.price} each</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => updateQty(key, -1)} className="w-7 h-7 rounded-full bg-ink/10">-</button>
                      <span className="w-4 text-center">{c.qty}</span>
                      <button onClick={() => updateQty(key, 1)} className="w-7 h-7 rounded-full bg-ink/10">+</button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between font-semibold border-t border-ink/10 pt-3 mb-5">
              <span>Subtotal</span>
              <span>₹{cartTotal.toFixed(0)}</span>
            </div>

            <div className="space-y-3">
              <input
                className="w-full border border-ink/15 rounded-lg px-3 py-2.5"
                placeholder="Your name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <input
                className="w-full border border-ink/15 rounded-lg px-3 py-2.5"
                placeholder="Mobile number"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
              <button
                onClick={placeOrder}
                disabled={placing || !customerName || !customerPhone}
                className="w-full bg-clay text-cream rounded-xl py-3 font-semibold disabled:opacity-40"
              >
                {placing ? "Placing order…" : "Place Order"}
              </button>
              <button onClick={() => setCheckoutOpen(false)} className="w-full text-ink/50 text-sm py-1">
                Continue browsing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
