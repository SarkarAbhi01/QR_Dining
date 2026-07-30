import { useEffect, useState } from "react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import StaffLayout from "../../components/layout/StaffLayout";

export default function Reports() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [series, setSeries] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    api.get(`/restaurants/${user.restaurantId}/reports/summary`).then((res) => setSummary(res.data));
    api.get(`/restaurants/${user.restaurantId}/reports/series?days=7`).then((res) => setSeries(res.data));
    api.get(`/restaurants/${user.restaurantId}`).then((res) => setRestaurant(res.data));
  }, [user.restaurantId]);

  async function downloadCsv() {
    setDownloading(true);
    setDownloadError("");
    try {
      const res = await api.get(`/restaurants/${user.restaurantId}/reports/download`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `orders-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      // err.response.data is a Blob here since responseType is "blob" — read it as text
      if (err.response?.data instanceof Blob) {
        const text = await err.response.data.text();
        try {
          setDownloadError(JSON.parse(text).message);
        } catch {
          setDownloadError("Could not download report");
        }
      } else {
        setDownloadError(err.response?.data?.message || "Could not download report");
      }
    } finally {
      setDownloading(false);
    }
  }

  if (!summary) return <StaffLayout><p className="text-ash">Loading reports…</p></StaffLayout>;

  const orderDiff = summary.today.orders - summary.yesterday.orders;
  const maxOrders = Math.max(...series.map((s) => s.orders), 1);

  return (
    <StaffLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl">Reports</h1>
        <div className="text-right">
          <button
            onClick={downloadCsv}
            disabled={!restaurant?.canDownloadReports || downloading}
            className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            title={!restaurant?.canDownloadReports ? "Ask the platform admin to enable report downloads" : ""}
          >
            {downloading ? "Preparing…" : "⬇ Download CSV (Today)"}
          </button>
          {!restaurant?.canDownloadReports && (
            <p className="text-xs text-ash mt-1">Download disabled — contact platform admin to enable it</p>
          )}
          {downloadError && <p className="text-xs text-chili mt-1">{downloadError}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card p-5">
          <p className="text-ash text-sm">Orders Today</p>
          <p className="font-display text-3xl mt-1 text-marigold">{summary.today.orders}</p>
          <p className={`text-xs mt-1 ${orderDiff >= 0 ? "text-sage" : "text-chili"}`}>
            {orderDiff >= 0 ? "▲" : "▼"} {Math.abs(orderDiff)} vs yesterday ({summary.yesterday.orders})
          </p>
        </div>
        <div className="card p-5">
          <p className="text-ash text-sm">Revenue Today</p>
          <p className="font-display text-3xl mt-1 text-sage">₹{Number(summary.today.revenue).toFixed(0)}</p>
          <p className="text-xs text-ash mt-1">Yesterday: ₹{Number(summary.yesterday.revenue).toFixed(0)}</p>
        </div>
        <div className="card p-5">
          <p className="text-ash text-sm mb-2">Today's Orders by Status</p>
          <div className="space-y-1">
            {summary.statusBreakdown.map((s) => (
              <div key={s.status} className="flex justify-between text-xs">
                <span className="text-ash">{s.status}</span>
                <span>{s.count}</span>
              </div>
            ))}
            {summary.statusBreakdown.length === 0 && <p className="text-ash text-xs">No orders yet today.</p>}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-lg mb-4">Last 7 Days</h2>
        <div className="flex items-end gap-3 h-40">
          {series.map((day) => (
            <div key={day.date} className="flex-1 flex flex-col items-center justify-end h-full">
              <div
                className="w-full bg-marigold/70 rounded-t-md"
                style={{ height: `${(day.orders / maxOrders) * 100}%`, minHeight: day.orders > 0 ? "4px" : "0" }}
                title={`${day.orders} orders · ₹${day.revenue}`}
              />
              <p className="text-[10px] text-ash mt-2">{day.date.slice(5)}</p>
              <p className="text-[10px] text-cream">{day.orders}</p>
            </div>
          ))}
        </div>
      </div>
    </StaffLayout>
  );
}
