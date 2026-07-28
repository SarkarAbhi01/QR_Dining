import { useState } from "react";
import api from "../../api/axios";
import StaffLayout from "../../components/layout/StaffLayout";

export default function StaffManagement() {
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", role: "WAITER" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState([]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const res = await api.post("/auth/staff", form);
      setCreated((prev) => [res.data, ...prev]);
      setMessage(`${res.data.name} added as ${res.data.role}`);
      setForm({ name: "", email: "", password: "", phone: "", role: "WAITER" });
    } catch (err) {
      setError(err.response?.data?.message || "Could not create staff account");
    }
  }

  return (
    <StaffLayout>
      <h1 className="font-display text-2xl mb-6">Staff Management</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleSubmit} className="card p-5 space-y-3">
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
          <h2 className="font-display text-lg mb-3">Recently added</h2>
          <ul className="space-y-2 text-sm">
            {created.map((s) => (
              <li key={s.id} className="flex justify-between">
                <span>{s.name}</span>
                <span className="text-ash">{s.role}</span>
              </li>
            ))}
            {created.length === 0 && <p className="text-ash">No staff added in this session yet.</p>}
          </ul>
        </div>
      </div>
    </StaffLayout>
  );
}
