# -*- coding: utf-8 -*-
"""
automata/fsm_intervention.py
Intervention workflow FSM (2 technicians + AI validation).

States:
  DEMANDE -> TECH1_ASSIGNE -> TECH2_VALIDE -> IA_VALIDE -> TERMINE

Transitions table:
  (demande,        assignation_tech1) -> tech1_assigne
  (tech1_assigne,  validation_tech2)  -> tech2_valide
  (tech2_valide,   validation_ia)     -> ia_valide
  (ia_valide,      cloture)           -> termine
  -- cancellation allowed from any non-terminal state:
  (demande,        annulation)        -> annule   [if you add annule state]
"""
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "database"))

from db_utils import execute, fetch_one
from fsm_engine import BaseFSM


# ── callbacks ─────────────────────────────────────────────────────────────────

def _on_tech1_assigne(intervention_id: int, **kwargs):
    tech_id = kwargs.get("technicien_id")
    if tech_id:
        execute(
            "UPDATE interventions SET technicien1_id=%s WHERE intervention_id=%s",
            (tech_id, intervention_id)
        )
        execute(
            "UPDATE techniciens SET disponible=FALSE WHERE technicien_id=%s",
            (tech_id,)
        )


def _on_tech2_valide(intervention_id: int, **kwargs):
    tech_id = kwargs.get("technicien_id")
    if tech_id:
        execute(
            "UPDATE interventions SET technicien2_id=%s WHERE intervention_id=%s",
            (tech_id, intervention_id)
        )


def _on_ia_valide(intervention_id: int, **kwargs):
    execute(
        "UPDATE interventions SET validation_ia=TRUE WHERE intervention_id=%s",
        (intervention_id,)
    )


def _on_termine(intervention_id: int, **kwargs):
    """Close intervention + restore sensor to active + free technicians."""
    execute(
        "UPDATE interventions SET date_terminaison=NOW() WHERE intervention_id=%s",
        (intervention_id,)
    )
    # restore capteur
    row = fetch_one(
        "SELECT capteur_id, technicien1_id FROM interventions WHERE intervention_id=%s",
        (intervention_id,)
    )
    if row:
        execute(
            "UPDATE capteurs SET statut='actif', taux_erreur=0.0 WHERE capteur_id=%s",
            (row["capteur_id"],)
        )
        if row["technicien1_id"]:
            execute(
                "UPDATE techniciens SET disponible=TRUE WHERE technicien_id=%s",
                (row["technicien1_id"],)
            )


# ── FSM class ─────────────────────────────────────────────────────────────────

class InterventionFSM(BaseFSM):
    TABLE       = "interventions"
    ID_FIELD    = "intervention_id"
    STATE_FIELD = "statut"

    TRANSITIONS = {
        ("demande",        "assignation_tech1"): "tech1_assigne",
        ("tech1_assigne",  "validation_tech2"):  "tech2_valide",
        ("tech2_valide",   "validation_ia"):     "ia_valide",
        ("ia_valide",      "cloture"):           "termine",
    }

    CALLBACKS = {
        ("demande",       "assignation_tech1"): _on_tech1_assigne,
        ("tech1_assigne", "validation_tech2"):  _on_tech2_valide,
        ("tech2_valide",  "validation_ia"):     _on_ia_valide,
        ("ia_valide",     "cloture"):           _on_termine,
    }
