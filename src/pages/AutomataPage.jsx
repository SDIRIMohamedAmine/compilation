// pages/AutomataPage.jsx — FSM viewer with clean SVG layout
import { useState } from "react";
import { getSensors, getFSMStatus, triggerFSM } from "../services/api";
import { useApi } from "../hooks/useApi";

// ── FSM definitions ───────────────────────────────────────────────────────────
const FSM_DEFS = {
  capteur: {
    states: ["inactif", "actif", "signale", "en_maintenance", "hors_service"],
    edges: [
      ["inactif",        "installation",      "actif",          "normal"],
      ["actif",          "detection anomalie","signale",        "danger"],
      ["actif",          "panne",             "hors_service",   "danger"],
      ["signale",        "signalement",       "en_maintenance", "normal"],
      ["signale",        "panne",             "hors_service",   "danger"],
      ["en_maintenance", "reparation",        "actif",          "recovery"],
      ["en_maintenance", "panne",             "hors_service",   "danger"],
      ["hors_service",   "remise en service", "actif",          "recovery"],
    ],
    terminal: ["hors_service"],
  },
  intervention: {
    states: ["demande", "tech1_assigne", "tech2_valide", "ia_valide", "termine"],
    edges: [
      ["demande",       "assignation tech1","tech1_assigne", "normal"],
      ["tech1_assigne", "validation tech2", "tech2_valide",  "normal"],
      ["tech2_valide",  "validation ia",    "ia_valide",     "normal"],
      ["ia_valide",     "cloture",          "termine",       "normal"],
    ],
    terminal: ["termine"],
  },
  vehicule: {
    states: ["stationne", "en_route", "arrive", "en_panne"],
    edges: [
      ["stationne", "depart",     "en_route", "normal"],
      ["en_route",  "arrivee",    "arrive",   "normal"],
      ["en_route",  "panne",      "en_panne", "danger"],
      ["en_panne",  "reparation", "en_route", "recovery"],
      ["arrive",    "depart",     "en_route", "normal"],
    ],
    terminal: [],
  },
};

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
  remise_en_service: "Remettre en service",
  assignation_tech1: "Assigner Tech 1", validation_tech2: "Valider Tech 2",
  validation_ia: "Valider IA", cloture: "Clôturer",
  depart: "Départ", arrivee: "Arrivée",
};

const STATE_LABELS = {
  inactif: "INACTIF", actif: "ACTIF", signale: "SIGNALÉ",
  en_maintenance: "MAINTENANCE", hors_service: "HORS SERVICE",
  demande: "DEMANDE", tech1_assigne: "TECH 1", tech2_valide: "TECH 2",
  ia_valide: "IA VALIDÉ", termine: "TERMINÉ",
  stationne: "STATIONNÉ", en_route: "EN ROUTE", en_panne: "EN PANNE", arrive: "ARRIVÉ",
};

// ── SVG FSM Diagram ───────────────────────────────────────────────────────────
//
// Three-lane layout:
//   TOP LANE   (y ≈ 30..90)  — forward arcs, stacked upward by slot
//   NODE ROW   (y = 165)     — state boxes, rendered LAST (always on top)
//   BOTTOM LANE(y ≈ 255+)    — backward / recovery arcs, stacked downward
//
// Each label gets a solid dark pill so it is always legible over any path.
//
function FSMGraph({ entityType, currentState }) {
  const def = FSM_DEFS[entityType];
  if (!def) return null;

  const { states, edges } = def;
  const n = states.length;

  // geometry
  const SVG_W   = 880;
  const NODE_Y  = 165;
  const NODE_W  = 116;
  const NODE_H  = 40;
  const COL_W   = SVG_W / n;
  const FWD_BASE  = 90;   // control-point y for first forward arc (lower = closer to nodes)
  const FWD_STEP  = 24;   // each additional forward arc is this much higher
  const BACK_BASE = 258;  // control-point y for first backward arc
  const BACK_STEP = 26;

  // count backward edges to compute SVG height
  const backEdges = edges.filter(([f,,t]) => states.indexOf(t) < states.indexOf(f));
  const SVG_H = BACK_BASE + backEdges.length * BACK_STEP + 32;

  const cx = (i) => COL_W * i + COL_W / 2;

  const edgeColor = (style) =>
    style === "danger"   ? "#ff5252" :
    style === "recovery" ? "#00e676" : "#4a6880";

  const nodeColors = (s) =>
    s === currentState
      ? { fill: "#003d4d", stroke: "#00d4ff", text: "#00d4ff" }
      : def.terminal?.includes(s)
      ? { fill: "#200a0a", stroke: "#5a1515", text: "#a04040" }
      : { fill: "#13171d", stroke: "#252e3a", text: "#5a7088" };

  // pill-shaped label with solid background — always readable
  const Pill = ({ x, y, label, color }) => {
    const chars = label.length;
    const pw = Math.max(chars * 6.4 + 10, 44);
    return (
      <g>
        <rect x={x - pw / 2} y={y - 11} width={pw} height={15} rx="3"
          fill="#0c1016" stroke={color} strokeWidth="0.6" opacity="0.96" />
        <text x={x} y={y} textAnchor="middle"
          fill={color} fontSize="9" fontFamily="IBM Plex Mono" fontWeight="500">
          {label}
        </text>
      </g>
    );
  };

  // per-edge arrowhead markers (unique IDs prevent colour bleed)
  const Markers = () => (
    <defs>
      {edges.map((e, i) => {
        const c = edgeColor(e[3]);
        return (
          <marker key={i} id={`m${entityType}${i}`}
            markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={c} />
          </marker>
        );
      })}
    </defs>
  );

  const renderEdge = ([from, event, to, style], idx) => {
    const fi = states.indexOf(from);
    const ti = states.indexOf(to);
    if (fi === ti) return null;

    const color  = edgeColor(style);
    const dash   = style === "recovery" ? "5 3" : "none";
    const mkId   = `m${entityType}${idx}`;
    const isBack = ti < fi;

    const sx = cx(fi);
    const ex = cx(ti);

    if (isBack) {
      // ── backward arc below nodes ────────────────────────────────────────
      const slot  = backEdges.findIndex(([,e]) => e === event);
      const ctrlY = BACK_BASE + slot * BACK_STEP;
      // exits bottom of `from`, enters bottom of `to`
      const d = `M ${sx} ${NODE_Y + NODE_H / 2}`
              + ` C ${sx} ${ctrlY} ${ex} ${ctrlY} ${ex} ${NODE_Y + NODE_H / 2}`;
      const lx = (sx + ex) / 2;
      const ly = ctrlY + 14;
      return (
        <g key={`${from}-${event}`}>
          <path d={d} fill="none" stroke={color} strokeWidth="1.5"
            strokeDasharray={dash} markerEnd={`url(#${mkId})`} opacity="0.85" />
          <Pill x={lx} y={ly} label={event} color={color} />
        </g>
      );
    }

    // ── forward arc ────────────────────────────────────────────────────────
    // Count forward arcs that leave the same source node
    const fwdFromHere = edges.filter(([f,,t], i2) =>
      f === from && states.indexOf(t) > states.indexOf(f)
    );
    const slot   = fwdFromHere.findIndex(([,e]) => e === event);
    const isAdj  = Math.abs(ti - fi) === 1;

    if (isAdj && fwdFromHere.length === 1) {
      // single adjacent edge: clean straight line at node centre height
      const startX = sx + NODE_W / 2;
      const endX   = ex - NODE_W / 2;
      const d = `M ${startX} ${NODE_Y} L ${endX} ${NODE_Y}`;
      const lx = (startX + endX) / 2;
      const ly = NODE_Y - 16;
      return (
        <g key={`${from}-${event}`}>
          <path d={d} fill="none" stroke={color} strokeWidth="1.5"
            strokeDasharray={dash} markerEnd={`url(#${mkId})`} opacity="0.85" />
          <Pill x={lx} y={ly} label={event} color={color} />
        </g>
      );
    }

    // arc above nodes — each slot gets its own height so labels don't stack
    const ctrlY  = FWD_BASE - slot * FWD_STEP;
    const startX = sx + NODE_W / 2;
    const endX   = ex - NODE_W / 2;
    const cpx    = (startX + endX) / 2;
    const d = `M ${startX} ${NODE_Y - NODE_H / 2}`
            + ` Q ${cpx} ${ctrlY} ${endX} ${NODE_Y - NODE_H / 2}`;
    const lx = cpx;
    const ly = ctrlY - 10;

    return (
      <g key={`${from}-${event}`}>
        <path d={d} fill="none" stroke={color} strokeWidth="1.5"
          strokeDasharray={dash} markerEnd={`url(#${mkId})`} opacity="0.85" />
        <Pill x={lx} y={ly} label={event} color={color} />
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: "100%", display: "block" }}>
      <Markers />
      {/* edges first → behind nodes */}
      {edges.map((e, i) => renderEdge(e, i))}
      {/* nodes last → always on top */}
      {states.map((s, i) => {
        const x = cx(i);
        const c = nodeColors(s);
        const active = s === currentState;
        return (
          <g key={s}>
            {active && (
              <rect x={x - NODE_W / 2 - 3} y={NODE_Y - NODE_H / 2 - 3}
                width={NODE_W + 6} height={NODE_H + 6} rx="8"
                fill="none" stroke="#00d4ff" strokeWidth="1" opacity="0.3" />
            )}
            <rect x={x - NODE_W / 2} y={NODE_Y - NODE_H / 2}
              width={NODE_W} height={NODE_H} rx="6"
              fill={c.fill} stroke={c.stroke} strokeWidth={active ? 2 : 1} />
            <text x={x} y={NODE_Y + 5} textAnchor="middle"
              fill={c.text} fontSize="10" fontWeight={active ? "600" : "400"}
              fontFamily="IBM Plex Mono" letterSpacing="0.4">
              {STATE_LABELS[s] || s}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Transition table ──────────────────────────────────────────────────────────
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
            <td style={{ fontFamily: "var(--font-mono)", color: "var(--text-2)" }}>
              {STATE_LABELS[from] || from}
            </td>
            <td style={{ fontFamily: "var(--font-mono)", color:
              style === "danger" ? "var(--red)" :
              style === "recovery" ? "var(--green)" : "var(--amber)" }}>
              {ev}
            </td>
            <td style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
              {STATE_LABELS[to] || to}
            </td>
            <td>
              <span className={`badge ${
                style === "danger" ? "badge-red" :
                style === "recovery" ? "badge-green" : "badge-blue"}`}>
                {style}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AutomataPage() {
  const [entityType, setEntityType] = useState("capteur");
  const [entityId,   setEntityId]   = useState("");
  const [fsmData,    setFsmData]    = useState(null);
  const [fsmLoading, setFsmLoading] = useState(false);
  const [fsmError,   setFsmError]   = useState(null);
  const [actionMsg,  setActionMsg]  = useState(null);
  const [activeTab,  setActiveTab]  = useState("control");

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
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 980 }}>

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
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)" }}>
        {[["control", "Panneau de contrôle"], ["tables", "Tables de transition"]].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
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

      {/* ── CONTROL TAB ── */}
      {activeTab === "control" && (
        <>
          <div style={{ display: "flex", gap: 8 }}>
            {Object.keys(FSM_DEFS).map(t => (
              <button key={t}
                className={`btn ${entityType === t ? "btn-primary" : ""}`}
                onClick={() => { setEntityType(t); setFsmData(null); setEntityId(""); setActionMsg(null); }}>
                {t === "capteur" ? "◉ Capteur" : t === "intervention" ? "⚙ Intervention" : "⬡ Véhicule"}
              </button>
            ))}
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em" }}>
                DIAGRAMME — {entityType.toUpperCase()}
                {fsmData && (
                  <span style={{ color: "var(--accent)", marginLeft: 10 }}>
                    État: {STATE_LABELS[fsmData.state] || fsmData.state}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 14, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)" }}>
                <span><span style={{ color: "#4a6880" }}>──</span> normal</span>
                <span><span style={{ color: "#ff5252" }}>──</span> danger</span>
                <span><span style={{ color: "#00e676" }}>╌╌</span> recovery</span>
              </div>
            </div>
            <FSMGraph entityType={entityType} currentState={fsmData?.state} />
          </div>

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
                  <input type="number" placeholder="Ex: 1" style={{ width: 140 }}
                    value={entityId} onChange={e => setEntityId(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && loadFSM()} />
                </div>
              )}
              <button className="btn btn-primary" onClick={loadFSM} disabled={!entityId || fsmLoading}>
                {fsmLoading ? "…" : "Charger FSM"}
              </button>
            </div>
          </div>

          {fsmError && (
            <div className="card" style={{ borderColor: "var(--red)", background: "var(--red-dim)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--red)" }}>✕ {fsmError}</span>
            </div>
          )}

          {fsmData && (
            <div className="card fade-up">
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em", marginBottom: 14 }}>
                ÉTAT — {entityType.toUpperCase()} #{entityId}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{
                  padding: "8px 18px", borderRadius: "var(--radius)",
                  background: "var(--accent-dim)", border: "1px solid var(--accent)",
                  fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent)", fontWeight: 600,
                }}>
                  {STATE_LABELS[fsmData.state] || fsmData.state}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-2)" }}>
                  Événements valides:&nbsp;
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>
                    {currentEvents.length ? currentEvents.join(", ") : "— état final —"}
                  </span>
                </div>
              </div>
              {currentEvents.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {currentEvents.map(ev => {
                    const isDanger   = ev === "panne" || ev === "detection_anomalie";
                    const isRecovery = ev === "reparation" || ev === "remise_en_service";
                    return (
                      <button key={ev}
                        className={`btn ${isDanger ? "btn-danger" : ""}`}
                        style={isRecovery ? { borderColor: "var(--green)", color: "var(--green)" } : {}}
                        onClick={() => handleTrigger(ev)}>
                        {EVENT_LABELS[ev] || ev}
                      </button>
                    );
                  })}
                </div>
              )}
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

      {/* ── TABLES TAB ── */}
      {activeTab === "tables" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {Object.keys(FSM_DEFS).map(type => (
            <div key={type} className="card">
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em", marginBottom: 14 }}>
                {type.toUpperCase()} — DIAGRAMME + TABLE
              </div>
              <div style={{ marginBottom: 20 }}>
                <FSMGraph entityType={type} currentState={null} />
              </div>
              <TransitionTable entityType={type} />
            </div>
          ))}
          <div className="card" style={{ borderColor: "var(--amber)", background: "var(--amber-dim)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)", letterSpacing: "0.08em", marginBottom: 8 }}>
              ⚠ NOTE SUR LES ÉTATS
            </div>
            <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.7 }}>
              <strong style={{ color: "var(--text)" }}>INACTIF / STATIONNÉ / DEMANDE</strong> sont des états <em>initiaux</em> — une entité ne peut pas y revenir une fois progressée.<br />
              <strong style={{ color: "var(--text)" }}>TERMINÉ</strong> (intervention) est un état terminal sans sortie.<br />
              <strong style={{ color: "var(--text)" }}>HORS SERVICE / EN PANNE</strong> sont récupérables via <em>remise_en_service</em> / <em>reparation</em>.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}