# -*- coding: utf-8 -*-
"""
api/main.py  — THE file you must restart uvicorn with.
All routers registered here including vehicules.
"""
import sys
import os

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# ── optional scheduler ────────────────────────────────────────────────────────
try:
    from apscheduler.schedulers.background import BackgroundScheduler
    _HAS_SCHEDULER = True
except ImportError:
    _HAS_SCHEDULER = False

scheduler = BackgroundScheduler() if _HAS_SCHEDULER else None

def _run_sweep():
    try:
        from automata.sweeper import sweep_all
        sweep_all()
    except Exception as e:
        print(f"[SWEEPER ERROR] {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    if scheduler:
        scheduler.add_job(_run_sweep, "interval", minutes=30, id="sweeper")
        scheduler.start()
        print("[SCHEDULER] Sweeper running every 30 min.")
    yield
    if scheduler:
        scheduler.shutdown(wait=False)

# ── app ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Neo-Sousse 2030 API",
    description="Smart City Platform — Compilation & IA Générative",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── routers ───────────────────────────────────────────────────────────────────
from api.routes import sensors, zones, dashboard, query, interventions, automata, reports
from api.routes import vehicules   # ← THIS IS WHAT WAS MISSING

app.include_router(reports.router,       prefix="/reports",       tags=["Rapports IA"])
app.include_router(sensors.router,       prefix="/sensors",       tags=["Capteurs"])
app.include_router(zones.router,         prefix="/zones",         tags=["Zones"])
app.include_router(dashboard.router,     prefix="/dashboard",     tags=["Dashboard"])
app.include_router(query.router,         prefix="/query",         tags=["Compilateur NL→SQL"])
app.include_router(interventions.router, prefix="/interventions", tags=["Interventions"])
app.include_router(automata.router,      prefix="/automata",      tags=["Automates FSM"])
app.include_router(vehicules.router,     prefix="/vehicules",     tags=["Véhicules"])

# ── health ────────────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "project": "Neo-Sousse 2030"}

@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
