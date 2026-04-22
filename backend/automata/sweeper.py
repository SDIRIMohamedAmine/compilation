# -*- coding: utf-8 -*-
"""
automata/sweeper.py
Background job: scans DB for time-based conditions and fires FSM events.

Run manually or schedule with cron / APScheduler:
    python sweeper.py

Or call sweep_all() from FastAPI startup.
"""
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "database"))

from db_utils import fetch_all, execute
from datetime import datetime, timezone


def sweep_hors_service_24h():
    """
    Alert: sensors stuck in hors_service > 24h with no open intervention.
    Creates a new urgent intervention automatically.
    """
    rows = fetch_all("""
        SELECT c.capteur_id, c.statut, z.nom AS zone_nom,
               EXTRACT(EPOCH FROM (NOW() - t.timestamp)) / 3600 AS heures_hors_service
        FROM capteurs c
        JOIN zones z ON z.zone_id = c.zone_id
        LEFT JOIN (
            SELECT entity_id, MAX(timestamp) AS timestamp
            FROM fsm_transitions
            WHERE entity_type = 'capteur' AND etat_apres = 'hors_service'
            GROUP BY entity_id
        ) t ON t.entity_id = c.capteur_id
        WHERE c.statut = 'hors_service'
          AND (t.timestamp IS NULL OR NOW() - t.timestamp > INTERVAL '24 hours')
          AND NOT EXISTS (
              SELECT 1 FROM interventions i
              WHERE i.capteur_id = c.capteur_id AND i.statut != 'termine'
          )
    """)

    created = []
    for row in rows:
        execute("""
            INSERT INTO interventions (capteur_id, description, priorite)
            VALUES (%s, %s, 'urgente')
        """, (
            row["capteur_id"],
            f"ALERTE AUTO: capteur hors service depuis {row['heures_hors_service']:.1f}h "
            f"zone {row['zone_nom']}"
        ))
        created.append(row["capteur_id"])

    if created:
        print(f"[SWEEP] hors_service>24h: created {len(created)} interventions for capteurs {created}")
    return created


def sweep_interventions_stale():
    """
    Alert: interventions stuck at demande > 48h without tech assigned.
    Escalates to urgent priority.
    """
    rows = fetch_all("""
        SELECT intervention_id
        FROM interventions
        WHERE statut = 'demande'
          AND date_demande < NOW() - INTERVAL '48 hours'
          AND priorite != 'urgente'
    """)
    ids = [r["intervention_id"] for r in rows]
    if ids:
        execute("""
            UPDATE interventions SET priorite = 'urgente'
            WHERE intervention_id = ANY(%s)
        """, (ids,))
        print(f"[SWEEP] stale interventions escalated: {ids}")
    return ids


def sweep_all():
    results = {
        "hors_service_alerts": sweep_hors_service_24h(),
        "stale_interventions": sweep_interventions_stale(),
    }
    print(f"[SWEEP] done: {results}")
    return results


if __name__ == "__main__":
    sweep_all()
