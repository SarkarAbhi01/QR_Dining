import { useEffect, useState } from "react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import StaffLayout from "../../components/layout/StaffLayout";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get(`/restaurants/${user.restaurantId}/dashboard`).then((res) => setStats(res.data));
  }, [user.restaurantId]);

  if (!stats) return <StaffLayout><p className="text-ash">Loading dashboard…</p></StaffLayout>;

  return (
    <StaffLayout>
      <h1 className="font-display text-2xl mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card p-5">
          <p className="text-ash text-sm">Orders Today</p>
          <p className="font-display text-3xl mt-1 text-marigold">{stats.todayOrders}</p>
        </div>
        <div className="card p-5">
          <p className="text-ash text-sm">Total Revenue</p>
          <p className="font-display text-3xl mt-1 text-sage">₹{Number(stats.totalRevenue).toFixed(0)}</p>
        </div>
        <div className="card p-5">
          <p className="text-ash text-sm">Best Selling Items</p>
          <p className="font-display text-3xl mt-1">{stats.bestSellers.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-display text-lg mb-3">Best Selling Dishes</h2>
          <ul className="space-y-2 text-sm">
            {stats.bestSellers.map((b, i) => (
              <li key={b.menuItemId} className="flex justify-between">
                <span>{i + 1}. Item #{b.menuItemId.slice(0, 8)}</span>
                <span className="text-ash">{b._sum.quantity} sold</span>
              </li>
            ))}
            {stats.bestSellers.length === 0 && <p className="text-ash">No sales data yet.</p>}
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="font-display text-lg mb-3">Top Earning Tables</h2>
          <ul className="space-y-2 text-sm">
            {stats.topTables.map((t) => (
              <li key={t.tableId} className="flex justify-between">
                <span>Table #{t.tableId.slice(0, 8)}</span>
                <span className="text-ash">₹{Number(t._sum.totalAmount).toFixed(0)}</span>
              </li>
            ))}
            {stats.topTables.length === 0 && <p className="text-ash">No paid orders yet.</p>}
          </ul>
        </div>
      </div>
    </StaffLayout>
  );
}
