// services/api.js — all HTTP calls to FastAPI backend
// Uses native fetch only, no axios

const BASE = "http://localhost:8000";

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Dashboard ─────────────────────────────────────────────────────────────
export const getDashboardStats   = () => req("/dashboard/stats");
export const getTimeseries       = (type = "pm25", hours = 24) =>
  req(`/dashboard/timeseries?type_mesure=${type}&hours=${hours}`);
export const getRecentAnomalies  = (limit = 15) =>
  req(`/dashboard/anomalies/recent?limit=${limit}`);
export const getTopCitoyens      = (limit = 10) =>
  req(`/dashboard/citoyens/top?limit=${limit}`);

// ── Sensors ───────────────────────────────────────────────────────────────
export const getSensors = (params = {}) => {
  const clean = Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== ""));
  const qs = new URLSearchParams(clean).toString();
  return req(`/sensors/${qs ? "?" + qs : ""}`);
};
export const getSensor           = (id) => req(`/sensors/${id}`);
export const getSensorMesures    = (id, limit = 50) =>
  req(`/sensors/${id}/mesures?limit=${limit}`);
export const updateSensorStatut  = (id, statut) =>
  req(`/sensors/${id}/statut`, { method: "PATCH", body: JSON.stringify({ statut }) });
export const getSensorsSummary   = () => req("/sensors/stats/summary");

// ── Zones ─────────────────────────────────────────────────────────────────
export const getZones            = () => req("/zones/");
export const getZone             = (id) => req(`/zones/${id}`);
export const getPollutionRanking = () => req("/zones/ranking/pollution");
export const getZonePollution    = (id) => req(`/zones/${id}/pollution`);

// ── Compiler / NL Query ───────────────────────────────────────────────────
export const runNLQuery          = (query) =>
  req("/query/", { method: "POST", body: JSON.stringify({ query }) });
export const getQueryExamples    = () => req("/query/examples");

// ── Interventions ─────────────────────────────────────────────────────────
export const getInterventions    = (statut = null) =>
  req(`/interventions/${statut ? "?statut=" + statut : ""}`);
export const createIntervention  = (body) =>
  req("/interventions/", { method: "POST", body: JSON.stringify(body) });
export const advanceIntervention = (id, body = {}) =>
  req(`/interventions/${id}/avancer`, { method: "PATCH", body: JSON.stringify(body) });

// ── Automata FSM ──────────────────────────────────────────────────────────
export const getFSMStatus        = (type, id) =>
  req(`/automata/${type}/${id}/status`);
export const triggerFSM          = (type, id, event, extra = {}) =>
  req(`/automata/${type}/${id}/trigger`, {
    method: "POST",
    body: JSON.stringify({ event, declencheur: "frontend", ...extra }),
  });
export const verifyFSMSequence   = (type, id, events) =>
  req(`/automata/${type}/${id}/verify`, {
    method: "POST",
    body: JSON.stringify({ events }),
  });
export const runSweeper          = () =>
  req("/automata/sweep", { method: "POST" });