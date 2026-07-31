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

  const [search, setSearch] = useState("");

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

  const activeItems = (itemsByCategory[activeCategory] || []).filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-menuBg text-menuInk">
      <div className="mx-auto w-full max-w-xl">
        {/* Header */}
        <header className="relative overflow-hidden rounded-b-[32px] bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white shadow-xl">

          <div className="absolute inset-0 opacity-10">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white"></div>
            <div className="absolute -left-16 bottom-0 h-32 w-32 rounded-full bg-white"></div>
          </div>

          <div className="relative px-6 pt-8 pb-8">

            <div className="flex items-center justify-between">

              <div>

                <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold tracking-widest uppercase">
                  Table {table.tableNumber}
                </span>

                <h1 className="mt-4 text-3xl font-bold leading-tight">
                  {table.restaurant.name}
                </h1>

                <p className="mt-2 text-sm text-orange-100">
                  {table.restaurant.address}
                </p>

              </div>

              <div className="rounded-2xl bg-white/20 px-4 py-3 backdrop-blur">

                <p className="text-xs">⭐ Rating</p>

                <h3 className="text-lg font-bold">
                  4.7
                </h3>

              </div>

            </div>

          </div>

        </header>
        <div className="sticky top-0 z-30 bg-menuBg px-5 pt-4">

          <div className="relative">

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search delicious food..."
              className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-3 pl-12 shadow-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
            />

            <svg
              className="absolute left-4 top-3.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M21 21l-4.3-4.3"></path>
              <circle cx="11" cy="11" r="6"></circle>
            </svg>

          </div>

        </div>
        {/* Category tabs */}
        <div className="sticky top-[72px] z-20 bg-menuBg px-5 py-4 overflow-x-auto">

          <div className="flex gap-3 w-max">

            {table.restaurant.categories.map((cat) => (

              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 ${activeCategory === cat.id
                  ? "bg-orange-600 text-white shadow-lg scale-105"
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
                className="group bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
              >
                <div className="flex p-4 gap-4">

                  {/* Image */}

                  <div className="relative shrink-0">

                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-28 h-28 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center">

                        <span className="text-4xl font-bold text-orange-400">

                          {item.name.charAt(0)}

                        </span>

                      </div>
                    )}

                    {item.isVeg ? (
                      <span className="absolute top-2 left-2 bg-green-600 text-white text-[10px] px-2 py-1 rounded-full">
                        VEG
                      </span>
                    ) : (
                      <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] px-2 py-1 rounded-full">
                        NON VEG
                      </span>
                    )}

                  </div>

                  {/* Details */}

                  <div className="flex-1 min-w-0 flex flex-col">

                    <div className="flex justify-between gap-3">

                      <div>

                        <h3 className="font-bold text-lg text-gray-900 leading-snug">

                          {item.name}

                        </h3>

                        <div className="flex items-center gap-2 mt-1">

                          <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">

                            ⭐ 4.7

                          </span>

                          <span className="text-xs text-orange-600 font-medium">

                            Bestseller

                          </span>

                        </div>

                      </div>

                    </div>

                    {item.description && (

                      <p className="mt-2 text-sm text-gray-500 line-clamp-2">

                        {item.description}

                      </p>

                    )}

                    <div className="mt-auto pt-4 flex items-center justify-between">

                      <div>

                        <p className="text-2xl font-bold text-orange-600">

                          ₹{Number(item.price)}

                        </p>

                        <p className="text-xs text-gray-400">

                          Inclusive of taxes

                        </p>

                      </div>

                      {simpleQty > 0 ? (

                        <div className="flex items-center rounded-full bg-orange-600 text-white overflow-hidden shadow-lg">

                          <button
                            onClick={() => updateQty(simpleKey, -1)}
                            className="w-10 h-10 hover:bg-orange-700 transition"
                          >
                            −
                          </button>

                          <span className="w-10 text-center font-bold">

                            {simpleQty}

                          </span>

                          <button
                            onClick={() => addToCart(item)}
                            className="w-10 h-10 hover:bg-orange-700 transition"
                          >
                            +
                          </button>

                        </div>

                      ) : (

                        <button
                          onClick={() => addToCart(item)}
                          className="rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-2.5 font-semibold shadow-lg hover:scale-105 transition"
                        >
                          + Add
                        </button>

                      )}

                    </div>

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
      {cartCount > 0 && (
        <div className="fixed bottom-5 left-0 right-0 z-50 px-4">
          <div className="mx-auto max-w-xl">

            <button
              onClick={() => setCheckoutOpen(true)}
              className="w-full overflow-hidden rounded-2xl bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 text-white shadow-2xl hover:scale-[1.02] transition-all duration-300"
            >

              <div className="flex items-center justify-between px-6 py-4">

                <div className="flex items-center gap-3">

                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur">

                    🛒

                  </div>

                  <div className="text-left">

                    <p className="font-bold text-lg">

                      {cartCount} Item{cartCount > 1 ? "s" : ""}

                    </p>

                    <p className="text-orange-100 text-sm">

                      Ready to order

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
          <div className="w-full max-w-xl mx-auto rounded-t-[34px] bg-white shadow-2xl animate-slideUp max-h-[92vh] overflow-hidden flex flex-col">
            <div className="py-3">

              <div className="w-14 h-1.5 bg-gray-300 rounded-full mx-auto" />

            </div>
            <div className="px-6 pb-4 border-b">

              <div className="flex justify-between items-center">

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

                  className="h-10 w-10 rounded-full bg-gray-100 hover:bg-gray-200"

                >

                  ✕

                </button>

              </div>

            </div>

            <div className="space-y-3 mb-5">
              {cartList.map((c) => {
                const key = keyFor(c.menuItemId, c.variantLabel);
                return (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <div
                      className="flex justify-between items-center bg-gray-50 rounded-2xl p-4"
                    >

                      <div>

                        <p className="font-semibold">

                          {c.name}

                          {c.variantLabel && ` (${c.variantLabel})`}

                        </p>

                        <p className="text-sm text-gray-500">

                          ₹{c.price}

                        </p>

                      </div>

                      <div className="flex items-center gap-3">

                        <button

                          onClick={() => updateQty(key, -1)}

                          className="w-9 h-9 rounded-full bg-white shadow"

                        >

                          −

                        </button>

                        <span className="font-bold">

                          {c.qty}

                        </span>

                        <button

                          onClick={() => updateQty(key, 1)}

                          className="w-9 h-9 rounded-full bg-orange-500 text-white"

                        >

                          +

                        </button>

                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
            <div className="rounded-2xl bg-orange-50 p-5 mb-6">

              <div className="flex justify-between">

                <span>

                  Subtotal

                </span>

                <span>

                  ₹{cartTotal.toFixed(0)}

                </span>

              </div>

              <div className="flex justify-between mt-2">

                <span>

                  Delivery

                </span>

                <span>

                  FREE

                </span>

              </div>

              <div className="border-t mt-4 pt-4 flex justify-between text-lg font-bold">

                <span>

                  Total

                </span>

                <span className="text-orange-600">

                  ₹{cartTotal.toFixed(0)}

                </span>

              </div>

            </div>
           
            <div className="space-y-3">
              <input
                className="w-full rounded-2xl border border-gray-300 px-5 py-4 outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-400 transition"
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
                className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 py-4 font-bold text-white shadow-xl hover:scale-[1.02] transition disabled:opacity-50"
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
