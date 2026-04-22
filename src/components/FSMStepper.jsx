// components/FSMStepper.jsx
const STATES = {
  capteur:      ["inactif", "actif", "signale", "en_maintenance", "hors_service"],
  intervention: ["demande", "tech1_assigne", "tech2_valide", "ia_valide", "termine"],
  vehicule:     ["stationne", "en_route", "en_panne", "arrive"],
};

const LABELS = {
  inactif: "INACTIF", actif: "ACTIF", signale: "SIGNALÉ",
  en_maintenance: "MAINTENANCE", hors_service: "HORS SERVICE",
  demande: "DEMANDE", tech1_assigne: "TECH 1", tech2_valide: "TECH 2",
  ia_valide: "IA VALIDÉ", termine: "TERMINÉ",
  stationne: "STATIONNÉ", en_route: "EN ROUTE", en_panne: "EN PANNE", arrive: "ARRIVÉ",
};

export default function FSMStepper({ entityType, currentState, errorState }) {
  const states = STATES[entityType] || [];
  const curIdx = states.indexOf(currentState);

  return (
    <div className="fsm-stepper">
      {states.map((s, i) => {
        const isActive = s === currentState;
        const isDone   = i < curIdx && s !== "hors_service" && s !== "en_panne";
        const isError  = s === errorState || s === "hors_service" || s === "en_panne";

        let cls = "fsm-step";
        if (isActive && isError) cls += " error";
        else if (isActive)       cls += " active";
        else if (isDone)         cls += " done";

        return (
          <span key={s} style={{ display: "flex", alignItems: "center" }}>
            <span className={cls}>
              {isActive && !isError && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />}
              {isActive &&  isError && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--red)", display: "inline-block" }} />}
              {isDone && "✓ "}
              {LABELS[s] || s}
            </span>
            {i < states.length - 1 && (
              <span className="fsm-arrow">→</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
