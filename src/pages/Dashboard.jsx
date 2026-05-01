// pages/Dashboard.jsx
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import StatCard from "../components/StatCard";
import { usePolling } from "../hooks/useApi";
import { getDashboardStats, getRecentAnomalies } from "../services/api";

const BASE = "http://localhost:8000";

async function apiFetch(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const getInterventions   = () => apiFetch("/interventions/");
const getVehiclesSummary = () => apiFetch("/vehicules/stats/summary");
const getSensorsSummary  = () => apiFetch("/sensors/stats/summary");
const getTopAnomalyZones = () => apiFetch("/dashboard/anomalies/recent?limit=200");

// ── FSM stage funnel data ──────────────────────────────────────────────────────
function buildFSMFunnel(interventions) {
  const stages = [
    { key: "demande",       label: "Demande",    color: "var(--purple)" },
    { key: "tech1_assigne", label: "Tech 1",     color: "var(--amber)"  },
    { key: "tech2_valide",  label: "Tech 2",     color: "var(--accent)" },
    { key: "ia_valide",     label: "IA Validé",  color: "var(--green)"  },
    { key: "termine",       label: "Terminé",    color: "var(--text-3)" },
  ];
  return stages.map(s => ({
    ...s,
    count: (interventions || []).filter(i => i.statut === s.key).length,
  }));
}

// ── Zone anomaly aggregation ───────────────────────────────────────────────────
function buildZoneAnomalies(anomalies) {
  const map = {};
  (anomalies || []).forEach(a => {
    map[a.zone_nom] = (map[a.zone_nom] || 0) + 1;
  });
  return Object.entries(map)
    .map(([zone, count]) => ({ zone: zone.replace("Zone ", ""), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

// ── custom tooltip ─────────────────────────────────────────────────────────────
function SimpleTooltip({ active, payload, label, unit = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-2)", border: "1px solid var(--border)",
      borderRadius: 6, padding: "8px 12px",
      fontFamily: "var(--font-mono)", fontSize: 11,
    }}>
      <div style={{ color: "var(--text-2)", marginBottom: 4 }}>{label}</div>
      <div style={{ color: "var(--accent)", fontWeight: 600 }}>
        {payload[0].value}{unit}
      </div>
    </div>
  );
}

// ── vehicle status bar ─────────────────────────────────────────────────────────
function VehicleBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, width: 90, color: "var(--text-2)" }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 5, background: "var(--bg-3)", borderRadius: 3 }}>
        <div style={{ width: `${pct}%`, height: 5, background: color, borderRadius: 3, transition: "width 0.5s" }} />
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, width: 24, textAlign: "right", color }}>
        {value ?? 0}
      </span>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data: stats     } = usePolling(getDashboardStats,   15000);
  const { data: anomalies } = usePolling(getRecentAnomalies,  20000);
  const { data: intervs   } = usePolling(getInterventions,    20000);
  const { data: vehicles  } = usePolling(getVehiclesSummary,  20000);
  const { data: sensors   } = usePolling(getSensorsSummary,   20000);
  const { data: rawAnoms  } = usePolling(getTopAnomalyZones,  30000);

  const s  = stats?.capteurs     ?? {};
  const iv = stats?.interventions ?? {};

  const fsmFunnel   = buildFSMFunnel(intervs);
  const zoneAnomaly = buildZoneAnomalies(rawAnoms);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── Row 1: KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem" }}>
        <StatCard
          label="Capteurs actifs"
          value={s.actifs ?? "…"}
          sub={`sur ${s.total ?? "—"} déployés`}
          color="var(--accent)"
          badge={{ type: "blue", text: "live" }}
        />
        <StatCard
          label="Anomalies 24h"
          value={stats?.anomalies_24h ?? "…"}
          color="var(--amber)"
          badge={{ type: "amber", text: "surveillance" }}
        />
        <StatCard
          label="IQA moyen PM2.5"
          value={stats?.iqa_moyen ?? "—"}
          sub="µg/m³ — 24h"
          color="var(--green)"
          badge={{ type: "green", text: "µg/m³" }}
        />
        <StatCard
          label="Interventions en cours"
          value={iv.en_cours ?? "…"}
          sub={`${iv.terminees ?? 0} terminées`}
          color="var(--red)"
          badge={{ type: "red", text: "urgent" }}
        />
      </div>

      {/* ── Row 2: FSM funnel + zone anomaly chart ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>

        {/* FSM intervention funnel */}
        <div className="card">
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)", marginBottom: 16, letterSpacing: "0.07em" }}>
            PIPELINE FSM — INTERVENTIONS EN COURS
          </div>
          {!intervs ? (
            <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              Chargement…
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={fsmFunnel} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-3)", fontFamily: "IBM Plex Mono" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--text-3)", fontFamily: "IBM Plex Mono" }} />
                  <Tooltip content={<SimpleTooltip unit=" interventions" />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {fsmFunnel.map((s, i) => (
                      <Cell key={i} fill={s.color} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* stage pills */}
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {fsmFunnel.map(s => (
                  <div key={s.key} style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "2px 10px", borderRadius: 3,
                    border: `1px solid ${s.color}`,
                    background: "var(--bg)",
                    fontFamily: "var(--font-mono)", fontSize: 10, color: s.color,
                  }}>
                    <span style={{ fontWeight: 700 }}>{s.count}</span>
                    <span style={{ opacity: 0.7 }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Top 5 zones by anomalies */}
        <div className="card">
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)", marginBottom: 16, letterSpacing: "0.07em" }}>
            TOP 5 ZONES — ANOMALIES 24H
          </div>
          {!rawAnoms ? (
            <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              Chargement…
            </div>
          ) : zoneAnomaly.length === 0 ? (
            <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              Aucune anomalie récente
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={zoneAnomaly} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "var(--text-3)", fontFamily: "IBM Plex Mono" }} />
                  <YAxis type="category" dataKey="zone" width={80} tick={{ fontSize: 10, fill: "var(--text-2)", fontFamily: "IBM Plex Mono" }} />
                  <Tooltip content={<SimpleTooltip unit=" anomalies" />} />
                  <Bar dataKey="count" fill="var(--amber)" fillOpacity={0.85} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      </div>

      {/* ── Row 3: Sensor status bars + Vehicle fleet ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>

        {/* Sensor status breakdown */}
        <div className="card">
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)", marginBottom: 14, letterSpacing: "0.07em" }}>
            STATUTS CAPTEURS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              ["actif",          s.actifs,         "var(--accent)"],
              ["signale",        s.signales,        "var(--amber)"],
              ["en_maintenance", s.en_maintenance,  "var(--purple)"],
              ["hors_service",   s.hors_service,    "var(--red)"],
            ].map(([key, val, color]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, width: 120, color: "var(--text-2)" }}>
                  {key.replace(/_/g, " ")}
                </span>
                <div style={{ flex: 1, height: 5, background: "var(--bg-3)", borderRadius: 3 }}>
                  <div style={{
                    width: `${Math.round(((val ?? 0) / (s.total || 1)) * 100)}%`,
                    height: 5, background: color, borderRadius: 3, transition: "width 0.5s",
                  }} />
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, width: 28, textAlign: "right", color }}>
                  {val ?? 0}
                </span>
              </div>
            ))}
          </div>
          {/* taux erreur moyen */}
          {sensors && (
            <div style={{
              marginTop: 16, padding: "8px 12px", borderRadius: "var(--radius)",
              background: "var(--bg)", border: "1px solid var(--border)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)" }}>
                Taux d'erreur moyen
              </span>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600,
                color: parseFloat(sensors.taux_erreur_moyen) > 0.1 ? "var(--red)" : "var(--green)",
              }}>
                {sensors.taux_erreur_moyen != null
                  ? `${(parseFloat(sensors.taux_erreur_moyen) * 100).toFixed(1)}%`
                  : "—"}
              </span>
            </div>
          )}
        </div>

        {/* Vehicle fleet status */}
        <div className="card">
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)", marginBottom: 14, letterSpacing: "0.07em" }}>
            FLOTTE VÉHICULES AUTONOMES
          </div>
          {!vehicles ? (
            <div style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              Chargement…
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <VehicleBar label="stationnés"  value={vehicles.stationnes} total={vehicles.total} color="var(--purple)" />
              <VehicleBar label="en route"    value={vehicles.en_route}   total={vehicles.total} color="var(--accent)" />
              <VehicleBar label="en panne"    value={vehicles.en_panne}   total={vehicles.total} color="var(--red)"    />
              <VehicleBar label="arrivés"     value={vehicles.arrives}    total={vehicles.total} color="var(--green)"  />
            </div>
          )}
          {vehicles && (
            <div style={{
              marginTop: 16, padding: "8px 12px", borderRadius: "var(--radius)",
              background: "var(--bg)", border: "1px solid var(--border)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)" }}>
                Flotte totale
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
                {vehicles.total} véhicules
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 4: Recent anomalies table ── */}
      <div className="card">
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)", marginBottom: 12, letterSpacing: "0.07em" }}>
          ANOMALIES RÉCENTES
        </div>
        {!anomalies?.length ? (
          <div style={{ color: "var(--text-3)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
            Aucune anomalie récente
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Capteur</th>
                <th>Zone</th>
                <th>Type</th>
                <th>Valeur</th>
                <th>Horodatage</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.slice(0, 10).map(a => (
                <tr key={a.mesure_id}>
                  <td style={{ fontFamily: "var(--font-mono)" }}>C-{a.capteur_id}</td>
                  <td>{a.zone_nom}</td>
                  <td><span className="badge badge-amber">{a.type_mesure}</span></td>
                  <td style={{ fontFamily: "var(--font-mono)", color: "var(--red)" }}>
                    {a.valeur} {a.unite}
                  </td>
                  <td style={{ color: "var(--text-2)", fontSize: 11 }}>
                    {new Date(a.timestamp).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}