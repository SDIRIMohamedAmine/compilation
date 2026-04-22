# -*- coding: utf-8 -*-
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

conn = psycopg2.connect("host=localhost port=5432 dbname=postgres user=postgres password=amin123+++")
conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
cur = conn.cursor()

try:
    # Drop it first to clear the old tables
    cur.execute("DROP DATABASE IF EXISTS neosousse (FORCE);")
    cur.execute("CREATE DATABASE neosousse;")
    print("✅ Database 'neosousse' recreated freshly!")
except Exception as e:
    print(f"Error: {e}")

cur.close()
conn.close()