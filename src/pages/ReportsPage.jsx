// pages/ReportsPage.jsx — AI generative reports + PDF download + free prompt
import { useState, useRef } from "react";
import { usePolling } from "../hooks/useApi";
import { getDashboardStats, getPollutionRanking, runSweeper } from "../services/api";

const BASE = "http://localhost:8000";

const REPORT_TYPES = [
  { type: "air",           label: "Qualité de l'air",  icon: "◎", description: "Analyse PM2.5, PM10, NO2, O3 sur 24h" },
  { type: "capteurs",      label: "Statut capteurs",    icon: "◉", description: "Santé du réseau IoT, taux d'erreur" },
  { type: "interventions", label: "Interventions",      icon: "⚙", description: "Workflow FSM, urgences en cours" },
  { type: "co2",           label: "Bilan CO2",          icon: "♻", description: "Économies CO2 sur 7 jours" },
];

const SUGGESTION_STYLE = {
  danger:  { border: "var(--red)",   bg: "var(--red-dim)",   color: "var(--red)",   icon: "⚠" },
  warning: { border: "var(--amber)", bg: "var(--amber-dim)", color: "var(--amber)", icon: "!" },
  success: { border: "var(--green)", bg: "var(--green-dim)", color: "var(--green)", icon: "✓" },
};

// ── PDF export helper ────────────────────────────────────────────────────────
function exportReportAsPDF(title, text, timestamp) {
  // Build an HTML page that prints cleanly, then use window.print()
  const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'IBM Plex Sans', sans-serif; color: #1a1a2e; background: #fff; padding: 40px 48px; font-size: 13px; line-height: 1.7; }
  .header { border-bottom: 2px solid #00d4ff; padding-bottom: 16px; margin-bottom: 28px; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .project-tag { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.12em; color: #00d4ff; text-transform: uppercase; margin-bottom: 4px; }
  .title { font-size: 20px; font-weight: 500; color: #0a0c0f; }
  .meta { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: #6b7f96; margin-top: 6px; }
  .badge { display: inline-block; background: #004d5e; color: #00d4ff; font-family: 'IBM Plex Mono', monospace; font-size: 9px; padding: 2px 8px; border-radius: 3px; letter-spacing: 0.06em; }
  .content { font-size: 13px; line-height: 1.85; color: #1a1a2e; white-space: pre-wrap; border-left: 3px solid #00d4ff; padding-left: 16px; margin: 24px 0; }
  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-between; font-family: 'IBM Plex Mono', monospace; font-size: 9px; color: #6b7f96; }
  @media print { body { padding: 20px 30px; } }
</style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <div>
        <div class="project-tag">Neo-Sousse 2030 · Smart City Platform · Section IA 2</div>
        <div class="title">${title}</div>
        <div class="meta">Généré le ${timestamp} · Modèle: OpenRouter Auto</div>
      </div>
      <div class="badge">RAPPORT IA</div>
    </div>
  </div>
  <div class="content">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
  <div class="footer">
    <span>Neo-Sousse 2030 — Plateforme Smart City</span>
    <span>${timestamp}</span>
  </div>
</body>
</html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  w.document.write(htmlContent);
  w.document.close();
  w.onload = () => {
    w.focus();
    w.print();
  };
}

// ── Main component ───────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [activeType,    setActiveType]    = useState(null);
  const [report,        setReport]        = useState(null);
  const [generating,    setGenerating]    = useState(false);
  const [aiError,       setAiError]       = useState(null);
  const [sweepMsg,      setSweepMsg]      = useState(null);
  const [sweeping,      setSweeping]      = useState(false);
  const [activeTab,     setActiveTab]     = useState("preset"); // preset | custom
  const [customPrompt,  setCustomPrompt]  = useState("");
  const [customTitle,   setCustomTitle]   = useState("");
  const [customHistory, setCustomHistory] = useState([]); // [{title, text, ts}]
  const [customLoading, setCustomLoading] = useState(false);
  const [customError,   setCustomError]   = useState(null);
  const [selectedHist,  setSelectedHist]  = useState(null);
  const textareaRef = useRef(null);

  const { data: stats   } = usePolling(getDashboardStats,   30000);
  const { data: ranking } = usePolling(getPollutionRanking, 30000);

  const s  = stats?.capteurs ?? {};
  const iv = stats?.interventions ?? {};

  // ── Preset report generation ──────────────────────────────────────────────
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
      setAiError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  // ── Custom prompt generation ──────────────────────────────────────────────
  const handleCustomSubmit = async () => {
    if (!customPrompt.trim()) return;
    setCustomLoading(true);
    setCustomError(null);
    const ts = new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
    const title = customTitle.trim() || customPrompt.slice(0, 60) + (customPrompt.length > 60 ? "…" : "");
    try {
      // Send to the AI via a general "air" type but override the prompt
      const res = await fetch(`${BASE}/reports/generate`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type: "custom", prompt: customPrompt }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const entry = { title, text: data.text, ts, prompt: customPrompt };
      setCustomHistory(prev => [entry, ...prev]);
      setSelectedHist(entry);
      setCustomPrompt("");
      setCustomTitle("");
      if (data.error) setCustomError(data.error);
    } catch (e) {
      setCustomError(e.message);
    } finally {
      setCustomLoading(false);
    }
  };

  // ── Sweeper ───────────────────────────────────────────────────────────────
  const handleSweep = async () => {
    setSweeping(true); setSweepMsg(null);
    try {
      const r = await runSweeper();
      setSweepMsg({ ok: true, text: `Alertes créées: ${r.hors_service_alerts?.length ?? 0} · Escaladées: ${r.stale_interventions?.length ?? 0}` });
    } catch (e) {
      setSweepMsg({ ok: false, text: e.message });
    } finally {
      setSweeping(false);
    }
  };

  // ── PDF download ──────────────────────────────────────────────────────────
  const handleDownload = (title, text) => {
    const ts = new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
    exportReportAsPDF(title, text, ts);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 960 }}>

      {/* header */}
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", letterSpacing: "0.1em", marginBottom: 4 }}>
          MODULE 06 — IA GÉNÉRATIVE
        </div>
        <div style={{ fontSize: 18, fontWeight: 500 }}>Rapports & Recommandations</div>
        <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
          OpenRouter Auto · données live PostgreSQL · export PDF
        </div>
      </div>

      {/* context KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem" }}>
        {[
          ["Capteurs actifs",  s.actifs,        "var(--accent)"],
          ["Hors service",     s.hors_service,  "var(--red)"],
          ["En cours",         iv.en_cours,     "var(--amber)"],
          ["IQA moyen",        stats?.iqa_moyen,"var(--green)"],
        ].map(([label, val, color]) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ fontSize: 22, color }}>{val ?? "…"}</div>
          </div>
        ))}
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)" }}>
        {[["preset", "Rapports préconfigurés"], ["custom", "Prompt libre"]].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "8px 16px", fontFamily: "var(--font-mono)", fontSize: 11,
              color: activeTab === id ? "var(--accent)" : "var(--text-3)",
              borderBottom: `2px solid ${activeTab === id ? "var(--accent)" : "transparent"}`,
              marginBottom: -1, transition: "all 0.15s",
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: PRESET REPORTS ── */}
      {activeTab === "preset" && (
        <>
          <div className="card">
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em", marginBottom: 14 }}>
              GÉNÉRER UN RAPPORT
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
              {REPORT_TYPES.map(({ type, label, icon, description }) => (
                <button key={type} onClick={() => handleGenerate(type)} disabled={generating}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6,
                    padding: "14px 12px", borderRadius: "var(--radius-lg)", textAlign: "left",
                    border: `1px solid ${activeType === type && report ? "var(--accent)" : "var(--border-hi)"}`,
                    background: activeType === type && report ? "var(--accent-dim)" : "var(--bg-3)",
                    color: activeType === type && report ? "var(--accent)" : "var(--text-2)",
                    cursor: generating ? "not-allowed" : "pointer", transition: "all 0.15s",
                  }}>
                  <span style={{ fontSize: 18 }}>{icon}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.05em" }}>
                    {generating && activeType === type ? "Génération…" : label}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-3)", lineHeight: 1.4 }}>{description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* AI error banner */}
          {aiError && (
            <div style={{
              padding: "10px 14px", borderRadius: "var(--radius)",
              background: "var(--amber-dim)", border: "1px solid var(--amber)",
              fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--amber)",
            }}>
              ⚠ Mode dégradé — {aiError.includes("API_KEY") ? "OPENROUTER_API_KEY non configurée" : aiError}
            </div>
          )}

          {/* generated report */}
          {report && (
            <div className="card fade-up">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em" }}>
                  RAPPORT — {REPORT_TYPES.find(r => r.type === activeType)?.label?.toUpperCase()}
                  {!aiError && (
                    <span style={{ marginLeft: 10, padding: "1px 8px", borderRadius: 3,
                      background: "var(--green-dim)", color: "var(--green)", border: "1px solid var(--green)" }}>
                      ✓ IA
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)" }}>
                    {new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  <button
                    className="btn"
                    style={{ fontSize: 10, borderColor: "var(--accent)", color: "var(--accent)" }}
                    onClick={() => handleDownload(
                      REPORT_TYPES.find(r => r.type === activeType)?.label || "Rapport IA",
                      report.text
                    )}>
                    ↓ Télécharger PDF
                  </button>
                </div>
              </div>
              <div style={{
                fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.85,
                color: "var(--text)", whiteSpace: "pre-wrap",
                borderLeft: "2px solid var(--accent)", paddingLeft: 16,
              }}>
                {report.text}
              </div>
            </div>
          )}

          {/* suggestions */}
          {report?.suggestions?.length > 0 && (
            <div className="card fade-up">
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em", marginBottom: 14 }}>
                SUGGESTIONS AUTOMATIQUES ({report.suggestions.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {report.suggestions.map((sg, i) => {
                  const style = SUGGESTION_STYLE[sg.type] || SUGGESTION_STYLE.success;
                  return (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px", borderRadius: "var(--radius)",
                      background: style.bg, borderLeft: `3px solid ${style.border}`,
                    }}>
                      <span style={{ color: style.color, fontSize: 16, flexShrink: 0 }}>{style.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>{sg.title}</div>
                        <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2 }}>{sg.detail}</div>
                      </div>
                      {sg.action && (
                        <button className="btn"
                          style={{ fontSize: 10, padding: "4px 10px", flexShrink: 0, borderColor: style.border, color: style.color }}
                          onClick={sg.action === "Lancer sweeper" ? handleSweep : undefined}
                          disabled={sweeping && sg.action === "Lancer sweeper"}>
                          {sweeping && sg.action === "Lancer sweeper" ? "…" : sg.action}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {sweepMsg && (
                <div style={{
                  marginTop: 12, padding: "8px 12px", borderRadius: "var(--radius)",
                  background: sweepMsg.ok ? "var(--green-dim)" : "var(--red-dim)",
                  fontFamily: "var(--font-mono)", fontSize: 11,
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
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em", marginBottom: 14 }}>
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
                        <td style={{ fontFamily: "var(--font-mono)", color: "var(--text-3)" }}>{i + 1}</td>
                        <td>{r.nom}</td>
                        <td style={{ fontFamily: "var(--font-mono)", color: `var(--${cls})` }}>{r.moy_pm25} µg/m³</td>
                        <td><span className={`badge badge-${cls}`}>{label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── TAB: CUSTOM PROMPT ── */}
      {activeTab === "custom" && (
        <div style={{ display: "flex", gap: "1.5rem" }}>

          {/* left: prompt input */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="card">
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em", marginBottom: 12 }}>
                PROMPT LIBRE POUR L'IA
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 5 }}>Titre du rapport (optionnel)</div>
                <input
                  style={{ width: "100%" }}
                  placeholder="Ex: Analyse pollution Zone Industrielle semaine 17"
                  value={customTitle}
                  onChange={e => setCustomTitle(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 5 }}>Votre demande à l'IA</div>
                <textarea
                  ref={textareaRef}
                  rows={6}
                  style={{ width: "100%", resize: "vertical", fontFamily: "var(--font-sans)", fontSize: 13 }}
                  placeholder={"Ex: Génère un rapport détaillé sur les capteurs de type 'bruit' dans la Zone Centre. Analyse les anomalies récentes et suggère des actions correctives.\n\nTu peux aussi demander des comparaisons, des tendances, des recommandations spécifiques..."}
                  value={customPrompt}
                  onChange={e => setCustomPrompt(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleCustomSubmit();
                  }}
                />
                <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
                  Ctrl+Entrée pour envoyer
                </div>
              </div>

              <button
                className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center", padding: "10px" }}
                onClick={handleCustomSubmit}
                disabled={customLoading || !customPrompt.trim()}>
                {customLoading ? "Génération en cours…" : "▶ Générer le rapport"}
              </button>

              {customError && (
                <div style={{
                  marginTop: 10, padding: "8px 12px", borderRadius: "var(--radius)",
                  background: "var(--red-dim)", border: "1px solid var(--red)",
                  fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--red)",
                }}>
                  ✕ {customError}
                </div>
              )}

              {/* prompt suggestions */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", marginBottom: 10 }}>
                  SUGGESTIONS DE PROMPTS
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    "Analyse les capteurs avec un taux d'erreur supérieur à 10% et propose des actions correctives",
                    "Compare la qualité de l'air entre toutes les zones et identifie les zones critiques",
                    "Génère un rapport exécutif sur l'état global de la ville Neo-Sousse pour un directeur municipal",
                    "Quelles interventions FSM sont bloquées depuis plus de 48h et pourquoi ?",
                    "Analyse les économies CO2 réalisées cette semaine et projette les tendances",
                  ].map((suggestion, i) => (
                    <div key={i}
                      onClick={() => setCustomPrompt(suggestion)}
                      style={{
                        padding: "7px 12px", borderRadius: "var(--radius)",
                        border: "1px solid var(--border)", cursor: "pointer",
                        fontSize: 11, color: "var(--text-2)", transition: "border-color 0.15s",
                        lineHeight: 1.5,
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* right: history + selected report */}
          <div style={{ width: 420, flexShrink: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* history list */}
            {customHistory.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em", borderBottom: "1px solid var(--border)" }}>
                  RAPPORTS GÉNÉRÉS ({customHistory.length})
                </div>
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  {customHistory.map((entry, i) => (
                    <div key={i}
                      onClick={() => setSelectedHist(entry)}
                      style={{
                        padding: "10px 14px", cursor: "pointer",
                        borderBottom: "1px solid var(--border)",
                        background: selectedHist === entry ? "var(--bg-3)" : "transparent",
                        transition: "background 0.15s",
                      }}>
                      <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 500, marginBottom: 2 }}>
                        {entry.title}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)" }}>
                        {entry.ts}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* selected report display */}
            {selectedHist ? (
              <div className="card fade-up" style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em" }}>
                    RÉSULTAT IA
                  </div>
                  <button
                    className="btn"
                    style={{ fontSize: 10, borderColor: "var(--accent)", color: "var(--accent)" }}
                    onClick={() => handleDownload(selectedHist.title, selectedHist.text)}>
                    ↓ PDF
                  </button>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", marginBottom: 10,
                  padding: "6px 10px", background: "var(--bg)", borderRadius: "var(--radius)",
                  borderLeft: "2px solid var(--amber)", lineHeight: 1.6 }}>
                  {selectedHist.prompt}
                </div>
                <div style={{
                  fontSize: 12, lineHeight: 1.85, color: "var(--text)",
                  whiteSpace: "pre-wrap", borderLeft: "2px solid var(--accent)", paddingLeft: 14,
                  maxHeight: 380, overflowY: "auto",
                }}>
                  {selectedHist.text}
                </div>
              </div>
            ) : (
              <div className="card" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
                <div style={{ textAlign: "center", color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.8 }}>
                  Rédigez votre prompt<br/>et cliquez sur "Générer"<br/>
                  <span style={{ fontSize: 24, display: "block", marginTop: 10, opacity: 0.3 }}>✦</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}