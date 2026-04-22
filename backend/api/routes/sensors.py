# -*- coding: utf-8 -*-
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from database.db_utils import fetch_all, fetch_one, execute

router = APIRouter()


# IMPORTANT: /stats/summary MUST be declared before /{capteur_id}
# otherwise FastAPI treats "stats" as an integer and returns 422
@router.get("/stats/summary")
def sensors_summary():
    row = fetch_one("""
        SELECT
            COUNT(*) FILTER (WHERE statut = 'actif')           AS actifs,
            COUNT(*) FILTER (WHERE statut = 'signale')         AS signales,
            COUNT(*) FILTER (WHERE statut = 'en_maintenance')  AS en_maintenance,
            COUNT(*) FILTER (WHERE statut = 'hors_service')    AS hors_service,
            COUNT(*) FILTER (WHERE statut = 'inactif')         AS inactifs,
            COUNT(*)                                            AS total,
            ROUND(AVG(taux_erreur)::numeric, 4)                AS taux_erreur_moyen
        FROM capteurs
    """)
    return dict(row)


@router.get("/")
def get_sensors(
    statut: Optional[str] = None,
    type_capteur: Optional[str] = None,
    zone_id: Optional[int] = None,
):
    where = ["1=1"]
    params = []
    if statut:
        where.append("c.statut = %s"); params.append(statut)
    if type_capteur:
        where.append("c.type_capteur = %s"); params.append(type_capteur)
    if zone_id:
        where.append("c.zone_id = %s"); params.append(zone_id)

    rows = fetch_all(f"""
        SELECT c.*, z.nom as zone_nom
        FROM capteurs c
        JOIN zones z ON z.zone_id = c.zone_id
        WHERE {' AND '.join(where)}
        ORDER BY c.capteur_id
    """, params or None)
    return [dict(r) for r in rows]


@router.get("/{capteur_id}")
def get_sensor(capteur_id: int):
    row = fetch_one("""
        SELECT c.*, z.nom as zone_nom
        FROM capteurs c JOIN zones z ON z.zone_id = c.zone_id
        WHERE c.capteur_id = %s
    """, (capteur_id,))
    if not row:
        raise HTTPException(404, "Capteur not found")
    return dict(row)


@router.get("/{capteur_id}/mesures")
def get_sensor_mesures(
    capteur_id: int,
    limit: int = Query(100, le=1000),
    type_mesure: Optional[str] = None,
):
    params = [capteur_id]
    extra = ""
    if type_mesure:
        extra = "AND type_mesure = %s"
        params.append(type_mesure)
    rows = fetch_all(f"""
        SELECT * FROM mesures
        WHERE capteur_id = %s {extra}
        ORDER BY timestamp DESC
        LIMIT %s
    """, params + [limit])
    return [dict(r) for r in rows]


@router.patch("/{capteur_id}/statut")
def update_statut(capteur_id: int, body: dict):
    valid = ("inactif","actif","signale","en_maintenance","hors_service")
    statut = body.get("statut")
    if statut not in valid:
        raise HTTPException(400, f"statut must be one of {valid}")
    execute(
        "UPDATE capteurs SET statut = %s WHERE capteur_id = %s",
        (statut, capteur_id)
    )
    return {"capteur_id": capteur_id, "statut": statut}
