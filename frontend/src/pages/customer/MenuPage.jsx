import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../../api/axios";

export default function MenuPage() {
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const explicitOrderId = searchParams.get("addToOrder"); // set when the customer tapped "Add More Items" in-app

  const [table, setTable] = useState(null);
  const [error, setError] = useState("");           // menu-LOAD failure only (full-page)
  const [debugInfo, setDebugInfo] = useState(null);
  const [checkoutError, setCheckoutError] = useState(""); // order-placement failure only (inline, in the drawer)
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState({}); // { key: { menuItemId, name, variantLabel, price, qty } }
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [placing, setPlacing] = useState(false);
  const [forceNewOrder, setForceNewOrder] = useState(false); // escape hatch if a table's old session was left dangling

  // The session this cart belongs to: an explicit "Add More Items" tap
  // always wins; otherwise, if the SERVER says this table already has an
  // unpaid order running (e.g. the customer just re-scanned the physical
  // QR sticker instead of using the in-app button, possibly on a totally
  // different phone), we transparently continue that same session so
  // everything still lands on one bill — right up until it's paid, which
  // is when the table becomes "free" again for a fresh scan.
  const autoDetectedOrderId = !forceNewOrder ? table?.activeOrder?.id || null : null;
  const sessionOrderId = explicitOrderId || autoDetectedOrderId;

  useEffect(() => {
    api
      .get(`/tables/resolve/${qrToken}`)
      .then((res) => {
        setTable(res.data);
        setActiveCategory(res.data.restaurant.categories[0]?.id);
      })
      .catch((err) => {
        // This failure means the MENU itself couldn't load — a genuine
        // full-page situation (bad QR, server down, wrong API URL, etc.)
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

  // -------------------------------------------------------- Place order
  // IMPORTANT: failures here are scoped to `checkoutError` (shown inline,
  // inside the checkout drawer) — NEVER to `error`, which nukes the whole
  // page with "Menu unavailable". The menu is clearly available (that's
  // how the customer got this far); a failed order shouldn't say otherwise.
  async function placeOrder() {
    setCheckoutError("");

    if (sessionOrderId) {
      setPlacing(true);
      try {
        await api.post(`/public/orders/${sessionOrderId}/add-items`, {
          items: cartList.map((c) => ({
            menuItemId: c.menuItemId,
            variantLabel: c.variantLabel,
            quantity: c.qty,
            price: c.price,
          })),
        });
        navigate(`/track/${sessionOrderId}`);
      } catch (err) {
        setCheckoutError(err.response?.data?.message || "Could not add items to your order. Please try again.");
      } finally {
        setPlacing(false);
      }
      return;
    }

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
      setCheckoutError(err.response?.data?.message || "Could not place order. Please check your details and try again.");
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

  const rawActiveItems = itemsByCategory[activeCategory] || [];
  const activeItems = searchQuery.trim()
    ? rawActiveItems.filter((i) => i.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : rawActiveItems;

  return (
    <div className="min-h-screen bg-menuBg text-menuInk">
      {/*
        Responsive strategy (one file, no separate mobile/desktop components):
        - Mobile (default): full-bleed single column, sticky category pills,
          bottom sheet cart drawer, floating full-width cart bar.
        - md+ (tablet/laptop): content sits in a wider centered container,
          items lay out in a 2/3-column grid, and the cart becomes a
          right-side slide-in panel instead of a bottom sheet.
      */}
      <div className="mx-auto w-full max-w-xl md:max-w-3xl lg:max-w-6xl">
        {/* Header */}
        <header className="safe-top px-5 md:px-8 pt-6 md:pt-8 pb-6 md:pb-8 bg-menuInk text-menuBg rounded-b-[2rem] md:rounded-b-[2.5rem]">
          <p className="text-menuGold text-[11px] font-semibold tracking-[0.2em] uppercase">
            Table {table.tableNumber}
          </p>
          <h1 className="font-display text-[28px] md:text-4xl leading-tight mt-1.5 break-words">
            {table.restaurant.name}
          </h1>
          {table.restaurant.address && (
            <p className="text-menuBg/60 text-sm mt-1.5">{table.restaurant.address}</p>
          )}
          {sessionOrderId && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 bg-menuGold/20 text-menuGold text-xs font-medium px-3 py-1.5 rounded-full">
                ➕ {explicitOrderId
                  ? "Adding more items to your existing order"
                  : "Continuing your table's ongoing order — it'll all bill together"}
              </div>
              {!explicitOrderId && (
                <button
                  onClick={() => setForceNewOrder(true)}
                  className="text-[11px] text-menuBg/50 underline underline-offset-2"
                >
                  Not you? Start a new order
                </button>
              )}
            </div>
          )}
        </header>

        <div className="md:flex md:gap-8 md:px-8 md:pt-6">
          {/* Main column: search + categories + items */}
          <div className="md:flex-1 md:min-w-0">
            {/* Search */}
            <div className="px-5 md:px-0 pt-4 md:pt-0">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-menuMuted">🔍</span>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search food…"
                  className="menu-input pl-11"
                />
              </div>
            </div>

            {/* Category tabs */}
            <div className="sticky top-0 z-20 bg-menuBg/95 backdrop-blur-sm px-5 md:px-0 py-3 mt-1 flex gap-2 overflow-x-auto border-b border-menuBorder [-webkit-overflow-scrolling:touch] [scrollbar-width:none]">
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

            {/* Menu items — single column on mobile, grid on md+ */}
            <div className="px-5 md:px-0 py-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4 pb-40 md:pb-10">
              {activeItems.map((item) => {
                const simpleKey = keyFor(item.id, null);
                const simpleQty = cart[simpleKey]?.qty || 0;
                return (
                  <div key={item.id} className="menu-card p-4 flex gap-4 md:flex-col md:gap-3">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-20 h-20 md:w-full md:h-36 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 md:w-full md:h-36 shrink-0 rounded-xl bg-menuBg flex items-center justify-center text-menuGold/50 text-2xl md:text-4xl font-display">
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
                          <div>
                            <span className="font-semibold text-menuGold">₹{Number(item.price)}</span>
                            <p className="text-[11px] text-menuMuted">Inclusive of taxes</p>
                          </div>
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
                              + Add
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {activeItems.length === 0 && (
                <p className="text-center text-menuMuted py-16 col-span-full">
                  {searchQuery ? "No dishes match your search." : "No items in this category yet."}
                </p>
              )}
            </div>
          </div>

          {/* Desktop/laptop: persistent cart sidebar (mobile uses the floating bar + drawer instead) */}
          {cartCount > 0 && (
            <aside className="hidden md:block md:w-80 shrink-0">
              <div className="sticky top-6 menu-card p-5">
                <h2 className="font-display text-lg mb-3">Your order</h2>
                <div className="space-y-3 mb-4 max-h-72 overflow-y-auto">
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
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => updateQty(key, -1)} className="w-6 h-6 rounded-full bg-menuBg font-bold text-sm">−</button>
                          <span className="w-4 text-center text-sm font-semibold">{c.qty}</span>
                          <button onClick={() => updateQty(key, 1)} className="w-6 h-6 rounded-full bg-menuBg font-bold text-sm">+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between font-semibold border-t border-menuBorder pt-3 mb-4">
                  <span>Subtotal</span>
                  <span>₹{cartTotal.toFixed(0)}</span>
                </div>
                <button onClick={() => setCheckoutOpen(true)} className="menu-btn-primary w-full py-3">
                  Checkout →
                </button>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Floating cart bar — mobile only; desktop uses the sidebar above */}
      {cartCount > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 safe-bottom px-4 pb-4 pt-2 bg-gradient-to-t from-menuBg via-menuBg/95 to-transparent">
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

      {/*
        Checkout drawer — bottom sheet on mobile, right-side slide-in
        panel on md+ (laptop/desktop), using the same JSX + responsive
        classes rather than two separate components.
      */}
      {checkoutOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-stretch md:justify-end z-40">
          <div className="menu-card w-full max-w-xl mx-auto rounded-t-3xl rounded-b-none p-6 safe-bottom max-h-[88vh] overflow-y-auto md:mx-0 md:max-w-md md:h-full md:max-h-none md:rounded-none md:rounded-l-3xl">
            <div className="w-10 h-1 bg-menuBorder rounded-full mx-auto mb-4 md:hidden" />
            <h2 className="font-display text-xl mb-4">
              {sessionOrderId ? "Add to your order" : "Your order"} — Table {table.tableNumber}
            </h2>

            {checkoutError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2 mb-4">
                {checkoutError}
              </div>
            )}

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
              {!sessionOrderId && (
                <>
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
                </>
              )}
              <button
                onClick={placeOrder}
                disabled={placing || (!sessionOrderId && (!customerName || !customerPhone))}
                className="menu-btn-primary w-full py-3.5"
              >
                {placing
                  ? (sessionOrderId ? "Adding to your order…" : "Placing order…")
                  : (sessionOrderId ? "Add to Order" : "Place Order")}
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
