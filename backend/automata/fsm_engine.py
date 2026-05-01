# -*- coding: utf-8 -*-
"""
automata/fsm_engine.py
Base FSM engine: loads state from DB, validates transition,
updates DB, writes audit log. All 3 machines inherit from this.
"""
import sys
import os

# Ensure database/ is on the path when running from automata/ directly
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from datetime import datetime, timezone
from database.db_utils import fetch_one, execute


class FSMError(Exception):
    pass


class BaseFSM:
    """
    Subclasses define:
        TABLE      : str  -- DB table name
        ID_FIELD   : str  -- primary key column
        STATE_FIELD: str  -- statut column
        TRANSITIONS: dict -- { (state, event): next_state }
        CALLBACKS  : dict -- { (state, event): callable(entity_id) }  optional
    """
    TABLE       = None
    ID_FIELD    = None
    STATE_FIELD = None
    TRANSITIONS = {}
    CALLBACKS   = {}

    def __init__(self, entity_id: int):
        self.entity_id = entity_id
        self.state     = self._load_state()

    # ── internal ──────────────────────────────────────────────────────────────

    def _load_state(self) -> str:
        row = fetch_one(
            f"SELECT {self.STATE_FIELD} FROM {self.TABLE} WHERE {self.ID_FIELD} = %s",
            (self.entity_id,)
        )
        if not row:
            raise FSMError(f"{self.TABLE} id={self.entity_id} not found")
        return row[self.STATE_FIELD]

    def _save_state(self, new_state: str):
        execute(
            f"UPDATE {self.TABLE} SET {self.STATE_FIELD} = %s WHERE {self.ID_FIELD} = %s",
            (new_state, self.entity_id)
        )

    def _log_transition(self, event: str, old_state: str, new_state: str, declencheur: str = "system"):
        # capteurs -> capteur, interventions -> intervention, vehicules -> vehicule
        entity_type = self.TABLE.rstrip("s")
        execute("""
            INSERT INTO fsm_transitions
                (entity_type, entity_id, etat_avant, etat_apres, evenement, timestamp, declencheur)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (entity_type, self.entity_id, old_state, new_state, event,
              datetime.now(timezone.utc), declencheur))

    # ── public API ────────────────────────────────────────────────────────────

    def can_trigger(self, event: str) -> bool:
        return (self.state, event) in self.TRANSITIONS

    def valid_events(self) -> list:
        return [e for (s, e) in self.TRANSITIONS if s == self.state]

    def trigger(self, event: str, declencheur: str = "system", **kwargs) -> dict:
        key = (self.state, event)
        if key not in self.TRANSITIONS:
            valid = self.valid_events()
            raise FSMError(
                f"Invalid transition: {self.state} --[{event}]--> ? "
                f"| Valid events from '{self.state}': {valid}"
            )
        old_state = self.state
        new_state = self.TRANSITIONS[key]

        self._save_state(new_state)       # 1. persist to DB
        self.state = new_state            # 2. update in-memory
        self._log_transition(event, old_state, new_state, declencheur)  # 3. audit log
        cb = self.CALLBACKS.get(key)
        if cb:
            cb(self.entity_id, **kwargs)  # 4. callbacks

        return {
            "entity_id":   self.entity_id,
            "event":       event,
            "etat_avant":  old_state,
            "etat_apres":  new_state,
            "declencheur": declencheur,
        }

    def status(self) -> dict:
        return {
            "entity_id":    self.entity_id,
            "state":        self.state,
            "valid_events": self.valid_events(),
        }

    def verify_sequence(self, events: list) -> dict:
        """Dry-run a sequence of events without touching the DB."""
        state = self.state
        trace = [state]
        for ev in events:
            key = (state, ev)
            if key not in self.TRANSITIONS:
                return {
                    "valid":            False,
                    "failed_at":        ev,
                    "state_at_failure": state,
                    "trace":            trace,
                }
            state = self.TRANSITIONS[key]
            trace.append(state)
        return {"valid": True, "final_state": state, "trace": trace}
