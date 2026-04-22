// components/StatCard.jsx
export default function StatCard({ label, value, sub, color = "var(--accent)", badge }) {
  return (
    <div className="stat-card fade-up">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value ?? "—"}</div>
      {sub   && <div className="stat-sub">{sub}</div>}
      {badge && <div style={{ marginTop: 8 }}><span className={`badge badge-${badge.type}`}>{badge.text}</span></div>}
    </div>
  );
}
