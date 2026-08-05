import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../../api/axios";

export default function MenuPage() {
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addToOrderId = searchParams.get("addToOrder"); // set when this is an "Add More Items" trip, not a fresh order

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
    if (addToOrderId) {
      setPlacing(true);
      try {
        await api.post(`/public/orders/${addToOrderId}/add-items`, {
          items: cartList.map((c) => ({
            menuItemId: c.menuItemId,
            variantLabel: c.variantLabel,
            quantity: c.qty,
            price: c.price,
          })),
        });
        navigate(`/track/${addToOrderId}`);
      } catch (err) {
        setError(err.response?.data?.message || "Could not add items to your order");
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
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-gray-50 text-menuInk">

      <div className="mx-auto w-full max-w-xl">

        {/* ================= HEADER ================= */}

        <header className="relative overflow-hidden rounded-b-[34px] bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white shadow-2xl">

          {/* Decorative circles */}

          <div className="absolute inset-0 overflow-hidden opacity-10">

            <div className="absolute -top-14 -right-10 h-44 w-44 rounded-full bg-white"></div>

            <div className="absolute bottom-0 -left-16 h-36 w-36 rounded-full bg-white"></div>

          </div>

          <div className="relative px-6 pt-8 pb-8">

            <div className="flex items-start justify-between gap-4">

              <div className="min-w-0 flex-1">

                <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold tracking-widest uppercase backdrop-blur">

                  Table {table.tableNumber}

                </span>

                <h1 className="mt-4 text-3xl font-bold leading-tight break-words">

                  {table.restaurant.name}

                </h1>

                {table.restaurant.address && (

                  <p className="mt-2 text-sm text-orange-100 break-words">

                    {table.restaurant.address}

                  </p>

                )}

                {addToOrderId && (

                  <div className="mt-4 inline-flex items-center rounded-full bg-white/20 px-3 py-2 text-xs font-semibold backdrop-blur">

                    ➕ Adding items to existing order

                  </div>

                )}

              </div>

              <div className="rounded-2xl bg-white/20 px-4 py-3 backdrop-blur shrink-0">

                <p className="text-xs">

                  Welcome

                </p>

                <h3 className="text-xl font-bold">

                  🍽️

                </h3>

              </div>

            </div>

          </div>

        </header>

        {/* ================= SEARCH ================= */}

        <div className="sticky top-0 z-40 bg-gradient-to-b from-white via-white to-white/90 backdrop-blur px-5 pt-4 pb-3">

          <div className="relative">

            <svg
              className="absolute left-4 top-3.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>

            <input
              placeholder="Search food..."
              className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-12 pr-4 shadow-sm outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
            />

          </div>

        </div>

        {/* ================= CATEGORY ================= */}

        <div className="sticky top-[82px] z-30 bg-white px-5 pb-4">

          <div className="flex gap-3 overflow-x-auto scrollbar-hide">

            {table.restaurant.categories.map((cat) => (

              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 ${activeCategory === cat.id
                    ? "bg-orange-600 text-white shadow-lg"
                    : "bg-white border border-gray-200 text-gray-700 hover:border-orange-400"
                  }`}
              >
                {cat.name}
              </button>

            ))}

          </div>

        </div>

        {/* Menu items */}
        <div className="px-5 py-4 space-y-3 pb-40">
          {activeItems.map((item) => {
            const simpleKey = keyFor(item.id, null);
            const simpleQty = cart[simpleKey]?.qty || 0;

            return (
              <div
                key={item.id}
                className="group overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="flex gap-4 p-4">

                  {/* Image */}

                  <div className="relative shrink-0">

                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-28 w-28 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-orange-200">
                        <span className="text-4xl font-bold text-orange-500">
                          {item.name.charAt(0)}
                        </span>
                      </div>
                    )}

                    <span
                      className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-semibold text-white ${item.isVeg
                          ? "bg-green-600"
                          : "bg-red-600"
                        }`}
                    >
                      {item.isVeg ? "VEG" : "NON VEG"}
                    </span>

                  </div>

                  {/* Details */}

                  <div className="flex min-w-0 flex-1 flex-col">

                    <div>

                      <h3 className="break-words text-lg font-bold text-gray-900">
                        {item.name}
                      </h3>

                      {item.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-gray-500">
                          {item.description}
                        </p>
                      )}

                    </div>

                    {/* Variant Section */}

                    {item.variants ? (

                      <div className="mt-4 flex flex-wrap gap-2">

                        {item.variants.map((v) => {

                          const vKey = keyFor(item.id, v.label);
                          const vQty = cart[vKey]?.qty || 0;

                          return vQty > 0 ? (

                            <div
                              key={v.label}
                              className="flex items-center overflow-hidden rounded-full bg-orange-600 text-white shadow"
                            >
                              <button
                                onClick={() => updateQty(vKey, -1)}
                                className="h-9 w-9 hover:bg-orange-700"
                              >
                                −
                              </button>

                              <span className="w-8 text-center font-bold">
                                {vQty}
                              </span>

                              <button
                                onClick={() => addToCart(item, v)}
                                className="h-9 w-9 hover:bg-orange-700"
                              >
                                +
                              </button>

                              <span className="px-3 text-xs">
                                {v.label}
                              </span>

                            </div>

                          ) : (

                            <button
                              key={v.label}
                              onClick={() => addToCart(item, v)}
                              className="rounded-full border border-orange-300 bg-orange-50 px-4 py-2 text-xs font-semibold text-orange-600 transition hover:bg-orange-600 hover:text-white"
                            >
                              {v.label} · ₹{v.price}
                            </button>

                          );

                        })}

                      </div>

                    ) : (

                      <div className="mt-auto flex items-end justify-between pt-5">

                        <div>

                          <p className="text-2xl font-bold text-orange-600">
                            ₹{Number(item.price)}
                          </p>

                          <p className="text-xs text-gray-400">
                            Inclusive of taxes
                          </p>

                        </div>

                        {simpleQty > 0 ? (

                          <div className="flex items-center overflow-hidden rounded-full bg-orange-600 text-white shadow-lg">

                            <button
                              onClick={() => updateQty(simpleKey, -1)}
                              className="h-10 w-10 hover:bg-orange-700"
                            >
                              −
                            </button>

                            <span className="w-10 text-center font-bold">
                              {simpleQty}
                            </span>

                            <button
                              onClick={() => addToCart(item)}
                              className="h-10 w-10 hover:bg-orange-700"
                            >
                              +
                            </button>

                          </div>

                        ) : (

                          <button
                            onClick={() => addToCart(item)}
                            className="rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-2.5 font-semibold text-white shadow-lg transition hover:scale-105"
                          >
                            + Add
                          </button>

                        )}

                      </div>

                    )}

                  </div>

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
      {/* Floating Cart */}

      {cartCount > 0 && (

        <div className="fixed bottom-4 left-0 right-0 z-50 px-4">

          <div className="mx-auto max-w-xl">

            <button
              onClick={() => setCheckoutOpen(true)}
              className="w-full overflow-hidden rounded-3xl bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 text-white shadow-2xl transition-all duration-300 hover:scale-[1.02]"
            >

              <div className="flex items-center justify-between px-6 py-4">

                <div className="flex items-center gap-4">

                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur">

                    🛒

                  </div>

                  <div className="text-left">

                    <p className="text-lg font-bold">

                      {cartCount} Item{cartCount > 1 ? "s" : ""}

                    </p>

                    <p className="text-sm text-orange-100">

                      Ready to Order

                    </p>

                  </div>

                </div>

                <div className="text-right">

                  <p className="text-2xl font-bold">

                    ₹{cartTotal.toFixed(0)}

                  </p>

                  <p className="text-sm">

                    View Cart →

                  </p>

                </div>

              </div>

            </button>

          </div>

        </div>

      )}

      {/* Checkout drawer */}
      {checkoutOpen && (

        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm">

          <div className="mx-auto flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[34px] bg-white shadow-2xl">

            {/* Drag Handle */}

            <div className="py-3">

              <div className="mx-auto h-1.5 w-16 rounded-full bg-gray-300" />

            </div>

            {/* Header */}

            <div className="border-b px-6 pb-5">

              <div className="flex items-center justify-between">

                <div>

                  <h2 className="text-2xl font-bold">

                    Your Order

                  </h2>

                  <p className="text-gray-500">

                    Table {table.tableNumber}

                  </p>

                </div>

                <button
                  onClick={() => setCheckoutOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
                >

                  ✕

                </button>

              </div>

            </div>

            {/* Scroll Area */}

            <div className="flex-1 overflow-y-auto px-6 py-5">

              {/* CART ITEMS */}

              <div className="space-y-3 mb-5">
                {cartList.map((c) => {
                  const key = keyFor(c.menuItemId, c.variantLabel);
                  return (
                    <div key={key} className="mb-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium break-words">
                          {c.name} {c.variantLabel && `(${c.variantLabel})`}
                        </p>
                        <p className="text-xs text-menuMuted">₹{c.price} each</p>
                      </div>
                      <div className="flex items-center rounded-full bg-white shadow shrink-0">
                        <button onClick={() => updateQty(key, -1)} className="h-9 w-9 rounded-full hover:bg-gray-100">−</button>
                        <span className="w-8 text-center font-bold">{c.qty}</span>
                        <button onClick={() => updateQty(key, 1)} className="h-9 w-9 rounded-full bg-orange-500 text-white hover:bg-orange-600">+</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mb-6 rounded-2xl bg-orange-50 p-5">

                <div className="flex justify-between">

                  <span>

                    Subtotal

                  </span>

                  <span>

                    ₹{cartTotal.toFixed(0)}

                  </span>

                </div>

                <div className="mt-2 flex justify-between">

                  <span>

                    Taxes

                  </span>

                  <span>

                    Included

                  </span>

                </div>

                <div className="mt-4 flex justify-between border-t pt-4 text-xl font-bold">

                  <span>

                    Total

                  </span>

                  <span className="text-orange-600">

                    ₹{cartTotal.toFixed(0)}

                  </span>

                </div>

              </div>

              <div className="space-y-3">
                {!addToOrderId && (
                  <>
                    <input
                      className="w-full rounded-2xl border border-gray-300 px-5 py-4 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                      placeholder="Your name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                    <input
                      className="w-full rounded-2xl border border-gray-300 px-5 py-4 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                      placeholder="Mobile number"
                      inputMode="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                  </>
                )}
                <button
                  onClick={placeOrder}
                  disabled={placing || (!addToOrderId && (!customerName || !customerPhone))}
                  className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 py-4 text-lg font-bold text-white shadow-xl transition hover:scale-[1.01] disabled:opacity-50"
                >
                  {placing
                    ? (addToOrderId ? "Adding to your order…" : "Placing order…")
                    : (addToOrderId ? "Add to Order" : "Place Order")}
                </button>
                <button onClick={() => setCheckoutOpen(false)} className="mt-3 w-full rounded-xl border py-3 text-gray-500 hover:bg-gray-50">
                  Continue browsing
                </button>
              </div>
            </div>
          </div>
          </div>
      )}
    </div>
        
      
  )
}
