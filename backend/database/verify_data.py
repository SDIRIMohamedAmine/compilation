# -*- coding: utf-8 -*-
"""
verify_data.py — Sanity checks after seeding
Usage: python verify_data.py
"""
from db_utils import fetch_all, fetch_one

CHECKS = [
    ("zones",          "SELECT COUNT(*) n FROM zones"),
    ("techniciens",    "SELECT COUNT(*) n FROM techniciens"),
    ("capteurs",       "SELECT COUNT(*) n FROM capteurs"),
    ("citoyens",       "SELECT COUNT(*) n FROM citoyens"),
    ("vehicules",      "SELECT COUNT(*) n FROM vehicules"),
    ("trajets",        "SELECT COUNT(*) n FROM trajets"),
    ("mesures",        "SELECT COUNT(*) n FROM mesures"),
    ("interventions",  "SELECT COUNT(*) n FROM interventions"),
    ("fsm_transitions","SELECT COUNT(*) n FROM fsm_transitions"),
]

QUERIES = [
    ("Top 5 zones polluées (PM2.5 moy)",
     """SELECT z.nom, ROUND(AVG(m.valeur)::numeric,2) moy_pm25
        FROM mesures m
        JOIN capteurs c ON c.capteur_id = m.capteur_id
        JOIN zones z    ON z.zone_id    = c.zone_id
        WHERE m.type_mesure = 'pm25'
        GROUP BY z.nom ORDER BY moy_pm25 DESC LIMIT 5"""),

    ("Capteurs hors service",
     "SELECT COUNT(*) n FROM capteurs WHERE statut = 'hors_service'"),

    ("Citoyens score > 80",
     "SELECT COUNT(*) n FROM citoyens WHERE score_ecologique > 80"),

    ("Anomalies dernières 24h",
     """SELECT COUNT(*) n FROM mesures
        WHERE est_anomalie = TRUE
        AND timestamp > NOW() - INTERVAL '24 hours'"""),

    ("Trajet le plus économique CO2",
     """SELECT trajet_id, economie_co2
        FROM trajets ORDER BY economie_co2 DESC LIMIT 1"""),

    ("Interventions en cours (non terminées)",
     """SELECT statut, COUNT(*) n FROM interventions
        WHERE statut != 'termine' GROUP BY statut"""),
]


def run():
    print("─" * 50)
    print("ROW COUNTS")
    print("─" * 50)
    for label, q in CHECKS:
        row = fetch_one(q)
        print(f"  {label:<20} {row['n']:>8}")

    print("\n" + "─" * 50)
    print("SAMPLE QUERIES")
    print("─" * 50)
    for label, q in QUERIES:
        print(f"\n  {label}")
        rows = fetch_all(q)
        for r in rows:
            print(f"    {dict(r)}")


if __name__ == "__main__":
    run()