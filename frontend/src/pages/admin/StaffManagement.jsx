import { useEffect, useState } from "react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import StaffLayout from "../../components/layout/StaffLayout";

export default function StaffManagement() {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", role: "WAITER" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const res = await api.get("/auth/staff", { params: { restaurantId: user.restaurantId } });
    setStaff(res.data);
  }

  useEffect(() => { load(); }, [user.restaurantId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const res = await api.post("/auth/staff", form);
      setMessage(`${res.data.name} added as ${res.data.role}`);
      setForm({ name: "", email: "", password: "", phone: "", role: "WAITER" });
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not create staff account");
    }
  }

  async function toggleActive(member) {
    await api.patch(`/auth/staff/${member.id}/toggle`);
    load();
  }

  const roleLabel = { RESTAURANT_ADMIN: "Admin", MANAGER: "Manager", CHEF: "Chef", WAITER: "Waiter" };

  return (
    <StaffLayout>
      <h1 className="font-display text-2xl mb-6">Staff Management</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleSubmit} className="card p-5 space-y-3 h-fit">
          <h2 className="font-display text-lg mb-1">Add Manager / Chef / Waiter</h2>
          {error && <p className="text-chili text-sm">{error}</p>}
          {message && <p className="text-sage text-sm">{message}</p>}
          <input className="input" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Temporary password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="MANAGER">Manager</option>
            <option value="CHEF">Chef</option>
            <option value="WAITER">Waiter</option>
          </select>
          <button className="btn-primary w-full">Create Account</button>
        </form>

        <div className="card p-5">
          <h2 className="font-display text-lg mb-3">Your Team ({staff.length})</h2>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {staff.map((s) => (
              <div key={s.id} className="flex items-center justify-between border-b border-white/5 py-2">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-ash">{s.email} · {roleLabel[s.role] || s.role}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${s.isActive ? "bg-sage/20 text-sage" : "bg-chili/20 text-chili"}`}>
                    {s.isActive ? "Active" : "Inactive"}
                  </span>
                  {s.role !== "RESTAURANT_ADMIN" && (
                    <button onClick={() => toggleActive(s)} className="text-xs text-marigold">
                      {s.isActive ? "Deactivate" : "Activate"}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {staff.length === 0 && <p className="text-ash text-sm">No staff added yet.</p>}
          </div>
        </div>
      </div>
    </StaffLayout>
  );
}
