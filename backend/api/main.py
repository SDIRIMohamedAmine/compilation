import sys
import os

# 1. FIND THE ROOT 'backend' FOLDER FIRST
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 2. INJECT IT INTO PYTHON's PATH BEFORE ANY OTHER IMPORTS
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

# 3. NOW YOU CAN IMPORT YOUR MODULES SAFELY
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import sensors, zones, dashboard, query, interventions, automata, reports

app = FastAPI(
    title="Neo-Sousse 2030 API",
    description="Smart City Platform — Compilation & IA",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reports.router,       prefix="/reports",       tags=["Rapports IA"])
app.include_router(sensors.router,       prefix="/sensors",       tags=["Capteurs"])
app.include_router(zones.router,         prefix="/zones",         tags=["Zones"])
app.include_router(dashboard.router,     prefix="/dashboard",     tags=["Dashboard"])
app.include_router(query.router,         prefix="/query",         tags=["Compilateur NL->SQL"])
app.include_router(interventions.router, prefix="/interventions", tags=["Interventions"])
app.include_router(automata.router,      prefix="/automata",      tags=["Automates FSM"])

@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "project": "Neo-Sousse 2030"}

@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)