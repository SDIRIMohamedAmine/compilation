// pages/Dashboard.jsx — Phase 4 (stats + charts)
import { useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import StatCard  from "../components/StatCard";
import { useApi, usePolling } from "../hooks/useApi";
import {
  getDashboardStats, getTimeseries, getRecentAnomalies,
} from "../services/api";

const STATUS_COLOR = {
  actif: "green", signale: "amber", en_maintenance: "blue",
  hors_service: "red", inactif: "purple",
};

function buildChartData(rows) {
  // group by heure, pivot zone -> value
  const map = {};
  const zones = new Set();
  rows.forEach(r => {
    const h = new Date(r.heure).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    if (!map[h]) map[h] = { heure: h };
    map[h][r.zone] = parseFloat(r.valeur);
    zones.add(r.zone);
  });
  return { data: Object.values(map), zones: [...zones] };
}

const ZONE_COLORS = ["#00d4ff","#00e676","#ffab40","#ff5252","#ce93d8","#80cbc4"];

export default function Dashboard() {
  const { data: stats,   loading: sLoad } = usePolling(getDashboardStats,  15000);
  const { data: tsRows,  loading: tLoad } = usePolling(() => getTimeseries("pm25", 24), 30000);
  const { data: anomalies }               = usePolling(getRecentAnomalies,  20000);

  const { data: chartObj } = useApi(
    useCallback(() => getTimeseries("pm25", 24), [])
  );
  const { data: chartData, zones } = chartObj
    ? buildChartData(chartObj)
    : { data: [], zones: [] };

  const s  = stats?.capteurs ?? {};
  const iv = stats?.interventions ?? {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem" }}>
        <StatCard label="Capteurs actifs"     value={sLoad ? "…" : s.actifs}
                  sub={`sur ${s.total ?? "—"} déployés`} color="var(--accent)"
                  badge={{ type: "blue", text: "live" }} />
        <StatCard label="Anomalies 24h"       value={stats?.anomalies_24h ?? "…"}
                  color="var(--amber)"
                  badge={{ type: "amber", text: "surveillance" }} />
        <StatCard label="IQA moyen PM2.5"     value={stats?.iqa_moyen ?? "…"}
                  sub="indice qualité air" color="var(--green)"
                  badge={{ type: "green", text: "µg/m³" }} />
        <StatCard label="Interventions cours" value={iv.en_cours ?? "…"}
                  sub={`${iv.terminees ?? 0} terminées`} color="var(--red)"
                  badge={{ type: "red", text: "urgent" }} />
      </div>

      {/* Sensor status mini-bars */}
      <div className="card">
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)", marginBottom: 12, letterSpacing: "0.07em" }}>
          STATUTS CAPTEURS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            ["actif",           s.actifs,         "var(--accent)"],
            ["signale",         s.signales,        "var(--amber)"],
            ["en_maintenance",  s.en_maintenance,  "var(--purple)"],
            ["hors_service",    s.hors_service,    "var(--red)"],
          ].map(([key, val, color]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, width: 110, color: "var(--text-2)" }}>
                {key.replace("_", " ")}
              </span>
              <div style={{ flex: 1, height: 5, background: "var(--bg-3)", borderRadius: 3 }}>
                <div style={{
                  width: `${Math.round((val / (s.total || 1)) * 100)}%`,
                  height: 5, background: color, borderRadius: 3, transition: "width 0.5s",
                }} />
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, width: 28, textAlign: "right", color }}>
                {val ?? 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Timeseries chart */}
      <div className="card">
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)", marginBottom: 16, letterSpacing: "0.07em" }}>
          POLLUTION PM2.5 PAR ZONE — 24H
        </div>
        {tLoad || !chartData.length ? (
          <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
            {tLoad ? "Chargement…" : "Aucune donnée"}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="heure" tick={{ fontSize: 10, fill: "var(--text-3)", fontFamily: "IBM Plex Mono" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-3)", fontFamily: "IBM Plex Mono" }} />
              <Tooltip
                contentStyle={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11 }}
                labelStyle={{ color: "var(--text-2)" }}
              />
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: "IBM Plex Mono", color: "var(--text-2)" }} />
              {zones.slice(0, 6).map((z, i) => (
                <Line key={z} type="monotone" dataKey={z}
                  stroke={ZONE_COLORS[i % ZONE_COLORS.length]}
                  dot={false} strokeWidth={1.5} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent anomalies */}
      <div className="card">
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)", marginBottom: 12, letterSpacing: "0.07em" }}>
          ANOMALIES RÉCENTES
        </div>
        {!anomalies?.length ? (
          <div style={{ color: "var(--text-3)", fontSize: 12 }}>Aucune anomalie récente</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Capteur</th><th>Zone</th><th>Type</th><th>Valeur</th><th>Horodatage</th></tr></thead>
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
