import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const NAV_BY_ROLE = {
  SUPER_ADMIN: [{ to: "/super-admin", label: "Platform Overview" }],
  RESTAURANT_ADMIN: [
    { to: "/admin/dashboard", label: "Dashboard" },
    { to: "/admin/menu", label: "Menu" },
    { to: "/admin/tables", label: "Tables & QR" },
    { to: "/admin/staff", label: "Staff" },
    { to: "/admin/pos", label: "POS & Billing" },
    { to: "/admin/reports", label: "Reports" },
  ],
  MANAGER: [
    { to: "/admin/dashboard", label: "Dashboard" },
    { to: "/admin/menu", label: "Menu" },
    { to: "/admin/tables", label: "Tables & QR" },
    { to: "/admin/pos", label: "POS & Billing" },
    { to: "/admin/reports", label: "Reports" },
  ],
  CHEF: [{ to: "/kitchen", label: "Kitchen Display" }],
  WAITER: [{ to: "/waiter", label: "Waiter Dashboard" }],
};

export default function StaffLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = NAV_BY_ROLE[user?.role] || [];

  return (
    <div className="min-h-screen flex bg-ink">
      <aside className="w-64 shrink-0 border-r border-white/5 flex flex-col">
        <div className="p-6">
          <h1 className="font-display text-xl text-marigold">QR Dining</h1>
          <p className="text-xs text-ash mt-1">{user?.name} · {user?.role.replace("_", " ")}</p>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `block px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive ? "bg-marigold text-ink font-semibold" : "text-ash hover:bg-surface2 hover:text-cream"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 space-y-1.5">
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
