# -*- coding: utf-8 -*-
"""
api/routes/vehicules.py

ROUTE ORDER MATTERS in FastAPI:
  Static paths (/stats/summary, /zones, /) MUST come before /{vehicule_id}
  otherwise FastAPI tries to cast "stats" or "zones" as int → 422/404.
"""
import sys, os
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from database.db_utils import fetch_all, fetch_one, execute

router = APIRouter()


# ════════════════════════════════════════════════════════
#  STATIC ROUTES  (must be first)
# ════════════════════════════════════════════════════════

@router.get("/stats/summary")
def vehicules_summary():
    row = fetch_one("""
        SELECT
            COUNT(*) FILTER (WHERE statut = 'stationne')  AS stationnes,
            COUNT(*) FILTER (WHERE statut = 'en_route')   AS en_route,
            COUNT(*) FILTER (WHERE statut = 'en_panne')   AS en_panne,
            COUNT(*) FILTER (WHERE statut = 'arrive')     AS arrives,
            COUNT(*)                                       AS total
        FROM vehicules
    """)
    return dict(row) if row else {}


@router.get("/zones")
def list_zones():
    """All zones — used by the FSM zone picker in the frontend."""
    rows = fetch_all("SELECT zone_id, nom FROM zones ORDER BY nom")
    return [dict(r) for r in rows]


@router.get("/")
def get_vehicules(
    statut:        Optional[str] = None,
    type_vehicule: Optional[str] = None,
    zone_id:       Optional[int] = None,
):
    where  = ["1=1"]
    params = []
    if statut:
        where.append("v.statut = %s");          params.append(statut)
    if type_vehicule:
        where.append("v.type_vehicule = %s");   params.append(type_vehicule)
    if zone_id:
        where.append("v.zone_actuelle_id = %s"); params.append(zone_id)

    rows = fetch_all(f"""
        SELECT
            v.vehicule_id, v.type_vehicule, v.statut,
            v.immatriculation, v.autonomie_km, v.citoyen_id,
            z.nom                        AS zone_nom,
            c.nom || ' ' || c.prenom     AS citoyen_nom
        FROM vehicules v
        LEFT JOIN zones    z ON z.zone_id    = v.zone_actuelle_id
        LEFT JOIN citoyens c ON c.citoyen_id = v.citoyen_id
        WHERE {' AND '.join(where)}
        ORDER BY v.vehicule_id
    """, params or None)
    return [dict(r) for r in rows]


# ════════════════════════════════════════════════════════
#  DYNAMIC ROUTES  (always last)
# ════════════════════════════════════════════════════════

@router.get("/{vehicule_id}")
def get_vehicule(vehicule_id: int):
    row = fetch_one("""
        SELECT
            v.*,
            z.nom                    AS zone_nom,
            c.nom || ' ' || c.prenom AS citoyen_nom
        FROM vehicules v
        LEFT JOIN zones    z ON z.zone_id    = v.zone_actuelle_id
        LEFT JOIN citoyens c ON c.citoyen_id = v.citoyen_id
        WHERE v.vehicule_id = %s
    """, (vehicule_id,))
    if not row:
        raise HTTPException(404, f"Véhicule {vehicule_id} introuvable")
    return dict(row)


@router.get("/{vehicule_id}/trajets")
def get_vehicule_trajets(vehicule_id: int, limit: int = Query(20, le=100)):
    rows = fetch_all("""
        SELECT
            t.trajet_id, t.statut, t.distance_km, t.economie_co2,
            t.timestamp_depart, t.timestamp_arrivee,
            zd.nom AS zone_depart_nom,
            za.nom AS zone_arrivee_nom
        FROM trajets t
        JOIN zones zd ON zd.zone_id = t.zone_depart_id
        JOIN zones za ON za.zone_id = t.zone_arrivee_id
        WHERE t.vehicule_id = %s
        ORDER BY t.timestamp_depart DESC
        LIMIT %s
    """, (vehicule_id, limit))
    return [dict(r) for r in rows]


@router.post("/{vehicule_id}/trigger")
def trigger_vehicule_fsm(vehicule_id: int, body: dict):
    """
    Trigger a FSM event on a vehicle.
    Body: {
        "event": "depart" | "arrivee" | "panne" | "reparation",
        "zone_depart_id":  int  (only for depart),
        "zone_arrivee_id": int  (only for depart)
    }
    """
    event = body.get("event")
    if not event:
        raise HTTPException(400, "event field required")
    try:
        from automata.fsm_vehicule import VehiculeFSM
        from automata.fsm_engine   import FSMError
        fsm    = VehiculeFSM(vehicule_id)
        kwargs = {k: v for k, v in body.items() if k != "event"}
        result = fsm.trigger(event, declencheur="frontend", **kwargs)
        return result
    except Exception as e:
        raise HTTPException(400, str(e))
