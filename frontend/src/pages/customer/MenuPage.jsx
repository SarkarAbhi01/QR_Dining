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
  const [cart, setCart] = useState({}); // { key: { menuItemId, name, variantLabel, price, qty } }
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
        const attemptedUrl = `${err.config?.baseURL || "(no baseURL set)"}${err.config?.url || ""}`;
        setDebugInfo({
          attemptedUrl,
          status: err.response?.status ?? "no response (network/CORS failure)",
          body: err.response?.data ? JSON.stringify(err.response.data) : "(none)",
        });
        if (err.response) {
          setError(err.response.data?.message || "Unable to load menu");
        } else {
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

  function keyFor(itemId, variantLabel) {
    return variantLabel ? `${itemId}-${variantLabel}` : itemId;
  }

  function addToCart(item, variant) {
    const key = keyFor(item.id, variant?.label);
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

  // ---------------------------------------------------------------- Error
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-menuBg text-menuInk px-6">
        <div className="text-center max-w-lg w-full">
          <p className="font-display text-2xl mb-2">Menu unavailable</p>
          <p className="text-menuMuted mb-4">{error}</p>
          {debugInfo && (
            <div className="text-left bg-menuInk text-menuBg/90 text-xs rounded-xl p-4 font-mono space-y-1 overflow-x-auto">
              <p className="text-menuGold font-semibold mb-1">Debug info (share this with support):</p>
              <p className="break-all"><span className="opacity-60">Called URL:</span> {debugInfo.attemptedUrl}</p>
              <p><span className="opacity-60">Status:</span> {debugInfo.status}</p>
              <p className="break-all"><span className="opacity-60">Response:</span> {debugInfo.body}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------- Loading
  if (!table) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-menuBg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-menuAccent border-t-transparent rounded-full animate-spin" />
          <p className="text-menuMuted text-sm">Loading menu…</p>
        </div>
      </div>
    );
  }

  const activeItems = itemsByCategory[activeCategory] || [];

  return (
    <div className="min-h-screen bg-menuBg text-menuInk">
      <div className="mx-auto w-full max-w-xl">
        {/* Header */}
        <header className="safe-top px-5 pt-6 pb-6 bg-menuInk text-menuBg rounded-b-[2rem]">
          <p className="text-menuGold text-[11px] font-semibold tracking-[0.2em] uppercase">
            Table {table.tableNumber}
          </p>
          <h1 className="font-display text-[28px] leading-tight mt-1.5 break-words">
            {table.restaurant.name}
          </h1>
          {table.restaurant.address && (
            <p className="text-menuBg/60 text-sm mt-1.5">{table.restaurant.address}</p>
          )}
        </header>

        {/* Category tabs */}
        <div className="sticky top-0 z-20 bg-menuBg/95 backdrop-blur-sm px-5 py-3 flex gap-2 overflow-x-auto border-b border-menuBorder [-webkit-overflow-scrolling:touch] [scrollbar-width:none]">
          {table.restaurant.categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat.id
                  ? "bg-menuAccent text-white"
                  : "bg-menuInk/5 text-menuInk/70"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu items */}
        <div className="px-5 py-4 space-y-3 pb-40">
          {activeItems.map((item) => {
            const simpleKey = keyFor(item.id, null);
            const simpleQty = cart[simpleKey]?.qty || 0;
            return (
              <div key={item.id} className="menu-card p-4 flex gap-4">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-20 h-20 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 shrink-0 rounded-xl bg-menuBg flex items-center justify-center text-menuGold/50 text-2xl font-display">
                    {item.name.charAt(0)}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1 shrink-0 w-3.5 h-3.5 border-2 rounded-[3px] flex items-center justify-center ${
                        item.isVeg ? "border-emerald-600" : "border-rose-600"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? "bg-emerald-600" : "bg-rose-600"}`} />
                    </span>
                    <h3 className="font-semibold leading-snug break-words">{item.name}</h3>
                  </div>

                  {item.description && (
                    <p className="text-sm text-menuMuted mt-1 line-clamp-2">{item.description}</p>
                  )}

                  {item.variants ? (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {item.variants.map((v) => {
                        const vKey = keyFor(item.id, v.label);
                        const vQty = cart[vKey]?.qty || 0;
                        return vQty > 0 ? (
                          <div key={v.label} className="flex items-center gap-2 bg-menuBg rounded-full px-1 py-1">
                            <button
                              onClick={() => updateQty(vKey, -1)}
                              className="w-7 h-7 rounded-full bg-white shadow-sm text-menuAccent font-bold flex items-center justify-center"
                            >
                              −
                            </button>
                            <span className="text-sm font-semibold w-4 text-center">{vQty}</span>
                            <button
                              onClick={() => addToCart(item, v)}
                              className="w-7 h-7 rounded-full bg-menuAccent text-white font-bold flex items-center justify-center"
                            >
                              +
                            </button>
                            <span className="text-xs text-menuMuted pr-2">{v.label}</span>
                          </div>
                        ) : (
                          <button
                            key={v.label}
                            onClick={() => addToCart(item, v)}
                            className="menu-btn-outline text-xs px-3 py-1.5"
                          >
                            {v.label} · ₹{v.price}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between mt-3">
                      <span className="font-semibold text-menuGold">₹{Number(item.price)}</span>
                      {simpleQty > 0 ? (
                        <div className="flex items-center gap-3 bg-menuBg rounded-full px-1 py-1">
                          <button
                            onClick={() => updateQty(simpleKey, -1)}
                            className="w-7 h-7 rounded-full bg-white shadow-sm text-menuAccent font-bold flex items-center justify-center"
                          >
                            −
                          </button>
                          <span className="text-sm font-semibold w-4 text-center">{simpleQty}</span>
                          <button
                            onClick={() => addToCart(item)}
                            className="w-7 h-7 rounded-full bg-menuAccent text-white font-bold flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => addToCart(item)} className="menu-btn-primary px-4 py-1.5 text-sm">
                          Add
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {activeItems.length === 0 && (
            <p className="text-center text-menuMuted py-16">No items in this category yet.</p>
          )}
        </div>
      </div>

      {/* Floating cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 safe-bottom px-4 pb-4 pt-2 bg-gradient-to-t from-menuBg via-menuBg/95 to-transparent">
          <div className="mx-auto w-full max-w-xl">
            <button
              onClick={() => setCheckoutOpen(true)}
              className="w-full bg-menuAccent text-white rounded-2xl px-5 py-4 flex items-center justify-between shadow-menu font-semibold"
            >
              <span>{cartCount} item{cartCount > 1 ? "s" : ""} · ₹{cartTotal.toFixed(0)}</span>
              <span>View Cart →</span>
            </button>
          </div>
        </div>
      )}

      {/* Checkout drawer */}
      {checkoutOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-40">
          <div className="menu-card w-full max-w-xl mx-auto rounded-t-3xl rounded-b-none p-6 safe-bottom max-h-[88vh] overflow-y-auto">
            <div className="w-10 h-1 bg-menuBorder rounded-full mx-auto mb-4" />
            <h2 className="font-display text-xl mb-4">Your order — Table {table.tableNumber}</h2>

            <div className="space-y-3 mb-5">
              {cartList.map((c) => {
                const key = keyFor(c.menuItemId, c.variantLabel);
                return (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium break-words">
                        {c.name} {c.variantLabel && `(${c.variantLabel})`}
                      </p>
                      <p className="text-xs text-menuMuted">₹{c.price} each</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button onClick={() => updateQty(key, -1)} className="w-7 h-7 rounded-full bg-menuBg font-bold">−</button>
                      <span className="w-4 text-center text-sm font-semibold">{c.qty}</span>
                      <button onClick={() => updateQty(key, 1)} className="w-7 h-7 rounded-full bg-menuBg font-bold">+</button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between font-semibold border-t border-menuBorder pt-3 mb-5">
              <span>Subtotal</span>
              <span>₹{cartTotal.toFixed(0)}</span>
            </div>

            <div className="space-y-3">
              <input
                className="menu-input"
                placeholder="Your name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <input
                className="menu-input"
                placeholder="Mobile number"
                inputMode="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
              <button
                onClick={placeOrder}
                disabled={placing || !customerName || !customerPhone}
                className="menu-btn-primary w-full py-3.5"
              >
                {placing ? "Placing order…" : "Place Order"}
              </button>
              <button onClick={() => setCheckoutOpen(false)} className="w-full text-menuMuted text-sm py-1">
                Continue browsing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
