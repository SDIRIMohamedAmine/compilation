// App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar           from "./components/Sidebar";
import Dashboard         from "./pages/Dashboard";
import CompilerPage      from "./pages/CompilerPage";
import AutomataPage      from "./pages/AutomataPage";
import SensorsPage       from "./pages/SensorsPage";
import InterventionsPage from "./pages/InterventionsPage";
import ReportsPage       from "./pages/ReportsPage";
import { useState, useEffect } from "react";

function Topbar({ page }) {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("fr-FR"));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="topbar">
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{page}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
        <span className="live-dot" />
        LIVE
      </span>
      <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>{time}</span>
    </div>
  );
}

const PAGE_TITLES = {
  "/":              "Tableau de bord",
  "/compiler":      "Compilateur NL→SQL",
  "/automata":      "Automates FSM",
  "/sensors":       "Capteurs",
  "/interventions": "Interventions",
  "/reports":       "Rapports IA",
};

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

function AppShell() {
  const path  = window.location.pathname;
  const title = PAGE_TITLES[path] || "Neo-Sousse 2030";

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar page={title} />
        <div className="page-content">
          <Routes>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/compiler"      element={<CompilerPage />} />
            <Route path="/automata"      element={<AutomataPage />} />
            <Route path="/sensors"       element={<SensorsPage />} />
            <Route path="/interventions" element={<InterventionsPage />} />
            <Route path="/reports"       element={<ReportsPage />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
