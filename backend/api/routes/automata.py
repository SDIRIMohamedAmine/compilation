# -*- coding: utf-8 -*-
"""
api/routes/automata.py
Expose FSM operations via REST.
"""
import sys, os
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from fastapi import APIRouter, HTTPException
from automata.fsm_capteur      import CapteurFSM
from automata.fsm_intervention import InterventionFSM
from automata.fsm_vehicule     import VehiculeFSM
from automata.fsm_engine       import FSMError
from automata.sweeper          import sweep_all

router = APIRouter()

FSM_MAP = {
    "capteur":      (CapteurFSM,      "capteur_id"),
    "intervention": (InterventionFSM, "intervention_id"),
    "vehicule":     (VehiculeFSM,     "vehicule_id"),
}


@router.get("/{entity_type}/{entity_id}/status")
def fsm_status(entity_type: str, entity_id: int):
    if entity_type not in FSM_MAP:
        raise HTTPException(400, f"entity_type must be one of {list(FSM_MAP)}")
    FSMClass, _ = FSM_MAP[entity_type]
    try:
        fsm = FSMClass(entity_id)
        return fsm.status()
    except FSMError as e:
        raise HTTPException(404, str(e))


@router.post("/{entity_type}/{entity_id}/trigger")
def fsm_trigger(entity_type: str, entity_id: int, body: dict):
    if entity_type not in FSM_MAP:
        raise HTTPException(400, f"entity_type must be one of {list(FSM_MAP)}")
    event = body.get("event")
    if not event:
        raise HTTPException(400, "event field required")
    declencheur = body.get("declencheur", "api")
    kwargs = {k: v for k, v in body.items() if k not in ("event", "declencheur")}

    FSMClass, _ = FSM_MAP[entity_type]
    try:
        fsm = FSMClass(entity_id)
        result = fsm.trigger(event, declencheur=declencheur, **kwargs)
        return result
    except FSMError as e:
        raise HTTPException(400, str(e))


@router.post("/{entity_type}/{entity_id}/verify")
def fsm_verify(entity_type: str, entity_id: int, body: dict):
    """Dry-run a sequence of events without touching DB."""
    events = body.get("events", [])
    if not events:
        raise HTTPException(400, "events list required")
    FSMClass, _ = FSM_MAP[entity_type]
    try:
        fsm = FSMClass(entity_id)
        return fsm.verify_sequence(events)
    except FSMError as e:
        raise HTTPException(404, str(e))


@router.post("/sweep")
def run_sweep():
    """Manually trigger the background sweeper."""
    return sweep_all()
