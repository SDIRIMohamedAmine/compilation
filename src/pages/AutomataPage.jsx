// pages/AutomataPage.jsx — corrected FSM viewer + control panel
import { useState, useEffect, useRef } from "react";
import { getSensors, getFSMStatus, triggerFSM } from "../services/api";
import { useApi } from "../hooks/useApi";

// ── Correct FSM definitions ──────────────────────────────────────────────────
// States listed in logical flow order (no back-arrows to initial states)
const FSM_DEFS = {
  capteur: {
    states: ["inactif", "actif", "signale", "en_maintenance", "hors_service"],
    // directed edges: [from, event, to, style]  style: normal|danger|recovery
    edges: [
      ["inactif",        "installation",       "actif",          "normal"],
      ["actif",          "detection_anomalie",  "signale",        "danger"],
      ["actif",          "panne",               "hors_service",   "danger"],
      ["signale",        "signalement",         "en_maintenance", "normal"],
      ["signale",        "panne",               "hors_service",   "danger"],
      ["en_maintenance", "reparation",          "actif",          "recovery"],
      ["en_maintenance", "panne",               "hors_service",   "danger"],
      ["hors_service",   "remise_en_service",   "actif",          "recovery"],
    ],
    terminal: ["hors_service"],   // visually distinct but NOT a dead-end (recovery exists)
  },
  intervention: {
    states: ["demande", "tech1_assigne", "tech2_valide", "ia_valide", "termine"],
    edges: [
      ["demande",       "assignation_tech1", "tech1_assigne", "normal"],
      ["tech1_assigne", "validation_tech2",  "tech2_valide",  "normal"],
      ["tech2_valide",  "validation_ia",     "ia_valide",     "normal"],
      ["ia_valide",     "cloture",           "termine",       "normal"],
    ],
    terminal: ["termine"],
  },
  vehicule: {
    states: ["stationne", "en_route", "arrive", "en_panne"],
    edges: [
      ["stationne", "depart",     "en_route",  "normal"],
      ["en_route",  "arrivee",    "arrive",    "normal"],
      ["en_route",  "panne",      "en_panne",  "danger"],
      ["en_panne",  "reparation", "en_route",  "recovery"],
      ["arrive",    "depart",     "en_route",  "normal"],   // new trip — NOT back to stationne
    ],
    terminal: [],
  },
};

// Events valid from each state (matches backend FSM exactly)
const VALID_EVENTS = {
  capteur: {
    inactif:        ["installation"],
    actif:          ["detection_anomalie", "panne"],
    signale:        ["signalement", "panne"],
    en_maintenance: ["reparation", "panne"],
    hors_service:   ["remise_en_service"],
  },
  intervention: {
    demande:        ["assignation_tech1"],
    tech1_assigne:  ["validation_tech2"],
    tech2_valide:   ["validation_ia"],
    ia_valide:      ["cloture"],
    termine:        [],
  },
  vehicule: {
    stationne: ["depart"],
    en_route:  ["arrivee", "panne"],
    en_panne:  ["reparation"],
    arrive:    ["depart"],
  },
};

const EVENT_LABELS = {
  installation: "Installer", detection_anomalie: "Anomalie",
  panne: "Panne", signalement: "Signaler", reparation: "Réparer",
  remise_en_service: "Remettre en service", assignation_tech1: "Assigner Tech 1",
  validation_tech2: "Valider Tech 2", validation_ia: "Valider IA",
  cloture: "Clôturer", depart: "Départ", arrivee: "Arrivée",
};

const STATE_LABELS = {
  inactif: "INACTIF", actif: "ACTIF", signale: "SIGNALÉ",
  en_maintenance: "MAINTENANCE", hors_service: "HORS SERVICE",
  demande: "DEMANDE", tech1_assigne: "TECH 1", tech2_valide: "TECH 2",
  ia_valide: "IA VALIDÉ", termine: "TERMINÉ",
  stationne: "STATIONNÉ", en_route: "EN ROUTE", en_panne: "EN PANNE", arrive: "ARRIVÉ",
};

// ── FSM Graph SVG component ──────────────────────────────────────────────────
function FSMGraph({ entityType, currentState }) {
  const def = FSM_DEFS[entityType];
  if (!def) return null;

  const { states, edges } = def;
  const n = states.length;

  // Layout: horizontal row with curved back-edges
  const W = 820, H = 200;
  const nodeW = 110, nodeH = 38, gap = (W - nodeW * n) / (n + 1);

  const positions = {};
  states.forEach((s, i) => {
    positions[s] = { x: gap * (i + 1) + nodeW * i + nodeW / 2, y: H / 2 };
  });

  // node colors
  const nodeColor = (s) => {
    if (s === currentState) return { fill: "#004d5e", stroke: "#00d4ff", text: "#00d4ff" };
    if (def.terminal?.includes(s)) return { fill: "#1a0a0a", stroke: "#3d0f0f", text: "#6b2020" };
    return { fill: "#13171d", stroke: "#1e2530", text: "#6b7f96" };
  };

  // edge rendering
  const renderEdge = ([from, event, to, style]) => {
    const p1 = positions[from];
    const p2 = positions[to];
    if (!p1 || !p2) return null;

    const color = style === "danger" ? "#ff5252" : style === "recovery" ? "#00e676" : "#2a3545";
    const labelColor = style === "danger" ? "#ff5252" : style === "recovery" ? "#00e676" : "#3d4f62";

    const isSelf = from === to;
    const goesBack = states.indexOf(to) < states.indexOf(from);
    const key = `${from}-${event}-${to}`;

    if (isSelf) return null;

    if (goesBack) {
      // curved arc below the line
      const mx = (p1.x + p2.x) / 2;
      const my = p1.y + 70;
      const d = `M ${p1.x} ${p1.y + nodeH / 2} Q ${mx} ${my} ${p2.x} ${p2.y + nodeH / 2}`;
      const tmx = mx, tmy = my + 12;
      return (
        <g key={key}>
          <defs>
            <marker id={`arr-${key}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={color} />
            </marker>
          </defs>
          <path d={d} fill="none" stroke={color} strokeWidth="1.5"
            strokeDasharray={style === "recovery" ? "4 3" : "none"}
            markerEnd={`url(#arr-${key})`} opacity="0.7" />
          <text x={tmx} y={tmy} textAnchor="middle"
            fill={labelColor} fontSize="9" fontFamily="IBM Plex Mono">
            {event.replace(/_/g, " ")}
          </text>
        </g>
      );
    }

    // forward edge — straight or slightly curved if multiple edges between same pair
    const dx = p2.x - p1.x;
    // check if there's another edge going the same direction between same nodes
    const siblings = edges.filter(([f, , t]) => f === from && t === to);
    const myIdx = siblings.findIndex(([, e]) => e === event);
    const offset = (myIdx - (siblings.length - 1) / 2) * 18;

    const mx = (p1.x + p2.x) / 2;
    const my = p1.y - 30 + offset;
    const startX = p1.x + nodeW / 2, startY = p1.y - nodeH / 2;
    const endX = p2.x - nodeW / 2, endY = p2.y - nodeH / 2;
    const d = siblings.length > 1
      ? `M ${startX} ${startY} Q ${mx} ${my} ${endX} ${endY}`
      : `M ${startX} ${p1.y} L ${endX} ${p2.y}`;

    const tmx = mx, tmy = siblings.length > 1 ? my - 8 : p1.y - 14;

    return (
      <g key={key}>
        <defs>
          <marker id={`arr-${key}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={color} />
          </marker>
        </defs>
        <path d={d} fill="none" stroke={color} strokeWidth="1.5"
          strokeDasharray={style === "recovery" ? "4 3" : "none"}
          markerEnd={`url(#arr-${key})`} opacity="0.75" />
        <text x={tmx} y={tmy} textAnchor="middle"
          fill={labelColor} fontSize="9" fontFamily="IBM Plex Mono">
          {event.replace(/_/g, " ")}
        </text>
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${W} ${H + 60}`} style={{ width: "100%", overflow: "visible" }}>
      {/* edges first (behind nodes) */}
      {edges.map(renderEdge)}

      {/* nodes */}
      {states.map((s) => {
        const { x, y } = positions[s];
        const c = nodeColor(s);
        return (
          <g key={s}>
            <rect
              x={x - nodeW / 2} y={y - nodeH / 2}
              width={nodeW} height={nodeH} rx="5"
              fill={c.fill} stroke={c.stroke} strokeWidth={s === currentState ? 2 : 1}
            />
            {s === currentState && (
              <rect
                x={x - nodeW / 2 - 2} y={y - nodeH / 2 - 2}
                width={nodeW + 4} height={nodeH + 4} rx="6"
                fill="none" stroke={c.stroke} strokeWidth="1" opacity="0.3"
              />
            )}
            <text x={x} y={y + 4} textAnchor="middle"
              fill={c.text} fontSize="10" fontWeight={s === currentState ? "600" : "400"}
              fontFamily="IBM Plex Mono">
              {STATE_LABELS[s] || s}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Transition table component ───────────────────────────────────────────────
function TransitionTable({ entityType }) {
  const def = FSM_DEFS[entityType];
  if (!def) return null;
  return (
    <table className="data-table" style={{ fontSize: 11 }}>
      <thead>
        <tr><th>État actuel</th><th>Événement</th><th>Nouvel état</th><th>Type</th></tr>
      </thead>
      <tbody>
        {def.edges.map(([from, ev, to, style]) => (
          <tr key={`${from}-${ev}`}>
            <td style={{ fontFamily: "var(--font-mono)", color: "var(--text-2)" }}>{STATE_LABELS[from] || from}</td>
            <td style={{ fontFamily: "var(--font-mono)", color: style === "danger" ? "var(--red)" : style === "recovery" ? "var(--green)" : "var(--amber)" }}>
              {ev}
            </td>
            <td style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{STATE_LABELS[to] || to}</td>
            <td>
              <span className={`badge ${style === "danger" ? "badge-red" : style === "recovery" ? "badge-green" : "badge-blue"}`}>
                {style}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AutomataPage() {
  const [entityType, setEntityType] = useState("capteur");
  const [entityId,   setEntityId]   = useState("");
  const [fsmData,    setFsmData]    = useState(null);
  const [fsmLoading, setFsmLoading] = useState(false);
  const [fsmError,   setFsmError]   = useState(null);
  const [actionMsg,  setActionMsg]  = useState(null);
  const [activeTab,  setActiveTab]  = useState("control"); // control | tables

  const { data: sensors } = useApi(getSensors);

  const loadFSM = async () => {
    if (!entityId) return;
    setFsmLoading(true); setFsmError(null); setFsmData(null); setActionMsg(null);
    try {
      const d = await getFSMStatus(entityType, entityId);
      setFsmData(d);
    } catch (e) {
      setFsmError(e.message);
    } finally {
      setFsmLoading(false);
    }
  };

  const handleTrigger = async (event) => {
    setActionMsg(null);
    try {
      const r = await triggerFSM(entityType, entityId, event);
      setActionMsg({ ok: true, text: `${r.etat_avant} → ${r.etat_apres}` });
      const d = await getFSMStatus(entityType, entityId);
      setFsmData(d);
    } catch (e) {
      setActionMsg({ ok: false, text: e.message });
    }
  };

  const currentEvents = fsmData ? (VALID_EVENTS[entityType]?.[fsmData.state] || []) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 960 }}>

      {/* header */}
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", letterSpacing: "0.1em", marginBottom: 4 }}>
          MODULE 03 — AUTOMATES FSM
        </div>
        <div style={{ fontSize: 18, fontWeight: 500 }}>Automates à états finis</div>
        <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
          Visualisation des transitions · Panneau de contrôle · Tables de transition
        </div>
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {[["control", "Panneau de contrôle"], ["tables", "Tables de transition"]].map(([id, label]) => (
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

      {/* ── TAB: CONTROL PANEL ── */}
      {activeTab === "control" && (
        <>
          {/* entity type selector */}
          <div style={{ display: "flex", gap: 8 }}>
            {Object.keys(FSM_DEFS).map(t => (
              <button key={t}
                className={`btn ${entityType === t ? "btn-primary" : ""}`}
                onClick={() => { setEntityType(t); setFsmData(null); setEntityId(""); setActionMsg(null); }}>
                {t === "capteur" ? "◉ Capteur" : t === "intervention" ? "⚙ Intervention" : "⬡ Véhicule"}
              </button>
            ))}
          </div>

          {/* FSM diagram — always visible for the selected type */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em" }}>
                DIAGRAMME FSM — {entityType.toUpperCase()}
                {fsmData && <span style={{ color: "var(--accent)", marginLeft: 10 }}>
                  État actuel: {STATE_LABELS[fsmData.state] || fsmData.state}
                </span>}
              </div>
              <div style={{ display: "flex", gap: 10, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-3)" }}>
                <span><span style={{ color: "var(--text-2)" }}>━━</span> normal</span>
                <span><span style={{ color: "var(--red)" }}>━━</span> danger</span>
                <span><span style={{ color: "var(--green)" }}>╌╌</span> recovery</span>
              </div>
            </div>
            <FSMGraph entityType={entityType} currentState={fsmData?.state} />
          </div>

          {/* entity ID selector */}
          <div className="card">
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em", marginBottom: 12 }}>
              CHARGER UNE ENTITÉ
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              {entityType === "capteur" && sensors?.length ? (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 5 }}>Capteur</div>
                  <select value={entityId} onChange={e => setEntityId(e.target.value)}>
                    <option value="">— choisir —</option>
                    {sensors.map(s => (
                      <option key={s.capteur_id} value={s.capteur_id}>
                        C-{s.capteur_id} · {s.zone_nom} · {s.statut}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 5 }}>
                    {entityType === "intervention" ? "ID Intervention" : "ID Véhicule"}
                  </div>
                  <input
                    type="number" placeholder="Ex: 1" style={{ width: 140 }}
                    value={entityId} onChange={e => setEntityId(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && loadFSM()}
                  />
                </div>
              )}
              <button className="btn btn-primary" onClick={loadFSM} disabled={!entityId || fsmLoading}>
                {fsmLoading ? "…" : "Charger FSM"}
              </button>
            </div>
          </div>

          {/* FSM error */}
          {fsmError && (
            <div className="card" style={{ borderColor: "var(--red)", background: "var(--red-dim)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--red)" }}>✕ {fsmError}</span>
            </div>
          )}

          {/* FSM state + actions */}
          {fsmData && (
            <div className="card fade-up">
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em", marginBottom: 14 }}>
                ÉTAT — {entityType.toUpperCase()} #{entityId}
              </div>

              {/* state badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{
                  padding: "8px 18px", borderRadius: "var(--radius)",
                  background: "var(--accent-dim)", border: "1px solid var(--accent)",
                  fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent)", fontWeight: 600,
                }}>
                  {STATE_LABELS[fsmData.state] || fsmData.state}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-2)" }}>
                  Événements valides: <span style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>
                    {currentEvents.length ? currentEvents.join(", ") : "— état final —"}
                  </span>
                </div>
              </div>

              {/* action buttons */}
              {currentEvents.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {currentEvents.map(ev => {
                    const isDanger = ev === "panne" || ev === "detection_anomalie";
                    const isRecovery = ev === "reparation" || ev === "remise_en_service";
                    return (
                      <button
                        key={ev}
                        className={`btn ${isDanger ? "btn-danger" : ""}`}
                        style={isRecovery ? { borderColor: "var(--green)", color: "var(--green)" } : {}}
                        onClick={() => handleTrigger(ev)}
                      >
                        {EVENT_LABELS[ev] || ev}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* feedback */}
              {actionMsg && (
                <div style={{
                  marginTop: 12, padding: "8px 12px", borderRadius: "var(--radius)",
                  background: actionMsg.ok ? "var(--green-dim)" : "var(--red-dim)",
                  border: `1px solid ${actionMsg.ok ? "var(--green)" : "var(--red)"}`,
                  fontFamily: "var(--font-mono)", fontSize: 12,
                  color: actionMsg.ok ? "var(--green)" : "var(--red)",
                }}>
                  {actionMsg.ok ? "✓" : "✕"} {actionMsg.text}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── TAB: TRANSITION TABLES ── */}
      {activeTab === "tables" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {Object.entries(FSM_DEFS).map(([type]) => (
            <div key={type} className="card">
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em", marginBottom: 12 }}>
                TABLE DE TRANSITIONS — {type.toUpperCase()}
              </div>
              {/* mini diagram */}
              <div style={{ marginBottom: 16 }}>
                <FSMGraph entityType={type} currentState={null} />
              </div>
              <TransitionTable entityType={type} />
            </div>
          ))}

          {/* note on cycle vs terminal */}
          <div className="card" style={{ borderColor: "var(--amber-dim)", background: "var(--amber-dim)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)", letterSpacing: "0.08em", marginBottom: 8 }}>
              ⚠ NOTE SUR LES ÉTATS FINAUX
            </div>
            <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.7 }}>
              <strong style={{ color: "var(--text)" }}>INACTIF / STATIONNÉ / DEMANDE</strong> sont des états <em>initiaux</em> — une entité ne peut pas y revenir une fois qu'elle a progressé.<br />
              <strong style={{ color: "var(--text)" }}>TERMINÉ</strong> (intervention) est un état terminal sans sortie.<br />
              <strong style={{ color: "var(--text)" }}>HORS SERVICE</strong> (capteur) et <strong style={{ color: "var(--text)" }}>EN PANNE</strong> (véhicule) sont des états d'erreur récupérables via <em>remise_en_service</em> / <em>reparation</em>.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}