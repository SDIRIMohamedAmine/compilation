# -*- coding: utf-8 -*-
"""
api/routes/interventions.py
FSM-driven intervention workflow endpoints.
"""
import sys, os
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from fastapi import APIRouter, HTTPException
from database.db_utils import fetch_all, fetch_one, execute

router = APIRouter()

FSM_TRANSITIONS = {
    "demande":       "tech1_assigne",
    "tech1_assigne": "tech2_valide",
    "tech2_valide":  "ia_valide",
    "ia_valide":     "termine",
}


# ── Techniciens (needed by frontend to pick from) ─────────────────────────────

@router.get("/techniciens")
def get_techniciens(disponible: bool = None):
    where = "WHERE disponible = TRUE" if disponible else ""
    rows = fetch_all(f"""
        SELECT technicien_id, nom, prenom, specialite, disponible
        FROM techniciens
        {where}
        ORDER BY disponible DESC, nom
    """)
    return [dict(r) for r in rows]


# ── Interventions CRUD ────────────────────────────────────────────────────────

@router.get("/")
def get_interventions(statut: str = None):
    extra  = "WHERE i.statut = %s" if statut else ""
    params = (statut,) if statut else None
    rows = fetch_all(f"""
        SELECT i.*,
               c.type_capteur, z.nom AS zone_nom,
               t1.nom || ' ' || t1.prenom AS tech1_nom,
               t2.nom || ' ' || t2.prenom AS tech2_nom
        FROM interventions i
        JOIN capteurs c    ON c.capteur_id     = i.capteur_id
        JOIN zones z       ON z.zone_id        = c.zone_id
        LEFT JOIN techniciens t1 ON t1.technicien_id = i.technicien1_id
        LEFT JOIN techniciens t2 ON t2.technicien_id = i.technicien2_id
        {extra}
        ORDER BY i.date_demande DESC
    """, params)
    return [dict(r) for r in rows]


@router.get("/{intervention_id}")
def get_intervention(intervention_id: int):
    row = fetch_one("""
        SELECT i.*, c.type_capteur, z.nom AS zone_nom,
               t1.nom || ' ' || t1.prenom AS tech1_nom,
               t2.nom || ' ' || t2.prenom AS tech2_nom
        FROM interventions i
        JOIN capteurs c    ON c.capteur_id     = i.capteur_id
        JOIN zones z       ON z.zone_id        = c.zone_id
        LEFT JOIN techniciens t1 ON t1.technicien_id = i.technicien1_id
        LEFT JOIN techniciens t2 ON t2.technicien_id = i.technicien2_id
        WHERE i.intervention_id = %s
    """, (intervention_id,))
    if not row:
        raise HTTPException(404, "Intervention not found")
    return dict(row)


@router.post("/")
def create_intervention(body: dict):
    capteur_id  = body.get("capteur_id")
    description = body.get("description", "")
    priorite    = body.get("priorite", "normale")
    if not capteur_id:
        raise HTTPException(400, "capteur_id required")
    row = fetch_one("""
        INSERT INTO interventions (capteur_id, description, priorite)
        VALUES (%s, %s, %s) RETURNING intervention_id
    """, (capteur_id, description, priorite))
    execute("UPDATE capteurs SET statut='signale' WHERE capteur_id=%s", (capteur_id,))
    return {"intervention_id": row["intervention_id"], "statut": "demande"}


@router.patch("/{intervention_id}/avancer")
def avancer_fsm(intervention_id: int, body: dict = {}):
    row = fetch_one(
        "SELECT statut FROM interventions WHERE intervention_id=%s",
        (intervention_id,)
    )
    if not row:
        raise HTTPException(404, "Intervention not found")

    current = row["statut"]
    next_s  = FSM_TRANSITIONS.get(current)
    if not next_s:
        raise HTTPException(400, f"Already in final state: {current}")

    tech_id = body.get("technicien_id")

    if next_s == "tech1_assigne" and tech_id:
        execute("""
            UPDATE interventions SET statut=%s, technicien1_id=%s
            WHERE intervention_id=%s
        """, (next_s, tech_id, intervention_id))
        execute(
            "UPDATE techniciens SET disponible=FALSE WHERE technicien_id=%s",
            (tech_id,)
        )
    elif next_s == "tech2_valide" and tech_id:
        execute("""
            UPDATE interventions SET statut=%s, technicien2_id=%s
            WHERE intervention_id=%s
        """, (next_s, tech_id, intervention_id))
    elif next_s == "ia_valide":
        execute("""
            UPDATE interventions SET statut=%s, validation_ia=TRUE
            WHERE intervention_id=%s
        """, (next_s, intervention_id))
    elif next_s == "termine":
        execute("""
            UPDATE interventions
            SET statut=%s, date_terminaison=NOW()
            WHERE intervention_id=%s
        """, (next_s, intervention_id))
        # Restore sensor + free technician
        inv = fetch_one(
            "SELECT capteur_id, technicien1_id FROM interventions WHERE intervention_id=%s",
            (intervention_id,)
        )
        if inv:
            execute(
                "UPDATE capteurs SET statut='actif', taux_erreur=0.0 WHERE capteur_id=%s",
                (inv["capteur_id"],)
            )
            if inv["technicien1_id"]:
                execute(
                    "UPDATE techniciens SET disponible=TRUE WHERE technicien_id=%s",
                    (inv["technicien1_id"],)
                )
        # Audit log
        execute("""
            INSERT INTO fsm_transitions
                (entity_type, entity_id, etat_avant, etat_apres, evenement, declencheur)
            VALUES ('intervention', %s, %s, %s, 'cloture', 'api')
        """, (intervention_id, current, next_s))
    else:
        execute(
            "UPDATE interventions SET statut=%s WHERE intervention_id=%s",
            (next_s, intervention_id)
        )

    # Log every transition (not just cloture)
    execute("""
        INSERT INTO fsm_transitions
            (entity_type, entity_id, etat_avant, etat_apres, evenement, declencheur)
        VALUES ('intervention', %s, %s, %s, %s, 'api')
        ON CONFLICT DO NOTHING
    """, (intervention_id, current, next_s, f"avancer_vers_{next_s}"))

    return {
        "intervention_id": intervention_id,
        "statut_avant":    current,
        "statut_apres":    next_s,
    }
