# -*- coding: utf-8 -*-
"""
automata/fsm_vehicule.py
Autonomous vehicle lifecycle FSM.

States:
  STATIONNE -> EN_ROUTE -> ARRIVE
                        -> EN_PANNE -> EN_ROUTE (after repair)

Transitions table:
  (stationne, depart)    -> en_route
  (en_route,  arrivee)   -> arrive
  (en_route,  panne)     -> en_panne
  (en_panne,  reparation)-> en_route
  (arrive,    depart)    -> en_route   (new trip)
"""
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "database"))

from datetime import datetime, timezone
from db_utils import execute, fetch_one
from fsm_engine import BaseFSM


# ── callbacks ─────────────────────────────────────────────────────────────────

def _on_depart(vehicule_id: int, **kwargs):
    zone_id = kwargs.get("zone_depart_id")
    if zone_id:
        execute(
            "UPDATE vehicules SET zone_actuelle_id=%s WHERE vehicule_id=%s",
            (zone_id, vehicule_id)
        )
    # open a new trajet
    zone_arr = kwargs.get("zone_arrivee_id")
    if zone_id and zone_arr:
        execute("""
            INSERT INTO trajets (vehicule_id, zone_depart_id, zone_arrivee_id, timestamp_depart)
            VALUES (%s, %s, %s, %s)
        """, (vehicule_id, zone_id, zone_arr, datetime.now(timezone.utc)))


def _on_arrivee(vehicule_id: int, **kwargs):
    zone_id = kwargs.get("zone_arrivee_id")
    if zone_id:
        execute(
            "UPDATE vehicules SET zone_actuelle_id=%s WHERE vehicule_id=%s",
            (zone_id, vehicule_id)
        )
    # close the open trajet
    execute("""
        UPDATE trajets
        SET timestamp_arrivee = NOW(),
            statut = 'termine',
            economie_co2 = COALESCE(distance_km, 5.0) * 0.12
        WHERE vehicule_id = %s AND statut = 'en_cours'
    """, (vehicule_id,))


def _on_panne(vehicule_id: int, **kwargs):
    execute("""
        UPDATE trajets SET statut = 'annule'
        WHERE vehicule_id = %s AND statut = 'en_cours'
    """, (vehicule_id,))


# ── FSM class ─────────────────────────────────────────────────────────────────

class VehiculeFSM(BaseFSM):
    TABLE       = "vehicules"
    ID_FIELD    = "vehicule_id"
    STATE_FIELD = "statut"

    TRANSITIONS = {
        ("stationne", "depart"):     "en_route",
        ("en_route",  "arrivee"):    "arrive",
        ("en_route",  "panne"):      "en_panne",
        ("en_panne",  "reparation"): "en_route",
        ("arrive",    "depart"):     "en_route",
    }

    CALLBACKS = {
        ("stationne", "depart"):     _on_depart,
        ("arrive",    "depart"):     _on_depart,
        ("en_route",  "arrivee"):    _on_arrivee,
        ("en_route",  "panne"):      _on_panne,
    }
