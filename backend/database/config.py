# -*- coding: utf-8 -*-
import os

# Use DSN string -- avoids Windows cp1252 path issues with psycopg2 kwargs
def get_dsn():
    host   = os.getenv("DB_HOST", "localhost")
    port   = os.getenv("DB_PORT", "5432")
    dbname = os.getenv("DB_NAME", "neosousse")
    user   = os.getenv("DB_USER", "postgres")
    pw     = os.getenv("DB_PASS", "amin123+++")
    
    # We added options='-c lc_messages=en_US.UTF-8' here to prevent the French 
    # 'é' (0xe9) character from crashing psycopg2 when a connection error occurs.
    return (f"host={host} port={port} dbname={dbname} user={user} password={pw} "
            f"client_encoding=utf8 options='-c lc_messages=en_US.UTF-8'")

# Keep DB_CONFIG for compatibility but route through DSN
DB_CONFIG = {"dsn": get_dsn()}

SEUILS = {
    "pm25":         {"normal": (0, 25),    "warning": (25, 50),    "danger": (50, 500),   "unite": "ug/m3"},
    "pm10":         {"normal": (0, 50),    "warning": (50, 100),   "danger": (100, 600),  "unite": "ug/m3"},
    "co2":          {"normal": (300, 400), "warning": (400, 600),  "danger": (600, 5000), "unite": "ppm"},
    "no2":          {"normal": (0, 40),    "warning": (40, 100),   "danger": (100, 500),  "unite": "ug/m3"},
    "o3":           {"normal": (0, 60),    "warning": (60, 120),   "danger": (120, 400),  "unite": "ug/m3"},
    "bruit":        {"normal": (0, 55),    "warning": (55, 70),    "danger": (70, 140),   "unite": "dB"},
    "debit_trafic": {"normal": (0, 1500),  "warning": (1500, 2500),"danger": (2500, 5000),"unite": "veh/h"},
}