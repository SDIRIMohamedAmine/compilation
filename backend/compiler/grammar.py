# -*- coding: utf-8 -*-
"""
compiler/grammar.py
All vocabulary mappings: French keywords -> internal tokens/values.
Edit here to extend the language without touching lexer/parser.
"""

# ── Token types ───────────────────────────────────────────────────────────────
T_ACTION   = "ACTION"
T_ENTITY   = "ENTITY"
T_ATTR     = "ATTR"
T_OP       = "OP"
T_NUMBER   = "NUMBER"
T_KEYWORD  = "KEYWORD"    # top, plus, moins, economique...
T_ZONE     = "ZONE"       # named zones
T_STOP     = "STOP"       # ignored words

# ── Actions → query type ──────────────────────────────────────────────────────
# Maps normalized French token -> internal query type
ACTION_MAP = {
    # listing / selection
    "affiche":         "SELECT_LIST",
    "montre":          "SELECT_LIST",
    "liste":           "SELECT_LIST",
    "afficher":        "SELECT_LIST",
    "quels":           "SELECT_LIST",
    "quelles":         "SELECT_LIST",
    "donne":           "SELECT_LIST",
    "donne-moi":       "SELECT_LIST",
    "trouve":          "SELECT_LIST",

    # counting
    "combien":         "SELECT_COUNT",
    "nombre":          "SELECT_COUNT",

    # top N / ranking
    # detected at parser level when NUMBER follows SELECT_LIST
}

# ── Entity → table name ───────────────────────────────────────────────────────
ENTITY_MAP = {
    # capteurs
    "capteur":         "capteurs",
    "capteurs":        "capteurs",
    "senseur":         "capteurs",
    "senseurs":        "capteurs",
    "capteur_id":      "capteurs",

    # zones
    "zone":            "zones",
    "zones":           "zones",
    "quartier":        "zones",
    "quartiers":       "zones",

    # citoyens
    "citoyen":         "citoyens",
    "citoyens":        "citoyens",
    "habitant":        "citoyens",
    "habitants":       "citoyens",
    "personne":        "citoyens",

    # vehicules
    "vehicule":        "vehicules",
    "vehicules":       "vehicules",
    "voiture":         "vehicules",
    "voitures":        "vehicules",
    "bus":             "vehicules",

    # trajets
    "trajet":          "trajets",
    "trajets":         "trajets",
    "voyage":          "trajets",
    "itineraire":      "trajets",

    # interventions
    "intervention":    "interventions",
    "interventions":   "interventions",
    "maintenance":     "interventions",
    "reparation":      "interventions",
}

# ── Attribute keywords → (table, column) ─────────────────────────────────────
ATTR_MAP = {
    # capteurs attributes
    "hors service":          ("capteurs", "statut", "=", "hors_service"),
    "hors_service":          ("capteurs", "statut", "=", "hors_service"),
    "actif":                 ("capteurs", "statut", "=", "actif"),
    "actifs":                ("capteurs", "statut", "=", "actif"),
    "inactif":               ("capteurs", "statut", "=", "inactif"),
    "signale":               ("capteurs", "statut", "=", "signale"),
    "signales":              ("capteurs", "statut", "=", "signale"),
    "en maintenance":        ("capteurs", "statut", "=", "en_maintenance"),
    "en_maintenance":        ("capteurs", "statut", "=", "en_maintenance"),
    "taux erreur":           ("capteurs", "taux_erreur", None, None),
    "taux_erreur":           ("capteurs", "taux_erreur", None, None),

    # zones / pollution
    "polluees":              ("mesures",  "valeur",     None, None),
    "polluee":               ("mesures",  "valeur",     None, None),
    "pollution":             ("mesures",  "valeur",     None, None),
    "polluant":              ("mesures",  "valeur",     None, None),
    "pm25":                  ("mesures",  "valeur",     None, None),
    "qualite air":           ("mesures",  "valeur",     None, None),
    "qualite_air":           ("mesures",  "valeur",     None, None),

    # citoyens attributes
    "score ecologique":      ("citoyens", "score_ecologique", None, None),
    "score_ecologique":      ("citoyens", "score_ecologique", None, None),
    "score eco":             ("citoyens", "score_ecologique", None, None),
    "score":                 ("citoyens", "score_ecologique", None, None),

    # trajets attributes
    "economique":            ("trajets",  "economie_co2", None, None),
    "economie co2":          ("trajets",  "economie_co2", None, None),
    "economie_co2":          ("trajets",  "economie_co2", None, None),
    "co2":                   ("trajets",  "economie_co2", None, None),
    "distance":              ("trajets",  "distance_km",  None, None),

    # interventions attributes
    "en cours":              ("interventions", "statut", "!=", "termine"),
    "en_cours":              ("interventions", "statut", "!=", "termine"),
    "termine":               ("interventions", "statut", "=",  "termine"),
    "terminees":             ("interventions", "statut", "=",  "termine"),
    "urgente":               ("interventions", "priorite", "=", "urgente"),
    "urgentes":              ("interventions", "priorite", "=", "urgente"),
}

# ── Column → SELECT columns & ORDER hint ──────────────────────────────────────
ATTR_SELECT_MAP = {
    "capteurs":       ["capteur_id", "type_capteur", "statut", "taux_erreur", "zone_id"],
    "zones":          ["zone_id", "nom", "population", "superficie"],
    "citoyens":       ["nom", "prenom", "score_ecologique", "zone_id"],
    "trajets":        ["trajet_id", "economie_co2", "distance_km", "vehicule_id"],
    "interventions":  ["intervention_id", "capteur_id", "statut", "priorite", "date_demande"],
    "mesures":        ["mesure_id", "capteur_id", "timestamp", "type_mesure", "valeur", "unite"],
}

# ── JOIN rules: if entity needs data from another table ───────────────────────
JOIN_MAP = {
    # (main_table, required_column) -> join definition
    ("capteurs", "zone_nom"):   ("zones", "z", "c.zone_id = z.zone_id", "z.nom AS zone_nom"),
    ("mesures",  "zone"):       ("zones", "z", "capteurs c ON c.capteur_id = m.capteur_id JOIN zones z ON z.zone_id = c.zone_id", None),
    ("citoyens", "zone_nom"):   ("zones", "z", "c.zone_id = z.zone_id", "z.nom AS zone_nom"),
}

# ── Operators ─────────────────────────────────────────────────────────────────
OP_MAP = {
    ">":            ">",
    "<":            "<",
    "=":            "=",
    ">=":           ">=",
    "<=":           "<=",
    "!=":           "!=",
    "superieur":    ">",
    "inferieur":    "<",
    "egal":         "=",
    "plus grand":   ">",
    "plus petit":   "<",
}

# ── Keywords ──────────────────────────────────────────────────────────────────
KEYWORD_MAP = {
    "top":          "TOP",
    "plus":         "PLUS",
    "moins":        "MOINS",
    "les":          "STOP",
    "de":           "STOP",
    "des":          "STOP",
    "du":           "STOP",
    "un":           "STOP",
    "une":          "STOP",
    "le":           "STOP",
    "la":           "STOP",
    "sont":         "STOP",
    "ont":          "STOP",
    "avec":         "STOP",
    "qui":          "STOP",
    "quel":         "STOP",
    "?":            "STOP",
    "!":            "STOP",
    ",":            "STOP",
    "dans":         "STOP",
    "sur":          "STOP",
    "par":          "STOP",
    "pour":         "STOP",
    "au":           "STOP",
    "aux":          "STOP",
    "en":           "STOP",
    "et":           "STOP",
    "ou":           "STOP",
    "un":           "STOP",
    "score":        "STOP",  # handled via ATTR_MAP "score ecologique"
}

# ── Semantic schema: what columns exist on what table ────────────────────────
SCHEMA = {
    "capteurs":      {"capteur_id","zone_id","type_capteur","statut","date_installation",
                      "taux_erreur","nb_anomalies_totales","seuil_alerte","modele"},
    "zones":         {"zone_id","nom","description","superficie","population"},
    "citoyens":      {"citoyen_id","nom","prenom","email","zone_id","score_ecologique","date_inscription"},
    "vehicules":     {"vehicule_id","citoyen_id","type_vehicule","statut","zone_actuelle_id","immatriculation"},
    "trajets":       {"trajet_id","vehicule_id","zone_depart_id","zone_arrivee_id",
                      "timestamp_depart","timestamp_arrivee","distance_km","economie_co2","statut"},
    "interventions": {"intervention_id","capteur_id","statut","technicien1_id","technicien2_id",
                      "validation_ia","description","priorite","date_demande","date_terminaison"},
    "mesures":       {"mesure_id","capteur_id","timestamp","type_mesure","valeur","unite","est_anomalie"},
}
