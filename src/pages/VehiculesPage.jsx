// pages/VehiculesPage.jsx
import { useState, useEffect, useCallback } from "react";
import FSMStepper from "../components/FSMStepper";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

const BASE = "http://localhost:8000";

// ── internal fetch helper ─────────────────────────────────────────────────────
async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status} — ${path}`);
  }
  return res.json();
}

// ── simple hook ───────────────────────────────────────────────────────────────
function useFetch(fn, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const run = useCallback(async () => {
    setLoading(true); setError(null);
    try   { setData(await fn()); }
    catch (e) { setError(e.message); }
    finally   { setLoading(false); }

  }, deps);

  useEffect(() => { run(); }, [run]);
  return { data, loading, error, refetch: run };
}

// ── constants ─────────────────────────────────────────────────────────────────
const STATUT_BADGE = {
  stationne: "badge-purple",
  en_route:  "badge-blue",
  en_panne:  "badge-red",
  arrive:    "badge-green",
};

const TYPE_ICON = {
  voiture: "🚗", bus: "🚌", velo: "🚲", trottinette: "🛴", autonome: "🤖",
};

const VALID_EVENTS = {
  stationne: ["depart"],
  en_route:  ["arrivee", "panne"],
  en_panne:  ["reparation"],
  arrive:    ["depart"],
};

const EVENT_LABELS = {
  depart: "Départ", arrivee: "Arrivée", panne: "Signaler panne", reparation: "Réparer",
};

// ── sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ fontSize: 22, color }}>
        {value ?? <span style={{ fontSize: 14, color: "var(--text-3)" }}>…</span>}
      </div>
    </div>
  );
}

function TrajetRow({ t }) {
  const dep = t.timestamp_depart
    ? new Date(t.timestamp_depart).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
    : "—";
  const dur = t.timestamp_arrivee && t.timestamp_depart
    ? Math.round((new Date(t.timestamp_arrivee) - new Date(t.timestamp_depart)) / 60000)
    : null;
  const cls = t.statut === "termine" ? "badge-green"
            : t.statut === "annule"  ? "badge-red" : "badge-blue";
  return (
    <tr>
      <td style={{ fontFamily: "var(--font-mono)", color: "var(--text-3)" }}>#{t.trajet_id}</td>
      <td style={{ fontSize: 11 }}>{t.zone_depart_nom}</td>
      <td style={{ fontSize: 11 }}>{t.zone_arrivee_nom}</td>
      <td style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-2)" }}>{dep}</td>
      <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
        {t.distance_km != null ? `${t.distance_km} km` : "—"}
      </td>
      <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--green)" }}>
        {t.economie_co2 != null ? `${t.economie_co2} kg` : "—"}
      </td>
      <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-2)" }}>
        {dur != null ? `${dur} min` : "—"}
      </td>
      <td><span className={`badge ${cls}`}>{t.statut}</span></td>
    </tr>
  );
}

function FSMPanel({ vehicule, zones, onSuccess }) {
  const [event,  setEvent]  = useState("");
  const [zDep,   setZDep]   = useState("");
  const [zArr,   setZArr]   = useState("");
  const [busy,   setBusy]   = useState(false);
  const [msg,    setMsg]    = useState(null);

  const events     = VALID_EVENTS[vehicule?.statut] || [];
  const needsZones = event === "depart";

  if (!events.length) return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)",
      padding: "8px 12px", borderRadius: "var(--radius)",
      background: "var(--bg)", border: "1px solid var(--border)" }}>
      — état final, aucun événement disponible —
    </div>
  );

  const handle = async () => {
    setBusy(true); setMsg(null);
    const body = { event };
    if (needsZones) {
      if (zDep) body.zone_depart_id  = parseInt(zDep);
      if (zArr) body.zone_arrivee_id = parseInt(zArr);
    }
    try {
      const r = await api(`/vehicules/${vehicule.vehicule_id}/trigger`, {
        method: "POST", body: JSON.stringify(body),
      });
      setMsg({ ok: true, text: `${r.etat_avant} → ${r.etat_apres}` });
      setEvent(""); setZDep(""); setZArr("");
      onSuccess?.();
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {events.map(ev => {
          const isDanger   = ev === "panne";
          const isRecovery = ev === "reparation";
          const isActive   = event === ev;
          return (
            <button key={ev}
              className={`btn ${isActive ? (isDanger ? "btn-danger" : "btn-primary") : ""}`}
              style={isActive && isRecovery ? { borderColor: "var(--green)", color: "var(--green)" } : {}}
              onClick={() => { setEvent(ev); setMsg(null); }}
            >
              {EVENT_LABELS[ev]}
            </button>
          );
        })}
      </div>

      {needsZones && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 4 }}>Zone de départ</div>
            <select value={zDep} onChange={e => setZDep(e.target.value)} style={{ width: "100%" }}>
              <option value="">— choisir —</option>
              {(zones || []).map(z => (
                <option key={z.zone_id} value={z.zone_id}>{z.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 4 }}>Zone d'arrivée</div>
            <select value={zArr} onChange={e => setZArr(e.target.value)} style={{ width: "100%" }}>
              <option value="">— choisir —</option>
              {(zones || []).filter(z => z.zone_id !== parseInt(zDep)).map(z => (
                <option key={z.zone_id} value={z.zone_id}>{z.nom}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {event && (
        <button className="btn btn-primary" style={{ alignSelf: "flex-start" }}
          onClick={handle}
          disabled={busy || (needsZones && (!zDep || !zArr))}>
          {busy ? "…" : `▶ ${EVENT_LABELS[event]}`}
        </button>
      )}

      {msg && (
        <div style={{
          padding: "7px 12px", borderRadius: "var(--radius)",
          background: msg.ok ? "var(--green-dim)" : "var(--red-dim)",
          border: `1px solid ${msg.ok ? "var(--green)" : "var(--red)"}`,
          fontFamily: "var(--font-mono)", fontSize: 11,
          color: msg.ok ? "var(--green)" : "var(--red)",
        }}>
          {msg.ok ? "✓" : "✕"} {msg.text}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function VehiculesPage() {
  const [filterStatut, setFilterStatut] = useState("");
  const [filterType,   setFilterType]   = useState("");
  const [selected,     setSelected]     = useState(null);
  const [trajets,      setTrajets]      = useState(null);
  const [trajLoading,  setTrajLoading]  = useState(false);

  const { data: summary } = useFetch(() => api("/vehicules/stats/summary"), []);
  const { data: zones   } = useFetch(() => api("/vehicules/zones"),         []);

  const { data: vehicules, loading, error, refetch } = useFetch(
    () => {
      const params = new URLSearchParams();
      if (filterStatut) params.append("statut",        filterStatut);
      if (filterType)   params.append("type_vehicule", filterType);
      const qs = params.toString();
      return api(`/vehicules/${qs ? "?" + qs : ""}`);
    },
    [filterStatut, filterType]
  );

  const loadTrajets = async (v) => {
    setSelected(v); setTrajLoading(true);
    try   { setTrajets(await api(`/vehicules/${v.vehicule_id}/trajets?limit=15`)); }
    catch { setTrajets([]); }
    finally { setTrajLoading(false); }
  };

  const onFSMSuccess = async () => {
    await refetch();
    if (selected) {
      try {
        const updated = await api(`/vehicules/${selected.vehicule_id}`);
        setSelected(updated);
        setTrajets(await api(`/vehicules/${selected.vehicule_id}/trajets?limit=15`));
      } catch { /* ignore */ }
    }
  };

  // CO2 mini-chart
  const co2Data = (trajets || [])
    .filter(t => t.economie_co2 != null && t.statut === "termine")
    .slice(0, 10).reverse()
    .map((t, i) => ({ name: `T${i + 1}`, co2: parseFloat(t.economie_co2) }));

  return (
    <div style={{ display: "flex", gap: "1.5rem" }}>

      {/* ── LEFT ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>

        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", letterSpacing: "0.1em", marginBottom: 4 }}>
            MODULE 07 — VÉHICULES AUTONOMES
          </div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>Flotte de véhicules</div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
            FSM — stationné → en route → arrivé · Trajets & économies CO2
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.75rem" }}>
          <KpiCard label="Stationnés" value={summary?.stationnes} color="var(--purple)" />
          <KpiCard label="En route"   value={summary?.en_route}   color="var(--accent)" />
          <KpiCard label="En panne"   value={summary?.en_panne}   color="var(--red)"    />
          <KpiCard label="Total"      value={summary?.total}      color="var(--text)"   />
        </div>

        {/* filters */}
        <div style={{ display: "flex", gap: 8 }}>
          <select value={filterStatut} onChange={e => { setFilterStatut(e.target.value); setSelected(null); }}>
            <option value="">Tous statuts</option>
            <option value="stationne">stationné</option>
            <option value="en_route">en route</option>
            <option value="en_panne">en panne</option>
            <option value="arrive">arrivé</option>
          </select>
          <select value={filterType} onChange={e => { setFilterType(e.target.value); setSelected(null); }}>
            <option value="">Tous types</option>
            {["voiture","bus","velo","trottinette","autonome"].map(t => (
              <option key={t} value={t}>{TYPE_ICON[t]} {t}</option>
            ))}
          </select>
        </div>

        {/* table */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading && (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              Chargement…
            </div>
          )}
          {error && (
            <div style={{ padding: "1rem", color: "var(--red)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              ✕ {error}
            </div>
          )}
          {!loading && !error && vehicules?.length === 0 && (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              — aucun véhicule trouvé —
            </div>
          )}
          {vehicules?.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th><th>Type</th><th>Immat.</th><th>Statut</th>
                  <th>Zone</th><th>Citoyen</th><th>Autonomie</th><th></th>
                </tr>
              </thead>
              <tbody>
                {vehicules.map(v => (
                  <tr key={v.vehicule_id}
                    style={{ cursor: "pointer", background: selected?.vehicule_id === v.vehicule_id ? "var(--bg-3)" : undefined }}>
                    <td style={{ fontFamily: "var(--font-mono)" }}>V-{v.vehicule_id}</td>
                    <td>
                      <span style={{ marginRight: 6 }}>{TYPE_ICON[v.type_vehicule] || "🚗"}</span>
                      <span className="badge badge-blue">{v.type_vehicule}</span>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-2)" }}>
                      {v.immatriculation || "—"}
                    </td>
                    <td>
                      <span className={`badge ${STATUT_BADGE[v.statut] || "badge-purple"}`}>
                        {v.statut}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{v.zone_nom || "—"}</td>
                    <td style={{ fontSize: 12, color: "var(--text-2)" }}>{v.citoyen_nom || "public"}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)" }}>
                      {v.autonomie_km != null ? `${v.autonomie_km} km` : "—"}
                    </td>
                    <td>
                      <button className="btn" style={{ fontSize: 10, padding: "3px 8px" }}
                        onClick={() => loadTrajets(v)}>
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

      {/* ── RIGHT: detail panel ── */}
      {selected && (
        <div style={{ width: 360, flexShrink: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* info + FSM card */}
          <div className="card fade-up">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", marginBottom: 4 }}>
                  VÉHICULE V-{selected.vehicule_id}
                </div>
                <div style={{ fontSize: 26 }}>{TYPE_ICON[selected.type_vehicule] || "🚗"}</div>
              </div>
              <span className={`badge ${STATUT_BADGE[selected.statut]}`}>{selected.statut}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12, marginBottom: 14 }}>
              {[
                ["Type",            selected.type_vehicule],
                ["Immatriculation", selected.immatriculation || "—"],
                ["Zone actuelle",   selected.zone_nom        || "—"],
                ["Citoyen",         selected.citoyen_nom     || "transport public"],
                ["Autonomie",       selected.autonomie_km != null ? `${selected.autonomie_km} km` : "non électrique"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-3)" }}>{k}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{v}</span>
                </div>
              ))}
            </div>

            {/* FSM stepper */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 8, fontFamily: "var(--font-mono)" }}>
                FSM STATE
              </div>
              <FSMStepper entityType="vehicule" currentState={selected.statut} errorState="en_panne" />
            </div>

            {/* FSM trigger */}
            <div>
              <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
                DÉCLENCHER UN ÉVÉNEMENT
              </div>
              <FSMPanel vehicule={selected} zones={zones} onSuccess={onFSMSuccess} />
            </div>
          </div>

          {/* trajets card */}
          <div className="card fade-up">
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em", marginBottom: 12 }}>
              TRAJETS RÉCENTS
            </div>

            {trajLoading && (
              <div style={{ textAlign: "center", color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                Chargement…
              </div>
            )}

            {!trajLoading && co2Data.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)", marginBottom: 6 }}>
                  CO2 ÉCONOMISÉ PAR TRAJET (kg)
                </div>
                <ResponsiveContainer width="100%" height={90}>
                  <LineChart data={co2Data} margin={{ top: 4, right: 4, left: -32, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--text-3)" }} />
                    <YAxis tick={{ fontSize: 9, fill: "var(--text-3)" }} />
                    <Tooltip
                      contentStyle={{ background: "var(--bg-2)", border: "1px solid var(--border)", fontSize: 11 }}
                      formatter={v => [`${v} kg`, "CO2 économisé"]}
                    />
                    <Line type="monotone" dataKey="co2" stroke="var(--green)" dot={false} strokeWidth={1.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {!trajLoading && trajets?.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th>ID</th><th>De</th><th>À</th><th>Date</th>
                      <th>Dist.</th><th>CO2</th><th>Durée</th><th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trajets.map(t => <TrajetRow key={t.trajet_id} t={t} />)}
                  </tbody>
                </table>
              </div>
            )}

            {!trajLoading && trajets?.length === 0 && (
              <div style={{ textAlign: "center", color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 12, padding: "1rem" }}>
                — aucun trajet enregistré —
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
