# -*- coding: utf-8 -*-
"""
generate_data.py — Seed 1000+ realistic rows
Usage: python generate_data.py
"""
import random
import psycopg2
import psycopg2.extras
from datetime import datetime, timedelta, timezone
from faker import Faker
from database.config import DB_CONFIG, SEUILS

fake = Faker("fr_FR")
random.seed(42)

# ── helpers ──────────────────────────────────────────────────────────────────

def coin(p=0.5): return random.random() < p

def rand_val(type_mesure, anomalie=False):
    s = SEUILS[type_mesure]
    if anomalie:
        lo, hi = s["danger"]
    elif coin(0.2):
        lo, hi = s["warning"]
    else:
        lo, hi = s["normal"]
    return round(random.uniform(lo, hi), 2)

def now_utc(): return datetime.now(timezone.utc)

def days_ago(n): return now_utc() - timedelta(days=n)

# ── seed data ─────────────────────────────────────────────────────────────────

ZONES_DATA = [
    ("Zone Centre",          "Centre historique et commercial",  12.4, 85000),
    ("Zone Port",            "Zone portuaire et industrielle legere", 8.7, 32000),
    ("Zone Industrielle",    "Complexe industriel zone nord",    22.1, 5000),
    ("Zone Sahloul",         "Quartier residentiel moderne",     15.3, 61000),
    ("Zone Medina",          "Medina et vieux quartiers",        6.2,  28000),
    ("Zone Hammam Sousse",   "Littoral et tourisme",             19.8, 42000),
]

SENSOR_TYPE_BY_ZONE = {
    "Zone Centre":        ["air","air","bruit","trafic","air"],
    "Zone Port":          ["air","air","bruit","trafic","air","no2"],
    "Zone Industrielle":  ["air","air","air","bruit","trafic","no2","o3"],
    "Zone Sahloul":       ["air","bruit","trafic"],
    "Zone Medina":        ["air","bruit","bruit","trafic"],
    "Zone Hammam Sousse": ["air","bruit","trafic"],
}

COORDS = {
    "Zone Centre":       (35.8256, 10.6369),
    "Zone Port":         (35.8350, 10.6120),
    "Zone Industrielle": (35.8580, 10.5900),
    "Zone Sahloul":      (35.8100, 10.6250),
    "Zone Medina":       (35.8280, 10.6340),
    "Zone Hammam Sousse":(35.8570, 10.5980),
}

TECHNICIENS_DATA = [
    ("Ben Ali",    "Ahmed",  "air",     True),
    ("Mansouri",   "Sara",   "bruit",   True),
    ("Karray",     "Karim",  "trafic",  True),
    ("Hamdi",      "Nadia",  "general", False),
    ("Trabelsi",   "Youssef","air",     True),
    ("Boughzala",  "Amira",  "bruit",   False),
    ("Chaabane",   "Tarek",  "trafic",  True),
    ("Jebali",     "Fatma",  "general", True),
    ("Ouerghi",    "Zied",   "air",     True),
    ("Sayhi",      "Ines",   "bruit",   True),
]

SENSOR_MEASURE_MAP = {
    "air":    ["pm25","pm10","co2"],
    "bruit":  ["bruit"],
    "trafic": ["debit_trafic"],
    "no2":    ["no2","o3"],
    "o3":     ["o3"],
}

# ─────────────────────────────────────────────────────────────────────────────

def seed_all():
    conn = psycopg2.connect(DB_CONFIG["dsn"])
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # ── zones ──
    zone_ids = {}
    for nom, desc, sup, pop in ZONES_DATA:
        cur.execute("""
            INSERT INTO zones (nom, description, superficie, population)
            VALUES (%s,%s,%s,%s)
            ON CONFLICT (nom) DO UPDATE SET description=EXCLUDED.description
            RETURNING zone_id
        """, (nom, desc, sup, pop))
        zone_ids[nom] = cur.fetchone()["zone_id"]
    print(f"[OK] zones: {len(zone_ids)}")

    # ── techniciens ──
    tech_ids = []
    for nom, prenom, spec, dispo in TECHNICIENS_DATA:
        email = f"{prenom.lower()}.{nom.lower()}@neo-sousse.tn"
        cur.execute("""
            INSERT INTO techniciens (nom, prenom, specialite, disponible, email)
            VALUES (%s,%s,%s,%s,%s)
            ON CONFLICT (email) DO UPDATE SET disponible=EXCLUDED.disponible
            RETURNING technicien_id
        """, (nom, prenom, spec, dispo, email))
        tech_ids.append(cur.fetchone()["technicien_id"])
    print(f"[OK] techniciens: {len(tech_ids)}")

    # ── capteurs ──
    capteur_ids = []
    capteur_types = {}
    statuts = ["actif","actif","actif","actif","actif","signale","signale","en_maintenance","hors_service","inactif"]
    seuil_map = {"air":25.0,"bruit":55.0,"trafic":1500.0,"no2":40.0,"o3":60.0}
    c_count = 0

    for zone_nom, types in SENSOR_TYPE_BY_ZONE.items():
        lat, lon = COORDS[zone_nom]
        for typ in types:
            statut = random.choice(statuts)
            taux_err = round(random.uniform(0.0, 0.05) if statut == "actif" else random.uniform(0.05, 0.45), 3)
            install_date = fake.date_between(start_date="-3y", end_date="-1m")
            lat_j = lat + random.uniform(-0.01, 0.01)
            lon_j = lon + random.uniform(-0.01, 0.01)
            cur.execute("""
                INSERT INTO capteurs
                    (zone_id, type_capteur, statut, date_installation,
                     taux_erreur, nb_anomalies_totales, seuil_alerte,
                     modele, latitude, longitude)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING capteur_id
            """, (
                zone_ids[zone_nom], typ, statut, install_date,
                taux_err, random.randint(0, 120),
                seuil_map.get(typ, 50.0),
                f"NS-{typ.upper()}-{random.randint(100,999)}",
                lat_j, lon_j
            ))
            cid = cur.fetchone()["capteur_id"]
            capteur_ids.append(cid)
            capteur_types[cid] = typ
            c_count += 1

    print(f"[OK] capteurs: {c_count}")

    # ── citoyens ──
    citoyen_ids = []
    zone_list = list(zone_ids.values())
    for _ in range(200):
        cur.execute("""
            INSERT INTO citoyens (nom, prenom, email, zone_id, score_ecologique, date_inscription)
            VALUES (%s,%s,%s,%s,%s,%s)
            ON CONFLICT (email) DO NOTHING
            RETURNING citoyen_id
        """, (
            fake.last_name(), fake.first_name(),
            fake.unique.email(),
            random.choice(zone_list),
            random.randint(20, 100),
            fake.date_between(start_date="-2y", end_date="today")
        ))
        row = cur.fetchone()
        if row: citoyen_ids.append(row["citoyen_id"])
    print(f"[OK] citoyens: {len(citoyen_ids)}")

    # ── vehicules ──
    vehicule_ids = []
    types_v = ["voiture","bus","velo","trottinette","autonome"]
    weights  = [0.45, 0.15, 0.20, 0.10, 0.10]
    statuts_v = ["stationne","stationne","stationne","en_route","arrive"]
    for i in range(150):
        typ = random.choices(types_v, weights)[0]
        cit = random.choice(citoyen_ids) if coin(0.7) else None
        cur.execute("""
            INSERT INTO vehicules
                (citoyen_id, type_vehicule, statut, zone_actuelle_id, immatriculation, autonomie_km)
            VALUES (%s,%s,%s,%s,%s,%s)
            ON CONFLICT (immatriculation) DO NOTHING
            RETURNING vehicule_id
        """, (
            cit, typ, random.choice(statuts_v),
            random.choice(zone_list),
            f"TN-{random.randint(100,999)}-{random.randint(1000,9999)}",
            round(random.uniform(50, 400), 1) if typ in ("autonome","velo","trottinette") else None
        ))
        row = cur.fetchone()
        if row: vehicule_ids.append(row["vehicule_id"])
    print(f"[OK] vehicules: {len(vehicule_ids)}")

    # ── trajets ──
    trajet_batch = []
    for _ in range(300):
        vid = random.choice(vehicule_ids)
        zd  = random.choice(zone_list)
        za  = random.choice([z for z in zone_list if z != zd])
        dep = now_utc() - timedelta(days=random.randint(0, 30),
                                     hours=random.randint(0, 23),
                                     minutes=random.randint(0, 59))
        dist = round(random.uniform(0.5, 25.0), 2)
        arr  = dep + timedelta(minutes=int(dist * random.uniform(2, 6)))
        eco  = round(dist * random.uniform(0.08, 0.21), 3)
        trajet_batch.append((vid, zd, za, dep, arr, dist, eco, "termine"))

    psycopg2.extras.execute_batch(cur, """
        INSERT INTO trajets
            (vehicule_id, zone_depart_id, zone_arrivee_id,
             timestamp_depart, timestamp_arrivee, distance_km, economie_co2, statut)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
    """, trajet_batch, page_size=100)
    print(f"[OK] trajets: {len(trajet_batch)}")

    # ── mesures (bulk — 30 days time-series) ──
    active_capteurs = [(cid, capteur_types[cid]) for cid in capteur_ids]
    mesure_batch = []
    ANOMALY_PROB = 0.07  # 7% anomaly rate

    for cid, typ in active_capteurs:
        measure_types = SENSOR_MEASURE_MAP.get(typ, ["pm25"])
        # one reading every 30 min for 30 days = ~1440 per sensor
        intervals = range(0, 30 * 24 * 2)  # every 30min
        for i in intervals:
            ts = now_utc() - timedelta(minutes=i * 30)
            for mt in measure_types:
                is_anom = coin(ANOMALY_PROB)
                val  = rand_val(mt, anomalie=is_anom)
                unite = SEUILS[mt]["unite"]
                mesure_batch.append((cid, ts, mt, val, unite, is_anom))

        # flush every 5000 rows
        if len(mesure_batch) >= 5000:
            psycopg2.extras.execute_batch(cur, """
                INSERT INTO mesures (capteur_id, timestamp, type_mesure, valeur, unite, est_anomalie)
                VALUES (%s,%s,%s,%s,%s,%s)
            """, mesure_batch, page_size=500)
            mesure_batch = []

    if mesure_batch:
        psycopg2.extras.execute_batch(cur, """
            INSERT INTO mesures (capteur_id, timestamp, type_mesure, valeur, unite, est_anomalie)
            VALUES (%s,%s,%s,%s,%s,%s)
        """, mesure_batch, page_size=500)

    cur.execute("SELECT COUNT(*) AS n FROM mesures")
    print(f"[OK] mesures: {cur.fetchone()['n']}")

    # ── interventions ──
    signaled = [cid for cid in capteur_ids if coin(0.3)]
    statuts_i = ["demande","tech1_assigne","tech2_valide","ia_valide","termine"]
    weights_i  = [0.15, 0.20, 0.25, 0.20, 0.20]
    for cid in signaled[:40]:
        stat = random.choices(statuts_i, weights_i)[0]
        t1   = random.choice(tech_ids) if stat != "demande" else None
        t2   = random.choice([t for t in tech_ids if t != t1]) if stat in ("tech2_valide","ia_valide","termine") else None
        ia   = stat in ("ia_valide","termine")
        d_dem = now_utc() - timedelta(days=random.randint(0, 14))
        d_fin = d_dem + timedelta(days=random.randint(1, 7)) if stat == "termine" else None
        cur.execute("""
            INSERT INTO interventions
                (capteur_id, statut, technicien1_id, technicien2_id,
                 validation_ia, description, priorite, date_demande, date_terminaison)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            cid, stat, t1, t2, ia,
            fake.sentence(nb_words=8),
            random.choice(["normale","normale","haute","urgente","basse"]),
            d_dem, d_fin
        ))

    cur.execute("SELECT COUNT(*) AS n FROM interventions")
    print(f"[OK] interventions: {cur.fetchone()['n']}")

    # ── fsm_transitions audit log ──
    events_cap = ["installation","detection_anomalie","reparation","panne","mise_en_service"]
    events_int = ["assignation_tech1","validation_tech2","validation_ia","cloture"]
    fsm_batch  = []
    for cid in random.sample(capteur_ids, min(30, len(capteur_ids))):
        chain = ["inactif","actif","signale","en_maintenance","actif"]
        evts  = ["installation","detection_anomalie","signalement","reparation"]
        for j in range(len(evts)):
            fsm_batch.append((
                "capteur", cid, chain[j], chain[j+1], evts[j],
                now_utc() - timedelta(days=random.randint(1, 90)),
                f"system"
            ))

    psycopg2.extras.execute_batch(cur, """
        INSERT INTO fsm_transitions
            (entity_type, entity_id, etat_avant, etat_apres, evenement, timestamp, declencheur)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
    """, fsm_batch, page_size=200)
    print(f"[OK] fsm_transitions: {len(fsm_batch)}")

    conn.commit()
    cur.close()
    conn.close()
    print("\n[OK] All done — database seeded.")


if __name__ == "__main__":
    seed_all()