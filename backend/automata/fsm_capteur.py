# -*- coding: utf-8 -*-
"""
automata/fsm_capteur.py
Sensor lifecycle FSM.

States:      INACTIF -> ACTIF -> SIGNALE -> EN_MAINTENANCE -> ACTIF (loop)
                                                           -> HORS_SERVICE
Transitions table:
  (INACTIF,        installation)        -> ACTIF
  (ACTIF,          detection_anomalie)  -> SIGNALE
  (ACTIF,          panne)               -> HORS_SERVICE
  (SIGNALE,        signalement)         -> EN_MAINTENANCE
  (SIGNALE,        panne)               -> HORS_SERVICE
  (EN_MAINTENANCE, reparation)          -> ACTIF
  (EN_MAINTENANCE, panne)               -> HORS_SERVICE
  (HORS_SERVICE,   remise_en_service)   -> ACTIF
"""
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "database"))

from db_utils import fetch_one, execute
from fsm_engine import BaseFSM


# ── callbacks ─────────────────────────────────────────────────────────────────

def _on_signale(capteur_id: int, **kwargs):
    """Auto-create an intervention request when sensor is flagged."""
    existing = fetch_one(
        "SELECT intervention_id FROM interventions WHERE capteur_id=%s AND statut != 'termine'",
        (capteur_id,)
    )
    if not existing:
        execute("""
            INSERT INTO interventions (capteur_id, description, priorite)
            VALUES (%s, 'Anomalie detectee automatiquement par le systeme FSM', 'haute')
        """, (capteur_id,))


def _on_hors_service(capteur_id: int, **kwargs):
    """Escalate any open intervention to urgent."""
    execute("""
        UPDATE interventions
        SET priorite = 'urgente'
        WHERE capteur_id = %s AND statut != 'termine'
    """, (capteur_id,))


def _on_remise_actif(capteur_id: int, **kwargs):
    """Reset error rate when back online."""
    execute(
        "UPDATE capteurs SET taux_erreur = 0.0 WHERE capteur_id = %s",
        (capteur_id,)
    )


# ── FSM class ─────────────────────────────────────────────────────────────────

class CapteurFSM(BaseFSM):
    TABLE       = "capteurs"
    ID_FIELD    = "capteur_id"
    STATE_FIELD = "statut"

    TRANSITIONS = {
        ("inactif",        "installation"):       "actif",
        ("actif",          "detection_anomalie"): "signale",
        ("actif",          "panne"):              "hors_service",
        ("signale",        "signalement"):        "en_maintenance",
        ("signale",        "panne"):              "hors_service",
        ("en_maintenance", "reparation"):         "actif",
        ("en_maintenance", "panne"):              "hors_service",
        ("hors_service",   "remise_en_service"):  "actif",
    }

    CALLBACKS = {
        ("actif",    "detection_anomalie"): _on_signale,
        ("signale",  "panne"):              _on_hors_service,
        ("actif",    "panne"):              _on_hors_service,
        ("en_maintenance", "reparation"):   _on_remise_actif,
        ("hors_service", "remise_en_service"): _on_remise_actif,
    }
