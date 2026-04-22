# Neo-Sousse 2030 — Smart City Platform
Module: Théorie des Langages et Compilation · Section IA 2 · 2025-2026

## Folder structure

```
neo-sousse-2030/
│
├── database/
│   ├── config.py          ← DB connection + thresholds constants
│   ├── db_init.py         ← CREATE TABLE (run once)
│   ├── db_utils.py        ← get_conn(), fetch_all(), fetch_one(), execute()
│   ├── generate_data.py   ← seed 1000+ rows (zones/capteurs/mesures/etc.)
│   └── verify_data.py     ← sanity checks + sample queries
│
├── simulator/
│   ├── sensor_simulator.py   ← real-time loop: insert new mesures every N sec
│   ├── simulator_config.py   ← intervals, anomaly rates, sensor pools
│   ├── simulator_utils.py    ← value generators, anomaly injection
│   └── simulator_logger.py   ← structured logging
│
├── compiler/
│   ├── lexer.py           ← tokenize French NL input
│   ├── grammar.py         ← keyword maps, patterns, grammar rules
│   ├── ast_nodes.py       ← AST node dataclasses
│   ├── parser.py          ← token stream → AST
│   ├── code_generator.py  ← AST → SQL string
│   ├── compiler.py        ← orchestrator: input → SQL (one call)
│   └── test_compiler.py   ← 10+ test scenarios
│
├── api/
│   ├── main.py            ← FastAPI app, CORS, startup
│   ├── config.py          ← API settings (port, origins, etc.)
│   └── routes/
│       ├── query.py       ← POST /query  (NL → SQL → results)
│       ├── sensors.py     ← GET/PATCH /sensors
│       ├── zones.py       ← GET /zones + stats
│       ├── dashboard.py   ← GET /dashboard/stats
│       └── interventions.py ← FSM-driven intervention workflow
│
├── automata/
│   ├── fsm_capteur.py        ← sensor lifecycle FSM
│   ├── fsm_intervention.py   ← intervention workflow FSM
│   ├── fsm_vehicule.py       ← autonomous vehicle FSM
│   ├── fsm_engine.py         ← base engine + transition logger
│   └── test_automata.py      ← test all 3 FSMs
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.jsx         ← KPIs + charts overview
│   │   │   ├── LiveStats.jsx         ← real-time sensor feed
│   │   │   ├── NLQueryInterface.jsx  ← compiler UI
│   │   │   ├── PollutionChart.jsx    ← time-series chart
│   │   │   ├── SensorCard.jsx        ← sensor state card
│   │   │   ├── FSMViewer.jsx         ← automata diagram
│   │   │   └── AIReports.jsx         ← generative reports panel
│   │   ├── services/
│   │   │   └── api.js         ← axios client → FastAPI
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── tailwind.config.js
│
├── tests/
│   ├── test_compiler.py      ← 10 NL→SQL scenarios
│   ├── test_automata.py      ← FSM transition sequences
│   ├── test_api.py           ← endpoint integration tests
│   └── test_data.py          ← DB integrity checks
│
├── .env.example              ← DB_HOST, DB_NAME, DB_USER, DB_PASS, OPENAI_KEY
├── requirements.txt
└── README.md
```

## Setup

```bash
# 1. PostgreSQL
createdb neo_sousse

# 2. Python env
pip install -r requirements.txt

# 3. Schema
cd database && python db_init.py

# 4. Seed data
python generate_data.py

# 5. Verify
python verify_data.py

# 6. API
cd ../api && uvicorn main:app --reload --port 8000

# 7. Frontend
cd ../frontend && npm install && npm run dev
```

## Build order
1. ✅ database/      — schema + seed
2. ⬜ automata/      — FSM engine (3 machines)
3. ⬜ compiler/      — NL→SQL (lexer→parser→AST→codegen)
4. ⬜ api/           — FastAPI routes
5. ⬜ frontend/      — React dashboard
6. ⬜ simulator/     — real-time feed
