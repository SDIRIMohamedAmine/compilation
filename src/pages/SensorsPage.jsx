// pages/SensorsPage.jsx
import { useState } from "react";
import { useApi } from "../hooks/useApi";
import { getSensors, getSensorMesures } from "../services/api";
import FSMStepper from "../components/FSMStepper";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const STATUT_BADGE = {
  actif:          "badge-green",
  signale:        "badge-amber",
  en_maintenance: "badge-blue",
  hors_service:   "badge-red",
  inactif:        "badge-purple",
};

export default function SensorsPage() {
  const [filterStatut, setFilterStatut] = useState("");
  const [filterType,   setFilterType]   = useState("");
  const [selected,     setSelected]     = useState(null);
  const [mesures,      setMesures]      = useState(null);
  const [mesLoading,   setMesLoading]   = useState(false);

  const { data: sensors, loading, error } = useApi(
    () => getSensors({ statut: filterStatut || undefined, type_capteur: filterType || undefined }),
    [filterStatut, filterType]
  );

  const handleSelect = async (sensor) => {
    setSelected(sensor);
    setMesLoading(true);
    try {
      const m = await getSensorMesures(sensor.capteur_id, 48);
      setMesures(m.map(r => ({ ...r, ts: new Date(r.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) })));
    } catch (e) { setMesures([]); }
    finally { setMesLoading(false); }
  };

  return (
    <div style={{ display: "flex", gap: "1.5rem" }}>

      {/* list */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", letterSpacing: "0.1em", marginBottom: 4 }}>MODULE 04 — CAPTEURS</div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>Liste des capteurs</div>
        </div>

        {/* filters */}
        <div style={{ display: "flex", gap: 8 }}>
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}>
            <option value="">Tous statuts</option>
            <option value="actif">actif</option>
            <option value="signale">signalé</option>
            <option value="en_maintenance">maintenance</option>
            <option value="hors_service">hors service</option>
            <option value="inactif">inactif</option>
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">Tous types</option>
            <option value="air">air</option>
            <option value="bruit">bruit</option>
            <option value="trafic">trafic</option>
          </select>
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading && <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>Chargement…</div>}
          {error   && <div style={{ padding: "1rem", color: "var(--red)", fontFamily: "var(--font-mono)", fontSize: 12 }}>Erreur: {error}</div>}
          {sensors && (
            <table className="data-table">
              <thead>
                <tr><th>ID</th><th>Zone</th><th>Type</th><th>Statut</th><th>Taux erreur</th><th>Détail</th></tr>
              </thead>
              <tbody>
                {sensors.map(s => (
                  <tr key={s.capteur_id} style={{ cursor: "pointer", background: selected?.capteur_id === s.capteur_id ? "var(--bg-3)" : undefined }}>
                    <td style={{ fontFamily: "var(--font-mono)" }}>C-{s.capteur_id}</td>
                    <td style={{ fontSize: 12 }}>{s.zone_nom}</td>
                    <td><span className="badge badge-blue">{s.type_capteur}</span></td>
                    <td><span className={`badge ${STATUT_BADGE[s.statut] || "badge-purple"}`}>{s.statut}</span></td>
                    <td style={{ fontFamily: "var(--font-mono)", color: s.taux_erreur > 0.1 ? "var(--red)" : s.taux_erreur > 0.05 ? "var(--amber)" : "var(--green)" }}>
                      {(s.taux_erreur * 100).toFixed(1)}%
                    </td>
                    <td>
                      <button className="btn" style={{ fontSize: 10, padding: "3px 8px" }} onClick={() => handleSelect(s)}>
                        Voir →
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
        <div style={{ width: 340, display: "flex", flexDirection: "column", gap: "1rem", flexShrink: 0 }}>
          <div className="card fade-up">
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", marginBottom: 10 }}>
              CAPTEUR C-{selected.capteur_id}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
              {[["Zone", selected.zone_nom], ["Type", selected.type_capteur], ["Modèle", selected.modele || "—"],
                ["Installation", selected.date_installation], ["Anomalies totales", selected.nb_anomalies_totales]
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-3)" }}>{k}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{String(v)}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 8, fontFamily: "var(--font-mono)" }}>FSM STATE</div>
              <FSMStepper entityType="capteur" currentState={selected.statut} />
            </div>
          </div>

          {/* mesures chart */}
          {mesLoading && (
            <div className="card" style={{ textAlign: "center", color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              Chargement mesures…
            </div>
          )}
          {!mesLoading && mesures?.length > 0 && (
            <div className="card fade-up">
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", marginBottom: 12 }}>
                MESURES RÉCENTES
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={mesures.slice(0, 48)} margin={{ top: 5, right: 5, left: -30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="ts" tick={{ fontSize: 9, fill: "var(--text-3)" }} interval={11} />
                  <YAxis tick={{ fontSize: 9, fill: "var(--text-3)" }} />
                  <Tooltip contentStyle={{ background: "var(--bg-2)", border: "1px solid var(--border)", fontSize: 11 }} />
                  <Line type="monotone" dataKey="valeur" stroke="var(--accent)" dot={false} strokeWidth={1.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
