// pages/AutomataPage.jsx — Phase 3 (FSM viewer + control panel)
import { useState } from "react";
import FSMStepper from "../components/FSMStepper";
import { useApi  } from "../hooks/useApi";
import { getSensors, getFSMStatus, triggerFSM } from "../services/api";

const EVENTS = {
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
  installation: "Installer", detection_anomalie: "Anomalie détectée",
  panne: "Déclarer panne", signalement: "Signaler", reparation: "Réparer",
  remise_en_service: "Remettre en service", assignation_tech1: "Assigner Tech 1",
  validation_tech2: "Valider Tech 2", validation_ia: "Valider IA",
  cloture: "Clôturer", depart: "Départ", arrivee: "Arrivée",
};

const EVENT_STYLE = {
  panne: "btn-danger", detection_anomalie: "btn-danger",
};

export default function AutomataPage() {
  const [entityType, setEntityType] = useState("capteur");
  const [entityId,   setEntityId]   = useState("");
  const [fsmData,    setFsmData]    = useState(null);
  const [fsmLoading, setFsmLoading] = useState(false);
  const [fsmError,   setFsmError]   = useState(null);
  const [actionMsg,  setActionMsg]  = useState(null);

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
      // reload FSM state
      const d = await getFSMStatus(entityType, entityId);
      setFsmData(d);
    } catch (e) {
      setActionMsg({ ok: false, text: e.message });
    }
  };

  const currentEvents = fsmData
    ? (EVENTS[entityType]?.[fsmData.state] || [])
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 900 }}>

      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", letterSpacing: "0.1em", marginBottom: 4 }}>
          MODULE 03 — AUTOMATES FSM
        </div>
        <div style={{ fontSize: 18, fontWeight: 500 }}>Panneau de contrôle</div>
        <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
          Visualisation des états · Déclenchement d'événements
        </div>
      </div>

      {/* entity selector */}
      <div className="card">
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em", marginBottom: 12 }}>
          SÉLECTION DE L'ENTITÉ
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 5 }}>Type</div>
            <select value={entityType} onChange={e => { setEntityType(e.target.value); setFsmData(null); setEntityId(""); }}>
              <option value="capteur">Capteur</option>
              <option value="intervention">Intervention</option>
              <option value="vehicule">Véhicule</option>
            </select>
          </div>

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
              <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 5 }}>ID</div>
              <input
                type="number" placeholder="Ex: 1" style={{ width: 120 }}
                value={entityId} onChange={e => setEntityId(e.target.value)}
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

      {/* FSM state display */}
      {fsmData && (
        <div className="card fade-up">
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em", marginBottom: 14 }}>
            ÉTAT ACTUEL — {entityType.toUpperCase()} #{entityId}
          </div>

          <FSMStepper entityType={entityType} currentState={fsmData.state} />

          <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-2)" }}>
              Événements valides:
            </span>
            {currentEvents.length === 0 && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)" }}>
                — état final —
              </span>
            )}
            {currentEvents.map(ev => (
              <button
                key={ev}
                className={`btn ${EVENT_STYLE[ev] || ""}`}
                onClick={() => handleTrigger(ev)}
              >
                {EVENT_LABELS[ev] || ev}
              </button>
            ))}
          </div>

          {/* action feedback */}
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

          {/* valid events from API */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)" }}>
              API valid_events: {fsmData.valid_events?.join(", ") || "—"}
            </span>
          </div>
        </div>
      )}

      {/* FSM transition tables reference */}
      <div className="card">
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em", marginBottom: 14 }}>
          TABLE DE TRANSITIONS — RÉFÉRENCE
        </div>
        {[
          {
            title: "Capteur", type: "capteur",
            rows: [
              ["inactif","installation","actif"],
              ["actif","detection_anomalie","signale"],
              ["actif","panne","hors_service"],
              ["signale","signalement","en_maintenance"],
              ["signale","panne","hors_service"],
              ["en_maintenance","reparation","actif"],
              ["hors_service","remise_en_service","actif"],
            ]
          },
          {
            title: "Intervention", type: "intervention",
            rows: [
              ["demande","assignation_tech1","tech1_assigne"],
              ["tech1_assigne","validation_tech2","tech2_valide"],
              ["tech2_valide","validation_ia","ia_valide"],
              ["ia_valide","cloture","termine"],
            ]
          },
          {
            title: "Véhicule", type: "vehicule",
            rows: [
              ["stationne","depart","en_route"],
              ["en_route","arrivee","arrive"],
              ["en_route","panne","en_panne"],
              ["en_panne","reparation","en_route"],
              ["arrive","depart","en_route"],
            ]
          },
        ].map(({ title, rows }) => (
          <div key={title} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-2)", marginBottom: 8 }}>
              {title}
            </div>
            <table className="data-table" style={{ fontSize: 11 }}>
              <thead><tr><th>État actuel</th><th>Événement</th><th>Nouvel état</th></tr></thead>
              <tbody>
                {rows.map(([from, ev, to]) => (
                  <tr key={`${from}-${ev}`}>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--text-2)" }}>{from}</td>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--amber)" }}>{ev}</td>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
