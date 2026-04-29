# -*- coding: utf-8 -*-
import traceback
from fastapi import APIRouter, HTTPException
from ai.report_generator import generate_report, generate_custom_report

router = APIRouter()
VALID_TYPES = {"air", "capteurs", "interventions", "co2", "custom"}


@router.post("/generate")
def generate(body: dict):
    report_type = body.get("type", "air")
    if report_type not in VALID_TYPES:
        raise HTTPException(400, f"type must be one of {VALID_TYPES}")
    try:
        if report_type == "custom":
            prompt = body.get("prompt", "").strip()
            if not prompt:
                raise HTTPException(400, "prompt field required for custom type")
            result = generate_custom_report(prompt)
        else:
            result = generate_report(report_type)
        return result
    except Exception as e:
        detail = f"{type(e).__name__}: {e}\n{traceback.format_exc()}"
        raise HTTPException(500, detail=detail)


@router.get("/types")
def report_types():
    return [
        {"type": "air",           "label": "Qualité de l'air"},
        {"type": "capteurs",      "label": "Statut capteurs"},
        {"type": "interventions", "label": "Interventions"},
        {"type": "co2",           "label": "Bilan CO2"},
        {"type": "custom",        "label": "Prompt libre"},
    ]