# -*- coding: utf-8 -*-
import traceback
from fastapi import APIRouter, HTTPException

# Fix the import!
from ai.report_generator import generate_report

router = APIRouter()
VALID_TYPES = {"air", "capteurs", "interventions", "co2"}


@router.post("/generate")
def generate(body: dict):
    report_type = body.get("type", "air")
    if report_type not in VALID_TYPES:
        raise HTTPException(400, f"type must be one of {VALID_TYPES}")
    try:
        result = generate_report(report_type)
        return result
    except Exception as e:
        # return full traceback so frontend can show real error
        detail = f"{type(e).__name__}: {e}\n{traceback.format_exc()}"
        raise HTTPException(500, detail=detail)


@router.get("/types")
def report_types():
    return [
        {"type": "air",           "label": "Qualité de l'air"},
        {"type": "capteurs",      "label": "Statut capteurs"},
        {"type": "interventions", "label": "Interventions"},
        {"type": "co2",           "label": "Bilan CO2"},
    ]
