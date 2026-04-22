# -*- coding: utf-8 -*-
from fastapi import APIRouter
import sys, os
_HERE = os.path.dirname(os.path.abspath(__file__))          # backend/ai/
_DB   = os.path.join(_HERE, "../..", "database")               # backend/database/
if os.path.isdir(_DB) and os.path.abspath(_DB) not in [os.path.abspath(p) for p in sys.path]:
    sys.path.insert(0, os.path.abspath(_DB))

from database.db_utils import fetch_all, fetch_one, execute

router = APIRouter()


@router.get("/stats")
def global_stats():
    sensors  = fetch_one("""
        SELECT
            COUNT(*) FILTER (WHERE statut='actif')          AS actifs,
            COUNT(*) FILTER (WHERE statut='signale')        AS signales,
            COUNT(*) FILTER (WHERE statut='hors_service')   AS hors_service,
            COUNT(*)                                        AS total
        FROM capteurs
    """)
    anomalies = fetch_one("""
        SELECT COUNT(*) AS n FROM mesures
        WHERE est_anomalie = TRUE
          AND timestamp > NOW() - INTERVAL '24 hours'
    """)
    interventions = fetch_one("""
        SELECT
            COUNT(*) FILTER (WHERE statut != 'termine') AS en_cours,
            COUNT(*) FILTER (WHERE statut = 'termine')  AS terminees
        FROM interventions
    """)
    iqa = fetch_one("""
        SELECT ROUND(AVG(valeur)::numeric, 1) AS iqa_moyen
        FROM mesures
        WHERE type_mesure = 'pm25'
          AND timestamp > NOW() - INTERVAL '24 hours'
    """)
    return {
        "capteurs":      dict(sensors),
        "anomalies_24h": anomalies["n"],
        "interventions": dict(interventions),
        "iqa_moyen":     iqa["iqa_moyen"],
    }


@router.get("/timeseries")
def timeseries(type_mesure: str = "pm25", hours: int = 24):
    rows = fetch_all("""
        SELECT
            DATE_TRUNC('hour', m.timestamp) AS heure,
            z.nom                           AS zone,
            ROUND(AVG(m.valeur)::numeric,2) AS valeur
        FROM mesures m
        JOIN capteurs c ON c.capteur_id = m.capteur_id
        JOIN zones z    ON z.zone_id    = c.zone_id
        WHERE m.type_mesure = %s
          AND m.timestamp > NOW() - make_interval(hours => %s)
        GROUP BY heure, z.nom
        ORDER BY heure ASC
    """, (type_mesure, hours))
    return [dict(r) for r in rows]


@router.get("/anomalies/recent")
def recent_anomalies(limit: int = 20):
    rows = fetch_all("""
        SELECT m.mesure_id, m.timestamp, m.type_mesure, m.valeur, m.unite,
               c.capteur_id, z.nom AS zone_nom
        FROM mesures m
        JOIN capteurs c ON c.capteur_id = m.capteur_id
        JOIN zones z    ON z.zone_id    = c.zone_id
        WHERE m.est_anomalie = TRUE
        ORDER BY m.timestamp DESC
        LIMIT %s
    """, (limit,))
    return [dict(r) for r in rows]


@router.get("/citoyens/top")
def top_citoyens(limit: int = 10):
    rows = fetch_all("""
        SELECT c.nom, c.prenom, c.score_ecologique, z.nom AS zone
        FROM citoyens c
        JOIN zones z ON z.zone_id = c.zone_id
        ORDER BY c.score_ecologique DESC
        LIMIT %s
    """, (limit,))
    return [dict(r) for r in rows]