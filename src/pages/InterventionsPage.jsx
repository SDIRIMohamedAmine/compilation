// pages/InterventionsPage.jsx — FSM workflow with technician picker
import { useState } from "react";
import { useApi } from "../hooks/useApi";
import { getInterventions, advanceIntervention } from "../services/api";
import FSMStepper from "../components/FSMStepper";

const BASE = "http://localhost:8000";

const STATUT_BADGE = {
  demande:        "badge-purple",
  tech1_assigne:  "badge-amber",
  tech2_valide:   "badge-amber",
  ia_valide:      "badge-blue",
  termine:        "badge-green",
};

const PRIORITE_COLOR = {
  urgente: "var(--red)", haute: "var(--amber)",
  normale: "var(--text-2)", basse: "var(--text-3)",
};

// Which FSM steps need a technician ID?
const NEEDS_TECH = ["demande", "tech1_assigne"];

export default function InterventionsPage() {
  const [filter,    setFilter]    = useState("");
  const [selected,  setSelected]  = useState(null);
  const [advancing, setAdvancing] = useState(false);
  const [msg,       setMsg]       = useState(null);
  const [techId,    setTechId]    = useState("");

  const { data, loading, error, refetch } = useApi(
    () => getInterventions(filter || null),
    [filter]
  );

  // Fetch available technicians
  const { data: techniciens } = useApi(
    () => fetch(`${BASE}/interventions/techniciens?disponible=true`)
            .then(r => r.json()),
    []
  );

  const handleAdvance = async (id) => {
    setAdvancing(true); setMsg(null);
    try {
      const body = NEEDS_TECH.includes(selected?.statut) && techId
        ? { technicien_id: parseInt(techId) }
        : {};
      const r = await advanceIntervention(id, body);
      setMsg({ ok: true, text: `${r.statut_avant} → ${r.statut_apres}` });
      setTechId("");
      await refetch();
      // Update selected panel state
      setSelected(prev => prev ? { ...prev, statut: r.statut_apres } : null);
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1.5rem", maxWidth:1000 }}>
      <div>
        <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--accent)", letterSpacing:"0.1em", marginBottom:4 }}>
          MODULE 05 — INTERVENTIONS
        </div>
        <div style={{ fontSize:18, fontWeight:500 }}>Workflow interventions</div>
        <div style={{ fontSize:12, color:"var(--text-2)", marginTop:4 }}>
          2 techniciens + validation IA — piloté par automate FSM
        </div>
      </div>

      {/* KPI */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"1rem" }}>
        {["demande","tech1_assigne","ia_valide","termine"].map(s => (
          <div key={s} className="stat-card">
            <div className="stat-label">{s.replace(/_/g," ")}</div>
            <div className="stat-value" style={{ fontSize:22 }}>
              {data?.filter(i => i.statut === s).length ?? 0}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:"1.5rem" }}>

        {/* list */}
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", gap:8, marginBottom:12 }}>
            <select value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="">Tous</option>
              {["demande","tech1_assigne","tech2_valide","ia_valide","termine"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="card" style={{ padding:0, overflow:"hidden" }}>
            {loading && <div style={{ padding:"2rem", textAlign:"center", color:"var(--text-3)", fontFamily:"var(--font-mono)", fontSize:12 }}>Chargement…</div>}
            {error   && <div style={{ padding:"1rem", color:"var(--red)", fontFamily:"var(--font-mono)", fontSize:12 }}>{error}</div>}
            {data && (
              <table className="data-table">
                <thead>
                  <tr><th>ID</th><th>Capteur</th><th>Zone</th><th>Statut FSM</th><th>Priorité</th><th>Date</th><th></th></tr>
                </thead>
                <tbody>
                  {data.map(i => (
                    <tr key={i.intervention_id}
                      style={{ cursor:"pointer", background: selected?.intervention_id === i.intervention_id ? "var(--bg-3)" : undefined }}>
                      <td style={{ fontFamily:"var(--font-mono)" }}>#{i.intervention_id}</td>
                      <td style={{ fontFamily:"var(--font-mono)" }}>C-{i.capteur_id}</td>
                      <td style={{ fontSize:12 }}>{i.zone_nom}</td>
                      <td><span className={`badge ${STATUT_BADGE[i.statut] || "badge-purple"}`}>{i.statut}</span></td>
                      <td style={{ color:PRIORITE_COLOR[i.priorite], fontFamily:"var(--font-mono)", fontSize:11 }}>{i.priorite}</td>
                      <td style={{ fontSize:11, color:"var(--text-2)" }}>
                        {new Date(i.date_demande).toLocaleString("fr-FR", { dateStyle:"short", timeStyle:"short" })}
                      </td>
                      <td>
                        <button className="btn" style={{ fontSize:10, padding:"3px 8px" }}
                          onClick={() => { setSelected(i); setMsg(null); setTechId(""); }}>
                          →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* detail panel */}
        {selected && (
          <div style={{ width:320, flexShrink:0 }}>
            <div className="card fade-up">
              <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-3)", marginBottom:12 }}>
                INTERVENTION #{selected.intervention_id}
              </div>

              <FSMStepper entityType="intervention" currentState={selected.statut} />

              <div style={{ marginTop:14, display:"flex", flexDirection:"column", gap:6, fontSize:12 }}>
                {[
                  ["Capteur",    `C-${selected.capteur_id}`],
                  ["Zone",       selected.zone_nom],
                  ["Priorité",   selected.priorite],
                  ["Tech 1",     selected.tech1_nom || "—"],
                  ["Tech 2",     selected.tech2_nom || "—"],
                  ["IA validée", selected.validation_ia ? "oui" : "non"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ color:"var(--text-3)" }}>{k}</span>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:11 }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Technician picker — only for steps that need one */}
              {selected.statut !== "termine" && NEEDS_TECH.includes(selected.statut) && (
                <div style={{ marginTop:14 }}>
                  <div style={{ fontSize:11, color:"var(--text-2)", marginBottom:6 }}>
                    {selected.statut === "demande" ? "Assigner Tech 1" : "Assigner Tech 2"}
                  </div>
                  <select value={techId} onChange={e => setTechId(e.target.value)} style={{ width:"100%" }}>
                    <option value="">— choisir un technicien —</option>
                    {(techniciens || []).map(t => (
                      <option key={t.technicien_id} value={t.technicien_id}>
                        {t.prenom} {t.nom} · {t.specialite}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selected.statut !== "termine" && (
                <button
                  className="btn btn-primary"
                  style={{ marginTop:14, width:"100%", justifyContent:"center" }}
                  onClick={() => handleAdvance(selected.intervention_id)}
                  disabled={advancing || (NEEDS_TECH.includes(selected.statut) && !techId)}
                >
                  {advancing ? "…" : "▶ Avancer FSM"}
                </button>
              )}

              {msg && (
                <div style={{
                  marginTop:10, padding:"7px 12px", borderRadius:"var(--radius)",
                  background: msg.ok ? "var(--green-dim)" : "var(--red-dim)",
                  fontFamily:"var(--font-mono)", fontSize:11,
                  color: msg.ok ? "var(--green)" : "var(--red)",
                }}>
                  {msg.ok ? "✓" : "✕"} {msg.text}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
