import { useEffect, useState } from "react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import StaffLayout from "../../components/layout/StaffLayout";

export default function MenuManagement() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [form, setForm] = useState({ name: "", price: "", categoryId: "", description: "", isVeg: true });

  async function load() {
    const [c, i] = await Promise.all([
      api.get(`/restaurants/${user.restaurantId}/categories`),
      api.get(`/restaurants/${user.restaurantId}/menu-items`),
    ]);
    setCategories(c.data);
    setItems(i.data);
  }

  useEffect(() => { load(); }, [user.restaurantId]);

  async function addCategory(e) {
    e.preventDefault();
    if (!newCategory) return;
    await api.post(`/restaurants/${user.restaurantId}/categories`, { name: newCategory });
    setNewCategory("");
    load();
  }

  async function addItem(e) {
    e.preventDefault();
    if (!form.name || !form.price || !form.categoryId) return;
    await api.post(`/restaurants/${user.restaurantId}/menu-items`, {
      ...form,
      price: Number(form.price),
    });
    setForm({ name: "", price: "", categoryId: "", description: "", isVeg: true });
    load();
  }

  async function toggleAvailability(id) {
    await api.patch(`/menu-items/${id}/availability`);
    load();
  }

  async function removeItem(id) {
    await api.delete(`/menu-items/${id}`);
    load();
  }

  return (
    <StaffLayout>
      <h1 className="font-display text-2xl mb-6">Menu Management</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5">
          <h2 className="font-display text-lg mb-3">Categories</h2>
          <form onSubmit={addCategory} className="flex gap-2 mb-4">
            <input className="input" placeholder="e.g. Desserts" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
            <button className="btn-primary !px-3">Add</button>
          </form>
          <ul className="space-y-1 text-sm">
            {categories.map((c) => <li key={c.id} className="text-ash">• {c.name}</li>)}
          </ul>
        </div>

        <div className="card p-5 lg:col-span-2">
          <h2 className="font-display text-lg mb-3">Add a Dish</h2>
          <form onSubmit={addItem} className="grid grid-cols-2 gap-3 mb-2">
            <input className="input col-span-2" placeholder="Dish name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Price (₹)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input className="input col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={form.isVeg} onChange={(e) => setForm({ ...form, isVeg: e.target.checked })} /> Vegetarian
            </label>
            <button className="btn-primary">Add Dish</button>
          </form>
        </div>
      </div>

      <div className="card p-5 mt-6">
        <h2 className="font-display text-lg mb-3">All Dishes</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-ash text-left border-b border-white/10">
              <th className="py-2">Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-white/5">
                <td className="py-2">{item.name}</td>
                <td className="text-ash">{item.category?.name}</td>
                <td>₹{Number(item.price)}</td>
                <td>
                  <button onClick={() => toggleAvailability(item.id)} className={`badge ${item.isAvailable ? "bg-sage/20 text-sage" : "bg-chili/20 text-chili"}`}>
                    {item.isAvailable ? "Available" : "86'd"}
                  </button>
                </td>
                <td>
                  <button onClick={() => removeItem(item.id)} className="text-chili text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StaffLayout>
  );
}
