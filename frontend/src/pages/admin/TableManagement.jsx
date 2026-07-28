import { useEffect, useState } from "react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import StaffLayout from "../../components/layout/StaffLayout";

export default function TableManagement() {
  const { user } = useAuth();
  const [tables, setTables] = useState([]);
  const [tableNumber, setTableNumber] = useState("");
  const [capacity, setCapacity] = useState(4);
  const [copiedId, setCopiedId] = useState(null);
  const [fixDomainOpen, setFixDomainOpen] = useState(null);
  const [customDomain, setCustomDomain] = useState("");

  async function load() {
    const res = await api.get(`/restaurants/${user.restaurantId}/tables`);
    setTables(res.data);
  }

  useEffect(() => { load(); }, [user.restaurantId]);

  async function addTable(e) {
    e.preventDefault();
    if (!tableNumber) return;
    await api.post(`/restaurants/${user.restaurantId}/tables`, { tableNumber, capacity: Number(capacity) });
    setTableNumber("");
    load();
  }

  async function removeTable(id) {
    await api.delete(`/tables/${id}`);
    load();
  }

  // Downloads the already-generated QR (base64 PNG) straight to the
  // restaurant's device so it can be printed and placed on the table —
  // no separate design tool needed.
  function downloadQr(table) {
    const link = document.createElement("a");
    link.href = table.qrCodeUrl;
    link.download = `table-${table.tableNumber}-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function menuUrlFor(table) {
    // Reconstructs the same URL the QR encodes, from the current app origin,
    // so "Copy Link" always matches what a fresh scan would resolve to.
    return `${window.location.origin}/menu/${table.qrToken}`;
  }

  async function copyLink(table) {
    await navigator.clipboard.writeText(menuUrlFor(table));
    setCopiedId(table.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // If a QR was generated before CLIENT_URL was set correctly (or the
  // domain has since changed), this re-issues it against the right URL
  // without deleting/recreating the table.
  async function regenerateQr(table, baseUrlOverride) {
    const res = await api.post(`/tables/${table.id}/regenerate-qr`, baseUrlOverride ? { baseUrl: baseUrlOverride } : {});
    setTables((prev) => prev.map((t) => (t.id === table.id ? { ...t, ...res.data } : t)));
    setFixDomainOpen(null);
    setCustomDomain("");
  }

  return (
    <StaffLayout>
      <h1 className="font-display text-2xl mb-6">Tables & QR Codes</h1>

      <form onSubmit={addTable} className="card p-5 flex gap-3 items-end mb-6 max-w-lg">
        <div className="flex-1">
          <label className="text-xs text-ash">Table Number</label>
          <input className="input mt-1" placeholder="e.g. T5" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} />
        </div>
        <div className="w-28">
          <label className="text-xs text-ash">Capacity</label>
          <input type="number" className="input mt-1" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </div>
        <button className="btn-primary">Create + Generate QR</button>
      </form>

      <div className="card p-4 mb-6 border-l-4 border-marigold text-sm">
        <p className="font-semibold mb-1">📱 QR scan not opening correctly for customers?</p>
        <p className="text-ash">
          This almost always means the QR was generated with the wrong domain (e.g. a developer's
          localhost address) baked into it. Download the QR below to print it, or hit
          <span className="text-marigold"> "Fix domain & regenerate"</span> on any table to re-issue
          its QR against the correct live URL — no need to delete and recreate the table.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tables.map((t) => (
          <div key={t.id} className="card p-4 text-center">
            <p className="font-display text-lg mb-1">Table {t.tableNumber}</p>
            <span className={`badge ${t.status === "VACANT" ? "bg-sage/20 text-sage" : "bg-marigold/20 text-marigold"}`}>
              {t.status}
            </span>
            {t.qrCodeUrl && <img src={t.qrCodeUrl} alt={`QR for table ${t.tableNumber}`} className="mx-auto my-3 w-32 h-32 bg-white rounded-lg p-2" />}
            <p className="text-xs text-ash mb-3">Seats {t.capacity}</p>

            <div className="space-y-1.5">
              <button onClick={() => downloadQr(t)} className="btn-primary w-full !py-1.5 text-xs">
                ⬇ Download QR
              </button>
              <button onClick={() => copyLink(t)} className="btn-ghost w-full !py-1.5 text-xs">
                {copiedId === t.id ? "Link copied ✓" : "Copy Menu Link"}
              </button>
              <button
                onClick={() => setFixDomainOpen(fixDomainOpen === t.id ? null : t.id)}
                className="w-full !py-1.5 text-xs text-marigold"
              >
                Fix domain & regenerate
              </button>
            </div>

            {fixDomainOpen === t.id && (
              <div className="mt-3 pt-3 border-t border-white/10 text-left space-y-2">
                <p className="text-xs text-ash">
                  Uses the current site URL by default. Only fill this in if your live domain is
                  different (e.g. a custom domain not yet reflected in server settings).
                </p>
                <input
                  className="input !py-1.5 text-xs"
                  placeholder="https://menu.yourrestaurant.com"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => regenerateQr(t)} className="btn-ghost !py-1.5 text-xs">
                    Use current URL
                  </button>
                  <button
                    onClick={() => regenerateQr(t, customDomain)}
                    disabled={!customDomain}
                    className="btn-primary !py-1.5 text-xs"
                  >
                    Use custom domain
                  </button>
                </div>
              </div>
            )}

            <button onClick={() => removeTable(t.id)} className="text-chili text-xs mt-3">Remove table</button>
          </div>
        ))}
        {tables.length === 0 && <p className="text-ash col-span-full text-center py-16">No tables yet — add your first one above.</p>}
      </div>
    </StaffLayout>
  );
}
