// components/Sidebar.jsx
import { NavLink } from "react-router-dom";

const NAV = [
  { to: "/",              icon: "▦", label: "Dashboard" },
  { to: "/compiler",      icon: "⌥", label: "Compilateur NL" },
  { to: "/automata",      icon: "◈", label: "Automates FSM" },
  { to: "/sensors",       icon: "◉", label: "Capteurs" },
  { to: "/interventions", icon: "⚙", label: "Interventions" },
  { to: "/vehicules",     icon: "⬡", label: "Véhicules" },
  { to: "/reports",       icon: "✦", label: "Rapports IA" },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      {/* logo */}
      <div style={{
        padding: "1.2rem 1rem 1rem",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 10,
          color: "var(--accent)", letterSpacing: "0.12em",
          marginBottom: 6,
        }}>
          NEO-SOUSSE 2030
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", lineHeight: 1.3 }}>
          Smart City Platform
        </div>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
          Compilation & IA · Section IA 2
        </div>
      </div>

      {/* nav */}
      <nav style={{ flex: 1, padding: "0.75rem 0.5rem", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map(({ to, icon, label }) => (
          <NavLink
            key={to} to={to} end={to === "/"}
            style={({ isActive }) => ({
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px", borderRadius: "var(--radius)",
              textDecoration: "none", fontSize: 12,
              fontFamily: "var(--font-sans)",
              color:      isActive ? "var(--accent)"     : "var(--text-2)",
              background: isActive ? "var(--accent-dim)" : "transparent",
              border:     isActive ? "1px solid var(--accent-dim)" : "1px solid transparent",
              transition: "all 0.15s",
            })}
          >
            <span style={{ fontSize: 14, opacity: 0.8 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* footer */}
      <div style={{
        padding: "0.75rem 1rem",
        borderTop: "1px solid var(--border)",
        fontSize: 10, color: "var(--text-3)",
        fontFamily: "var(--font-mono)",
      }}>
        API · localhost:8000
      </div>
    </aside>
  );
}
