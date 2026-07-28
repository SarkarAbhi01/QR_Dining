const STYLES = {
  PENDING: "bg-ash/20 text-ash",
  ACCEPTED: "bg-marigold/20 text-marigold",
  COOKING: "bg-clay/20 text-clay",
  READY: "bg-sage/20 text-sage",
  SERVED: "bg-sage/30 text-sage",
  COMPLETED: "bg-white/10 text-cream",
  CANCELLED: "bg-chili/20 text-chili",
};

const LABELS = {
  PENDING: "Placed",
  ACCEPTED: "Accepted",
  COOKING: "Cooking",
  READY: "Ready to Serve",
  SERVED: "Served",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default function StatusBadge({ status }) {
  return (
    <span className={`badge ${STYLES[status] || "bg-ash/20 text-ash"}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {LABELS[status] || status}
    </span>
  );
}
