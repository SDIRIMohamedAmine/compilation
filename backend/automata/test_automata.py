# -*- coding: utf-8 -*-
"""
automata/test_automata.py
10 test scenarios covering all 3 FSMs.
Usage: python test_automata.py
Requires: seeded DB + running PostgreSQL
"""
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "database"))

from db_utils import fetch_one, execute
from fsm_capteur import CapteurFSM
from fsm_intervention import InterventionFSM
from fsm_vehicule import VehiculeFSM
from fsm_engine import FSMError

PASS = "[PASS]"
FAIL = "[FAIL]"


def get_capteur_actif():
    row = fetch_one("SELECT capteur_id FROM capteurs WHERE statut='actif' LIMIT 1")
    return row["capteur_id"] if row else None

def get_capteur_inactif():
    row = fetch_one("SELECT capteur_id FROM capteurs WHERE statut='inactif' LIMIT 1")
    return row["capteur_id"] if row else None

def get_intervention_demande():
    row = fetch_one("SELECT intervention_id FROM interventions WHERE statut='demande' LIMIT 1")
    return row["intervention_id"] if row else None

def get_technicien():
    row = fetch_one("SELECT technicien_id FROM techniciens WHERE disponible=TRUE LIMIT 1")
    return row["technicien_id"] if row else None

def get_vehicule_stationne():
    row = fetch_one("SELECT vehicule_id FROM vehicules WHERE statut='stationne' LIMIT 1")
    return row["vehicule_id"] if row else None

def get_zone():
    row = fetch_one("SELECT zone_id FROM zones LIMIT 1")
    return row["zone_id"] if row else 1

results = []

def test(name, fn):
    try:
        fn()
        print(f"  {PASS} {name}")
        results.append((name, True, None))
    except Exception as e:
        print(f"  {FAIL} {name}: {e}")
        results.append((name, False, str(e)))


# ─────────────────────────────────────────────────────────────────────────────
# CAPTEUR FSM
# ─────────────────────────────────────────────────────────────────────────────

print("\n[CAPTEUR FSM]")

def t1_valid_events():
    cid = get_capteur_actif()
    assert cid, "No active sensor found"
    fsm = CapteurFSM(cid)
    evts = fsm.valid_events()
    assert "detection_anomalie" in evts or "panne" in evts, f"Expected events, got {evts}"
test("valid_events() returns correct events for actif", t1_valid_events)

def t2_detection_anomalie():
    cid = get_capteur_actif()
    assert cid
    fsm = CapteurFSM(cid)
    res = fsm.trigger("detection_anomalie")
    assert res["etat_apres"] == "signale"
    # verify DB updated
    row = fetch_one("SELECT statut FROM capteurs WHERE capteur_id=%s", (cid,))
    assert row["statut"] == "signale"
    # restore
    execute("UPDATE capteurs SET statut='actif' WHERE capteur_id=%s", (cid,))
test("actif --[detection_anomalie]--> signale + DB updated", t2_detection_anomalie)

def t3_callback_creates_intervention():
    cid = get_capteur_actif()
    assert cid
    # clear any existing open intervention
    execute("DELETE FROM interventions WHERE capteur_id=%s AND statut='demande'", (cid,))
    fsm = CapteurFSM(cid)
    fsm.trigger("detection_anomalie")
    row = fetch_one(
        "SELECT intervention_id FROM interventions WHERE capteur_id=%s AND statut='demande'",
        (cid,)
    )
    assert row, "Callback should have created an intervention"
    execute("UPDATE capteurs SET statut='actif' WHERE capteur_id=%s", (cid,))
test("callback: detection_anomalie auto-creates intervention", t3_callback_creates_intervention)

def t4_invalid_transition_blocked():
    cid = get_capteur_actif()
    assert cid
    fsm = CapteurFSM(cid)
    try:
        fsm.trigger("reparation")   # invalid from 'actif'
        assert False, "Should have raised FSMError"
    except FSMError:
        pass  # expected
test("invalid transition raises FSMError (actif --[reparation]-->  blocked)", t4_invalid_transition_blocked)

def t5_verify_sequence():
    cid = get_capteur_actif()
    assert cid
    fsm = CapteurFSM(cid)
    # valid sequence from current state
    res = fsm.verify_sequence(["detection_anomalie", "signalement", "reparation"])
    assert res["valid"], f"Expected valid sequence: {res}"
    # invalid sequence
    bad = fsm.verify_sequence(["reparation"])
    assert not bad["valid"]
test("verify_sequence() dry-run valid + invalid", t5_verify_sequence)

def t6_full_lifecycle():
    """inactif -> actif -> signale -> en_maintenance -> actif"""
    cid = get_capteur_inactif()
    if not cid:
        raise Exception("No inactive sensor - skip")
    fsm = CapteurFSM(cid)
    fsm.trigger("installation")
    assert fsm.state == "actif"
    fsm.trigger("detection_anomalie")
    assert fsm.state == "signale"
    fsm.trigger("signalement")
    assert fsm.state == "en_maintenance"
    fsm.trigger("reparation")
    assert fsm.state == "actif"
test("full lifecycle: inactif->actif->signale->maintenance->actif", t6_full_lifecycle)

# ─────────────────────────────────────────────────────────────────────────────
# INTERVENTION FSM
# ─────────────────────────────────────────────────────────────────────────────

print("\n[INTERVENTION FSM]")

def t7_full_workflow():
    """demande -> tech1 -> tech2 -> ia -> termine"""
    iid = get_intervention_demande()
    assert iid, "No open intervention"
    tid = get_technicien()
    assert tid

    fsm = InterventionFSM(iid)
    fsm.trigger("assignation_tech1", technicien_id=tid)
    assert fsm.state == "tech1_assigne"

    fsm.trigger("validation_tech2")
    assert fsm.state == "tech2_valide"

    fsm.trigger("validation_ia")
    assert fsm.state == "ia_valide"

    row = fetch_one("SELECT validation_ia FROM interventions WHERE intervention_id=%s", (iid,))
    assert row["validation_ia"] == True

    fsm.trigger("cloture")
    assert fsm.state == "termine"

    row = fetch_one("SELECT date_terminaison FROM interventions WHERE intervention_id=%s", (iid,))
    assert row["date_terminaison"] is not None
test("full workflow: demande->tech1->tech2->ia->termine", t7_full_workflow)

def t8_skip_step_blocked():
    """Can't jump from demande directly to tech2_valide"""
    # create a fresh intervention
    row = fetch_one("SELECT capteur_id FROM capteurs WHERE statut='actif' LIMIT 1")
    assert row
    execute("""
        INSERT INTO interventions (capteur_id, description, priorite)
        VALUES (%s, 'test skip step', 'normale')
    """, (row["capteur_id"],))
    iid = fetch_one(
        "SELECT intervention_id FROM interventions WHERE description='test skip step' LIMIT 1"
    )["intervention_id"]

    fsm = InterventionFSM(iid)
    try:
        fsm.trigger("validation_tech2")  # skip tech1_assigne
        assert False, "Should raise FSMError"
    except FSMError:
        pass
    # cleanup
    execute("DELETE FROM interventions WHERE intervention_id=%s", (iid,))
test("skipping step blocked: demande --[validation_tech2]--> FSMError", t8_skip_step_blocked)

# ─────────────────────────────────────────────────────────────────────────────
# VEHICULE FSM
# ─────────────────────────────────────────────────────────────────────────────

print("\n[VEHICULE FSM]")

def t9_normal_trip():
    vid = get_vehicule_stationne()
    assert vid
    z1 = get_zone()
    z2 = fetch_one("SELECT zone_id FROM zones WHERE zone_id != %s LIMIT 1", (z1,))["zone_id"]

    fsm = VehiculeFSM(vid)
    fsm.trigger("depart", zone_depart_id=z1, zone_arrivee_id=z2)
    assert fsm.state == "en_route"
    fsm.trigger("arrivee", zone_arrivee_id=z2)
    assert fsm.state == "arrive"
    # restore
    execute("UPDATE vehicules SET statut='stationne' WHERE vehicule_id=%s", (vid,))
test("normal trip: stationne->en_route->arrive", t9_normal_trip)

def t10_breakdown_recovery():
    vid = get_vehicule_stationne()
    assert vid
    z1 = get_zone()
    z2 = fetch_one("SELECT zone_id FROM zones WHERE zone_id != %s LIMIT 1", (z1,))["zone_id"]

    fsm = VehiculeFSM(vid)
    fsm.trigger("depart", zone_depart_id=z1, zone_arrivee_id=z2)
    fsm.trigger("panne")
    assert fsm.state == "en_panne"
    fsm.trigger("reparation")
    assert fsm.state == "en_route"
    fsm.trigger("arrivee", zone_arrivee_id=z2)
    assert fsm.state == "arrive"
    execute("UPDATE vehicules SET statut='stationne' WHERE vehicule_id=%s", (vid,))
test("breakdown + recovery: stationne->route->panne->route->arrive", t10_breakdown_recovery)

# ─────────────────────────────────────────────────────────────────────────────
# AUDIT LOG
# ─────────────────────────────────────────────────────────────────────────────

print("\n[AUDIT LOG]")

def t11_audit_log_written():
    cid = get_capteur_actif()
    assert cid
    from datetime import datetime, timezone
    before = datetime.now(timezone.utc)
    fsm = CapteurFSM(cid)
    fsm.trigger("detection_anomalie", declencheur="test_suite")
    row = fetch_one("""
        SELECT * FROM fsm_transitions
        WHERE entity_id=%s AND declencheur='test_suite'
        ORDER BY timestamp DESC LIMIT 1
    """, (cid,))
    assert row, "No audit log row found"
    assert row["etat_avant"] == "actif"
    assert row["etat_apres"] == "signale"
    execute("UPDATE capteurs SET statut='actif' WHERE capteur_id=%s", (cid,))
test("audit log written with correct fields", t11_audit_log_written)

# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────────────

print("\n" + "="*50)
passed = sum(1 for _, ok, _ in results if ok)
print(f"RESULTS: {passed}/{len(results)} passed")
for name, ok, err in results:
    status = PASS if ok else FAIL
    print(f"  {status} {name}" + (f" -- {err}" if err else ""))
