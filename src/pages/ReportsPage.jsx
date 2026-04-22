// pages/ReportsPage.jsx — AI generative reports via OpenRouter
import { useState } from "react";
import { usePolling } from "../hooks/useApi";
import { getDashboardStats, getPollutionRanking, runSweeper } from "../services/api";

const BASE = "http://localhost:8000";

const REPORT_TYPES = [
  { type: "air",           label: "Qualité de l'air",  icon: "◎" },
  { type: "capteurs",      label: "Statut capteurs",    icon: "◉" },
  { type: "interventions", label: "Interventions",      icon: "⚙" },
  { type: "co2",           label: "Bilan CO2",          icon: "♻" },
];

const SUGGESTION_STYLE = {
  danger:  { border: "var(--red)",    bg: "var(--red-dim)",    color: "var(--red)",    icon: "⚠" },
  warning: { border: "var(--amber)",  bg: "var(--amber-dim)",  color: "var(--amber)",  icon: "!" },
  success: { border: "var(--green)",  bg: "var(--green-dim)",  color: "var(--green)",  icon: "✓" },
};

export default function ReportsPage() {
  const [activeType,  setActiveType]  = useState(null);
  const [report,      setReport]      = useState(null);
  const [generating,  setGenerating]  = useState(false);
  const [aiError,     setAiError]     = useState(null);
  const [sweepMsg,    setSweepMsg]    = useState(null);
  const [sweeping,    setSweeping]    = useState(false);

  const { data: stats   } = usePolling(getDashboardStats,   30000);
  const { data: ranking } = usePolling(getPollutionRanking, 30000);

  const handleGenerate = async (type) => {
    setActiveType(type);
    setGenerating(true);
    setReport(null);
    setAiError(null);

    try {
      const res = await fetch(`${BASE}/reports/generate`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReport(data);
      if (data.error) setAiError(data.error);
    } catch (e) {
      setAiError(e.message); console.error("Report error:", e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSweep = async () => {
    setSweeping(true); setSweepMsg(null);
    try {
      const r = await runSweeper();
      setSweepMsg({
        ok: true,
        text: `Alertes créées: ${r.hors_service_alerts?.length ?? 0} · Escaladées: ${r.stale_interventions?.length ?? 0}`
      });
    } catch (e) {
      setSweepMsg({ ok: false, text: e.message });
    } finally {
      setSweeping(false);
    }
  };

  const s  = stats?.capteurs ?? {};
  const iv = stats?.interventions ?? {};

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1.5rem", maxWidth:920 }}>

      {/* header */}
      <div>
        <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--accent)", letterSpacing:"0.1em", marginBottom:4 }}>
          MODULE 06 — IA GÉNÉRATIVE
        </div>
        <div style={{ fontSize:18, fontWeight:500 }}>Rapports & Recommandations</div>
        <div style={{ fontSize:12, color:"var(--text-2)", marginTop:4 }}>
          OpenRouter · mistralai/mistral-7b-instruct · données live PostgreSQL
        </div>
      </div>

      {/* context KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"1rem" }}>
        {[
          ["Capteurs actifs",  s.actifs,        "var(--accent)"],
          ["Hors service",     s.hors_service,  "var(--red)"],
          ["En cours",         iv.en_cours,     "var(--amber)"],
          ["IQA moyen",        stats?.iqa_moyen,"var(--green)"],
        ].map(([label, val, color]) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ fontSize:22, color }}>{val ?? "…"}</div>
          </div>
        ))}
      </div>

      {/* report type buttons */}
      <div className="card">
        <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-3)", letterSpacing:"0.08em", marginBottom:14 }}>
          GÉNÉRER UN RAPPORT IA
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
          {REPORT_TYPES.map(({ type, label, icon }) => (
            <button
              key={type}
              onClick={() => handleGenerate(type)}
              disabled={generating}
              style={{
                display:"flex", flexDirection:"column", alignItems:"center", gap:8,
                padding:"14px 10px", borderRadius:"var(--radius-lg)",
                border:`1px solid ${activeType === type && report ? "var(--accent)" : "var(--border-hi)"}`,
                background: activeType === type && report ? "var(--accent-dim)" : "var(--bg-3)",
                color: activeType === type && report ? "var(--accent)" : "var(--text-2)",
                cursor: generating ? "not-allowed" : "pointer",
                transition:"all 0.15s",
              }}
            >
              <span style={{ fontSize:20 }}>{icon}</span>
              <span style={{ fontFamily:"var(--font-mono)", fontSize:10, letterSpacing:"0.05em", textAlign:"center" }}>
                {generating && activeType === type ? "Génération…" : label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* AI error banner (degraded mode) */}
      {aiError && (
        <div style={{
          padding:"10px 14px", borderRadius:"var(--radius)",
          background:"var(--amber-dim)", border:"1px solid var(--amber)",
          fontFamily:"var(--font-mono)", fontSize:11, color:"var(--amber)",
        }}>
          ⚠ Mode dégradé — {aiError.includes("API_KEY") ? "OPENROUTER_API_KEY non configurée" : aiError}
        </div>
      )}

      {/* generated report */}
      {report && (
        <div className="card fade-up">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-3)", letterSpacing:"0.08em" }}>
              RAPPORT — {REPORT_TYPES.find(r => r.type === activeType)?.label?.toUpperCase()}
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              {!aiError && (
                <span style={{ fontFamily:"var(--font-mono)", fontSize:9, padding:"2px 8px", borderRadius:3,
                  background:"var(--green-dim)", color:"var(--green)", border:"1px solid var(--green)" }}>
                  ✓ MISTRAL-7B
                </span>
              )}
              {aiError && (
                <span style={{ fontFamily:"var(--font-mono)", fontSize:9, padding:"2px 8px", borderRadius:3,
                  background:"var(--amber-dim)", color:"var(--amber)", border:"1px solid var(--amber)" }}>
                  MODE DÉGRADÉ
                </span>
              )}
              <span style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-3)" }}>
                {new Date().toLocaleString("fr-FR", { dateStyle:"short", timeStyle:"short" })}
              </span>
            </div>
          </div>

          {/* report text */}
          <div style={{
            fontFamily:"var(--font-sans)", fontSize:13, lineHeight:1.85,
            color:"var(--text)", whiteSpace:"pre-wrap",
            borderLeft:"2px solid var(--accent)", paddingLeft:16,
          }}>
            {report.text}
          </div>
        </div>
      )}

      {/* suggestions */}
      {report?.suggestions?.length > 0 && (
        <div className="card fade-up">
          <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-3)", letterSpacing:"0.08em", marginBottom:14 }}>
            SUGGESTIONS AUTOMATIQUES ({report.suggestions.length})
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {report.suggestions.map((s, i) => {
              const style = SUGGESTION_STYLE[s.type] || SUGGESTION_STYLE.success;
              return (
                <div key={i} style={{
                  display:"flex", alignItems:"center", gap:12,
                  padding:"10px 14px", borderRadius:"var(--radius)",
                  background: style.bg,
                  borderLeft:`3px solid ${style.border}`,
                }}>
                  <span style={{ color: style.color, fontSize:16, flexShrink:0 }}>{style.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:500, color:"var(--text)" }}>{s.title}</div>
                    <div style={{ fontSize:11, color:"var(--text-2)", marginTop:2 }}>{s.detail}</div>
                  </div>
                  {s.action && (
                    <button
                      className="btn"
                      style={{ fontSize:10, padding:"4px 10px", flexShrink:0,
                        borderColor: style.border, color: style.color }}
                      onClick={s.action === "Lancer sweeper" ? handleSweep : undefined}
                      disabled={sweeping && s.action === "Lancer sweeper"}
                    >
                      {sweeping && s.action === "Lancer sweeper" ? "…" : s.action}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {sweepMsg && (
            <div style={{
              marginTop:12, padding:"8px 12px", borderRadius:"var(--radius)",
              background: sweepMsg.ok ? "var(--green-dim)" : "var(--red-dim)",
              fontFamily:"var(--font-mono)", fontSize:11,
              color: sweepMsg.ok ? "var(--green)" : "var(--red)",
            }}>
              {sweepMsg.ok ? "✓" : "✕"} {sweepMsg.text}
            </div>
          )}
        </div>
      )}

      {/* pollution ranking */}
      {ranking?.length > 0 && (
        <div className="card">
          <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-3)", letterSpacing:"0.08em", marginBottom:14 }}>
            CLASSEMENT POLLUTION PM2.5 — 24H
          </div>
          <table className="data-table">
            <thead><tr><th>#</th><th>Zone</th><th>PM2.5 moyen</th><th>Niveau</th></tr></thead>
            <tbody>
              {ranking.map((r, i) => {
                const v = parseFloat(r.moy_pm25 || 0);
                const [cls, label] = v > 50 ? ["red","MAUVAIS"] : v > 25 ? ["amber","MODÉRÉ"] : ["green","BON"];
                return (
                  <tr key={r.zone_id}>
                    <td style={{ fontFamily:"var(--font-mono)", color:"var(--text-3)" }}>{i+1}</td>
                    <td>{r.nom}</td>
                    <td style={{ fontFamily:"var(--font-mono)", color:`var(--${cls})` }}>{r.moy_pm25} µg/m³</td>
                    <td><span className={`badge badge-${cls}`}>{label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
