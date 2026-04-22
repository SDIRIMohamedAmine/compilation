"""
db_init.py — Create all tables (3NF normalized)
Usage: python db_init.py
"""
import psycopg2
from database.config import DB_CONFIG

SCHEMA = """
-- ─────────────────────────────────────────
-- zones
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zones (
    zone_id     SERIAL PRIMARY KEY,
    nom         VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    superficie  FLOAT,          -- km²
    population  INTEGER
);

-- ─────────────────────────────────────────
-- techniciens
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS techniciens (
    technicien_id SERIAL PRIMARY KEY,
    nom           VARCHAR(100) NOT NULL,
    prenom        VARCHAR(100) NOT NULL,
    specialite    VARCHAR(50)  NOT NULL CHECK (specialite IN ('air','bruit','trafic','general')),
    disponible    BOOLEAN DEFAULT TRUE,
    email         VARCHAR(150) UNIQUE
);

-- ─────────────────────────────────────────
-- capteurs
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capteurs (
    capteur_id        SERIAL PRIMARY KEY,
    zone_id           INTEGER NOT NULL REFERENCES zones(zone_id),
    type_capteur      VARCHAR(20) NOT NULL CHECK (type_capteur IN ('air','bruit','trafic','no2','o3')),
    statut            VARCHAR(20) NOT NULL DEFAULT 'inactif'
                          CHECK (statut IN ('inactif','actif','signale','en_maintenance','hors_service')),
    date_installation DATE NOT NULL,
    taux_erreur       FLOAT DEFAULT 0.0 CHECK (taux_erreur BETWEEN 0 AND 1),
    nb_anomalies_totales INTEGER DEFAULT 0,
    seuil_alerte      FLOAT NOT NULL,
    modele            VARCHAR(100),
    latitude          FLOAT,
    longitude         FLOAT
);

-- ─────────────────────────────────────────
-- mesures  (time-series)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mesures (
    mesure_id   SERIAL PRIMARY KEY,
    capteur_id  INTEGER NOT NULL REFERENCES capteurs(capteur_id),
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    type_mesure VARCHAR(20) NOT NULL CHECK (type_mesure IN ('pm25','pm10','co2','bruit','debit_trafic','no2','o3')),
    valeur      FLOAT NOT NULL,
    unite       VARCHAR(10) NOT NULL,
    est_anomalie BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_mesures_timestamp       ON mesures(timestamp);
CREATE INDEX IF NOT EXISTS idx_mesures_capteur_ts      ON mesures(capteur_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_mesures_type            ON mesures(type_mesure);
CREATE INDEX IF NOT EXISTS idx_mesures_anomalie        ON mesures(est_anomalie);

-- ─────────────────────────────────────────
-- citoyens
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS citoyens (
    citoyen_id       SERIAL PRIMARY KEY,
    nom              VARCHAR(100) NOT NULL,
    prenom           VARCHAR(100) NOT NULL,
    email            VARCHAR(150) UNIQUE,
    zone_id          INTEGER REFERENCES zones(zone_id),
    score_ecologique INTEGER DEFAULT 50 CHECK (score_ecologique BETWEEN 0 AND 100),
    date_inscription DATE DEFAULT CURRENT_DATE
);

-- ─────────────────────────────────────────
-- vehicules
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicules (
    vehicule_id      SERIAL PRIMARY KEY,
    citoyen_id       INTEGER REFERENCES citoyens(citoyen_id),  -- NULL = transport public
    type_vehicule    VARCHAR(30) NOT NULL CHECK (type_vehicule IN ('voiture','bus','velo','trottinette','autonome')),
    statut           VARCHAR(20) NOT NULL DEFAULT 'stationne'
                         CHECK (statut IN ('stationne','en_route','en_panne','arrive')),
    zone_actuelle_id INTEGER REFERENCES zones(zone_id),
    immatriculation  VARCHAR(20) UNIQUE,
    autonomie_km     FLOAT    -- NULL = non-electrique
);

-- ─────────────────────────────────────────
-- trajets
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trajets (
    trajet_id          SERIAL PRIMARY KEY,
    vehicule_id        INTEGER NOT NULL REFERENCES vehicules(vehicule_id),
    zone_depart_id     INTEGER NOT NULL REFERENCES zones(zone_id),
    zone_arrivee_id    INTEGER NOT NULL REFERENCES zones(zone_id),
    timestamp_depart   TIMESTAMPTZ NOT NULL,
    timestamp_arrivee  TIMESTAMPTZ,
    distance_km        FLOAT,
    economie_co2       FLOAT DEFAULT 0.0,  -- kg CO2 economises vs voiture thermique
    statut             VARCHAR(20) DEFAULT 'en_cours' CHECK (statut IN ('en_cours','termine','annule'))
);

-- ─────────────────────────────────────────
-- interventions  (FSM workflow)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interventions (
    intervention_id  SERIAL PRIMARY KEY,
    capteur_id       INTEGER NOT NULL REFERENCES capteurs(capteur_id),
    statut           VARCHAR(20) NOT NULL DEFAULT 'demande'
                         CHECK (statut IN ('demande','tech1_assigne','tech2_valide','ia_valide','termine')),
    technicien1_id   INTEGER REFERENCES techniciens(technicien_id),
    technicien2_id   INTEGER REFERENCES techniciens(technicien_id),
    validation_ia    BOOLEAN DEFAULT FALSE,
    description      TEXT,
    priorite         VARCHAR(10) DEFAULT 'normale' CHECK (priorite IN ('basse','normale','haute','urgente')),
    date_demande     TIMESTAMPTZ DEFAULT NOW(),
    date_terminaison TIMESTAMPTZ,
    rapport_final    TEXT
);

-- ─────────────────────────────────────────
-- fsm_transitions  (audit log)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fsm_transitions (
    transition_id   SERIAL PRIMARY KEY,
    entity_type     VARCHAR(20) NOT NULL CHECK (entity_type IN ('capteur','intervention','vehicule')),
    entity_id       INTEGER NOT NULL,
    etat_avant      VARCHAR(30) NOT NULL,
    etat_apres      VARCHAR(30) NOT NULL,
    evenement       VARCHAR(50) NOT NULL,
    timestamp       TIMESTAMPTZ DEFAULT NOW(),
    declencheur     VARCHAR(100)  -- 'system','ia','technicien_X'
);

CREATE INDEX IF NOT EXISTS idx_fsm_entity ON fsm_transitions(entity_type, entity_id);
"""

def init_db():
    conn = psycopg2.connect(DB_CONFIG["dsn"])
    cur = conn.cursor()
    cur.execute(SCHEMA)
    conn.commit()
    cur.close()
    conn.close()
    print("✓ Schema created")

if __name__ == "__main__":
    init_db()
