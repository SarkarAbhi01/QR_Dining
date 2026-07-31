import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { socket } from "../../socket/socket";

const NAV_BY_ROLE = {
  SUPER_ADMIN: [{ to: "/super-admin", label: "Platform Overview", icon: "◈" }],
  RESTAURANT_ADMIN: [
    { to: "/admin/dashboard", label: "Dashboard", icon: "▦" },
    { to: "/admin/menu", label: "Menu", icon: "☰" },
    { to: "/admin/tables", label: "Tables & QR", icon: "▤" },
    { to: "/admin/staff", label: "Staff", icon: "◐" },
    { to: "/admin/pos", label: "POS & Billing", icon: "$" },
    { to: "/admin/reports", label: "Reports", icon: "▲" },
  ],
  MANAGER: [
    { to: "/admin/dashboard", label: "Dashboard", icon: "▦" },
    { to: "/admin/menu", label: "Menu", icon: "☰" },
    { to: "/admin/tables", label: "Tables & QR", icon: "▤" },
    { to: "/admin/pos", label: "POS & Billing", icon: "$" },
    { to: "/admin/reports", label: "Reports", icon: "▲" },
  ],
  CHEF: [{ to: "/kitchen", label: "Kitchen Display", icon: "▦" }],
  WAITER: [{ to: "/waiter", label: "Waiter Dashboard", icon: "▦" }],
};

// A short, unobtrusive beep — used to get a manager/owner's attention when
// a new order comes in while they're working on some other screen.
function playChime() {
  try {
    new Audio(
      "data:audio/wav;base64,UklGRhwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
    ).play().catch(() => {});
  } catch {
    /* no-op — audio isn't critical */
  }
}

export default function StaffLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = NAV_BY_ROLE[user?.role] || [];
  const [notifications, setNotifications] = useState([]);

  // Restaurant Owner (Admin) and Manager get pinged the moment a customer
  // places an order, no matter which admin screen they're currently on —
  // not just the Kitchen Display.
  useEffect(() => {
    if (!user || !["RESTAURANT_ADMIN", "MANAGER"].includes(user.role)) return;

    socket.emit("join:restaurant", user.restaurantId);

    const onNewOrder = (order) => {
      playChime();
      const toast = {
        id: order.id + "-" + Date.now(),
        text: `New order — Table ${order.table.tableNumber} · ₹${Number(order.totalAmount).toFixed(0)}`,
      };
      setNotifications((prev) => [toast, ...prev].slice(0, 5));
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== toast.id));
      }, 8000);
    };

    socket.on("order:new", onNewOrder);
    return () => socket.off("order:new", onNewOrder);
  }, [user]);

  return (
    <div className="min-h-screen flex bg-ink">
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2 w-80">
        {notifications.map((n) => (
          <div
            key={n.id}
            className="bg-surface border border-marigold/30 rounded-xl px-4 py-3 shadow-card flex items-start gap-3"
          >
            <span className="text-marigold text-lg leading-none">🔔</span>
            <p className="text-sm text-cream">{n.text}</p>
          </div>
        ))}
      </div>

      <aside className="w-64 shrink-0 border-r border-white/5 flex flex-col bg-surface/40">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-marigold text-ink font-display font-bold flex items-center justify-center">Q</span>
            <h1 className="font-display text-lg text-cream">QR Dining</h1>
          </div>
          <p className="text-xs text-ash mt-3">{user?.name}</p>
          <p className="text-[11px] text-marigold uppercase tracking-wide">{user?.role.replace("_", " ")}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive ? "bg-marigold text-ink font-semibold" : "text-ash hover:bg-surface2 hover:text-cream"
                }`
              }
            >
              <span className="w-4 text-center opacity-70">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 space-y-1.5 border-t border-white/5">
          <NavLink
            to="/account/change-password"
            className={({ isActive }) =>
              `block px-3 py-2 rounded-lg text-sm text-center transition-colors ${
                isActive ? "bg-marigold text-ink font-semibold" : "text-ash hover:bg-surface2 hover:text-cream"
              }`
            }
          >
            Change Password
          </NavLink>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="btn-ghost w-full text-sm"
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
