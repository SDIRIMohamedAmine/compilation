# -*- coding: utf-8 -*-
from fastapi import APIRouter, HTTPException
from database.db_utils import fetch_all, fetch_one  # Updated absolute import!

router = APIRouter()

# 1. Put this BEFORE any /{zone_id} endpoints
@router.get("/ranking/pollution")
def pollution_ranking():
    rows = fetch_all("""
        SELECT z.nom, z.zone_id,
            ROUND(AVG(m.valeur)::numeric, 2) AS moy_pm25
        FROM mesures m
        JOIN capteurs c ON c.capteur_id = m.capteur_id
        JOIN zones z    ON z.zone_id    = c.zone_id
        WHERE m.type_mesure = 'pm25'
          AND m.timestamp > NOW() - INTERVAL '24 hours'
        GROUP BY z.zone_id, z.nom
        ORDER BY moy_pm25 DESC
    """)
    return [dict(r) for r in rows]

# 2. General endpoints
@router.get("/")
def get_zones():
    rows = fetch_all("""
        SELECT z.*,
            COUNT(c.capteur_id)                                     AS nb_capteurs,
            COUNT(c.capteur_id) FILTER (WHERE c.statut = 'actif')  AS capteurs_actifs
        FROM zones z
        LEFT JOIN capteurs c ON c.zone_id = z.zone_id
        GROUP BY z.zone_id
        ORDER BY z.zone_id
    """)
    return [dict(r) for r in rows]

# 3. Dynamic /id endpoints go last!
@router.get("/{zone_id}")
def get_zone(zone_id: int):
    row = fetch_one("SELECT * FROM zones WHERE zone_id = %s", (zone_id,))
    if not row:
        raise HTTPException(404, "Zone not found")
    return dict(row)

@router.get("/{zone_id}/pollution")
def get_zone_pollution(zone_id: int):
    rows = fetch_all("""
        SELECT
            m.type_mesure,
            ROUND(AVG(m.valeur)::numeric, 2)  AS moyenne,
            ROUND(MAX(m.valeur)::numeric, 2)  AS maximum,
            COUNT(*) FILTER (WHERE m.est_anomalie) AS nb_anomalies
        FROM mesures m
        JOIN capteurs c ON c.capteur_id = m.capteur_id
        WHERE c.zone_id = %s
          AND m.timestamp > NOW() - INTERVAL '24 hours'
        GROUP BY m.type_mesure
    """, (zone_id,))
    return [dict(r) for r in rows]