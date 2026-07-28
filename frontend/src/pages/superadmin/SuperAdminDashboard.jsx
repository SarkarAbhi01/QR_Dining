import { useEffect, useState } from "react";
import api from "../../api/axios";
import StaffLayout from "../../components/layout/StaffLayout";

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [form, setForm] = useState({ name: "", address: "", phone: "", adminName: "", adminEmail: "", adminPassword: "" });
  const [message, setMessage] = useState("");

  async function load() {
    const [a, r] = await Promise.all([
      api.get("/restaurants/platform/analytics"),
      api.get("/restaurants"),
    ]);
    setStats(a.data);
    setRestaurants(r.data);
  }

  useEffect(() => { load(); }, []);

  async function onboardRestaurant(e) {
    e.preventDefault();
    await api.post("/restaurants", form);
    setMessage(`${form.name} onboarded successfully`);
    setForm({ name: "", address: "", phone: "", adminName: "", adminEmail: "", adminPassword: "" });
    load();
  }

  async function updateStatus(id, subscriptionStatus) {
    await api.patch(`/restaurants/${id}/subscription`, { subscriptionStatus });
    load();
  }

  return (
    <StaffLayout>
      <h1 className="font-display text-2xl mb-6">Platform Overview</h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card p-5"><p className="text-ash text-sm">Restaurants</p><p className="font-display text-3xl mt-1 text-marigold">{stats.totalRestaurants}</p></div>
          <div className="card p-5"><p className="text-ash text-sm">Active Subscriptions</p><p className="font-display text-3xl mt-1 text-sage">{stats.activeSubscriptions}</p></div>
          <div className="card p-5"><p className="text-ash text-sm">Total Orders</p><p className="font-display text-3xl mt-1">{stats.totalOrders}</p></div>
          <div className="card p-5"><p className="text-ash text-sm">Platform Revenue</p><p className="font-display text-3xl mt-1 text-sage">₹{Number(stats.totalRevenue).toFixed(0)}</p></div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={onboardRestaurant} className="card p-5 space-y-3">
          <h2 className="font-display text-lg mb-1">Onboard a new Restaurant</h2>
          {message && <p className="text-sage text-sm">{message}</p>}
          <input className="input" placeholder="Restaurant name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Admin name" value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} required />
          <input className="input" placeholder="Admin email" type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} required />
          <input className="input" placeholder="Admin password" type="password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} required />
          <button className="btn-primary w-full">Onboard Restaurant</button>
        </form>

        <div className="card p-5 lg:col-span-2">
          <h2 className="font-display text-lg mb-3">All Restaurants</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ash text-left border-b border-white/10">
                <th className="py-2">Name</th><th>Plan</th><th>Status</th><th>Orders</th><th></th>
              </tr>
            </thead>
            <tbody>
              {restaurants.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="py-2">{r.name}</td>
                  <td className="text-ash">{r.subscriptionPlan}</td>
                  <td>
                    <span className={`badge ${r.subscriptionStatus === "ACTIVE" ? "bg-sage/20 text-sage" : "bg-chili/20 text-chili"}`}>
                      {r.subscriptionStatus}
                    </span>
                  </td>
                  <td>{r._count?.orders ?? 0}</td>
                  <td>
                    {r.subscriptionStatus === "ACTIVE" ? (
                      <button onClick={() => updateStatus(r.id, "SUSPENDED")} className="text-chili text-xs">Suspend</button>
                    ) : (
                      <button onClick={() => updateStatus(r.id, "ACTIVE")} className="text-sage text-xs">Activate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </StaffLayout>
  );
}
