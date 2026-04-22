# -*- coding: utf-8 -*-
import traceback
from datetime import datetime
from database.db_utils import fetch_all, fetch_one
from ai.openrouter_client import ai_client, AIError

class SmartCityContext:
    @staticmethod
    def get_pollution() -> list:
        rows = fetch_all("""
            SELECT z.nom, m.type_mesure,
                   ROUND(AVG(m.valeur)::numeric,2) AS moyenne,
                   COUNT(*) FILTER (WHERE m.est_anomalie) AS anomalies
            FROM mesures m JOIN capteurs c ON c.capteur_id = m.capteur_id
            JOIN zones z ON z.zone_id = c.zone_id
            WHERE m.timestamp > NOW() - INTERVAL '24 hours'
            GROUP BY z.nom, m.type_mesure ORDER BY moyenne DESC
        """)
        return [dict(r) for r in rows]

    @staticmethod
    def get_sensors() -> dict:
        row = fetch_one("""
            SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE statut='actif') AS actifs,
                COUNT(*) FILTER (WHERE statut='hors_service') AS hors_service,
                ROUND((AVG(taux_erreur) * 100)::numeric, 1) AS taux_erreur_pct
            FROM capteurs
        """)
        return dict(row) if row else {}

    @staticmethod
    def get_interventions() -> list:
        rows = fetch_all("""
            SELECT i.statut, i.priorite, z.nom AS zone, c.type_capteur
            FROM interventions i JOIN capteurs c ON c.capteur_id = i.capteur_id
            JOIN zones z ON z.zone_id = c.zone_id
            WHERE i.statut != 'termine' ORDER BY i.priorite DESC LIMIT 10
        """)
        return [dict(r) for r in rows]

    @staticmethod
    def get_co2() -> dict:
        row = fetch_one("""
            SELECT ROUND(SUM(economie_co2)::numeric,2) AS total_economie_co2,
                   ROUND(AVG(economie_co2)::numeric,3) AS moy_co2_par_trajet,
                   COUNT(*) AS nb_trajets
            FROM trajets WHERE timestamp_depart > NOW() - INTERVAL '7 days'
        """)
        return dict(row) if row else {}

class ReportGenerator:
    SYSTEM_PROMPT = "Tu es l'IA Superviseur de Neo-Sousse 2030, une ville intelligente en Tunisie. Rédige un rapport professionnel en français avec des listes à puces."

    @staticmethod
    def build_prompt(report_type: str, ctx: dict) -> str:
        if report_type == "air":
            pollution = "\n".join([f"- {p['nom']} ({p['type_mesure']}): {p['moyenne']}" for p in ctx["pollution"][:5]])
            return f"Génère un rapport sur la qualité de l'air (24h).\nDonnées:\n{pollution}\nStructure: 1. Bilan global 2. Zones critiques 3. Recommandations"
        elif report_type == "capteurs":
            s = ctx["sensors"]
            return f"Rapport de santé IoT.\nRéseau: {s.get('actifs')}/{s.get('total')} actifs. Hors service: {s.get('hors_service')}. Erreur: {s.get('taux_erreur_pct')}%\nStructure: 1. État 2. Problèmes 3. Actions"
        elif report_type == "interventions":
            invs = "\n".join([f"- {i['priorite']} à {i['zone']} ({i['type_capteur']}) [{i['statut']}]" for i in ctx["interventions"]])
            return f"Rapport d'intervention.\nActives:\n{invs}\nStructure: 1. Statut 2. Urgences 3. Priorités"
        elif report_type == "co2":
            c = ctx["co2"]
            return f"Bilan CO2 (7j).\nÉconomie totale: {c.get('total_economie_co2')} kg. Trajets: {c.get('nb_trajets')}. Moyenne: {c.get('moy_co2_par_trajet')} kg/trajet.\nStructure: 1. Économies 2. Analyse 3. Recommandations"
        return "Génère un résumé de la ville intelligente."

def generate_report(report_type: str = "air") -> dict:
    error_msg = None
    text = ""
    safe_context = {"nb_sensors": 0, "interventions": 0}

    try:
        # 1. Fetch DB Context securely
        context = {
            "pollution": SmartCityContext.get_pollution(),
            "sensors": SmartCityContext.get_sensors(),
            "interventions": SmartCityContext.get_interventions(),
            "co2": SmartCityContext.get_co2()
        }
        
        safe_context["nb_sensors"] = context["sensors"].get("total", 0)
        safe_context["interventions"] = len(context["interventions"])

        # 2. Build AI Request
        messages = [
            {"role": "system", "content": ReportGenerator.SYSTEM_PROMPT},
            {"role": "user", "content": ReportGenerator.build_prompt(report_type, context)}
        ]

        # 3. Get AI Response
        text = ai_client.chat(messages)

    except AIError as e:
        error_msg = f"API AI non joignable : {str(e)}"
        text = f"**[Rapport par défaut - Mode Hors Ligne]**\nLe système d'intelligence artificielle n'a pas pu être contacté.\n\nDate: {datetime.now().strftime('%d/%m/%Y %H:%M')}\n\nAssurez-vous que la clé OPENROUTER_API_KEY est valide."
    except Exception as e:
        # Catch SQL errors, missing tables, or import issues
        print("Erreur critique AI:\n", traceback.format_exc())
        error_msg = f"Erreur Interne ({type(e).__name__}): {str(e)}"
        text = "**[Erreur Système]**\nUn problème technique empêche la génération du rapport."

    # Return a clean 200 payload even if it failed, so React can display the amber banner!
    return {
        "report_type": report_type,
        "text": text,
        "suggestions": [], 
        "context": safe_context,
        "error": error_msg,
    }