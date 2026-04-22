"""
db_utils.py — Reusable DB helpers
"""
import psycopg2
import psycopg2.extras
from contextlib import contextmanager
from database.config import DB_CONFIG


@contextmanager
def get_conn():
    conn = psycopg2.connect(DB_CONFIG["dsn"])
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def fetch_all(query, params=None):
    with get_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(query, params)
        return cur.fetchall()


def fetch_one(query, params=None):
    with get_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(query, params)
        return cur.fetchone()


def execute(query, params=None):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(query, params)


def execute_many(query, data):
    with get_conn() as conn:
        cur = conn.cursor()
        psycopg2.extras.execute_batch(cur, query, data, page_size=200)