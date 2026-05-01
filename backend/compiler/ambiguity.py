# -*- coding: utf-8 -*-
"""
compiler/ambiguity.py
+5% bonus: detects ambiguous / unrecognised queries and suggests corrections.

Strategy:
  1. Try the full compile pipeline.
  2. If it fails, run fuzzy matching against known example queries.
  3. Return the top 3 suggestions with similarity score.
"""
import unicodedata
import re

# Known working queries used as suggestion corpus
KNOWN_QUERIES = [
    "Affiche les 5 zones les plus polluees",
    "Combien de capteurs sont hors service ?",
    "Quels citoyens ont un score ecologique > 80 ?",
    "Donne-moi le trajet le plus economique en CO2",
    "Quelles interventions sont en cours ?",
    "Affiche les capteurs actifs",
    "Affiche les capteurs signales",
    "Combien de capteurs sont actifs ?",
    "Affiche les 10 zones les plus polluees",
    "Quels citoyens ont un score ecologique > 50 ?",
    "Quelles interventions sont urgentes ?",
    "Affiche les capteurs en maintenance",
    "Combien d interventions sont en cours ?",
    "Affiche les capteurs hors service",
]


def _normalize(text: str) -> str:
    text = text.lower().strip()
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text


def _jaccard(a: str, b: str) -> float:
    """Token-level Jaccard similarity."""
    sa = set(_normalize(a).split())
    sb = set(_normalize(b).split())
    if not sa and not sb:
        return 1.0
    return len(sa & sb) / len(sa | sb)


def suggest_alternatives(user_input: str, top_n: int = 3) -> list:
    """
    Return top_n most similar known queries with their similarity score.

    Returns:
        [{"suggestion": str, "score": float}, ...]
    """
    scored = [
        {"suggestion": q, "score": round(_jaccard(user_input, q), 3)}
        for q in KNOWN_QUERIES
    ]
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_n]


def compile_with_fallback(nl_input: str) -> dict:
    """
    Try to compile. On failure, return suggestions instead of a bare error.

    Returns the standard compile_query dict, extended with:
        "suggestions": list of alternative queries (empty on success)
        "ambiguous":   True if we fell back to suggestions
    """
    from compiler.compiler import compile_query, CompilerError

    try:
        result = compile_query(nl_input)
        result["suggestions"] = []
        result["ambiguous"]   = False
        return result

    except CompilerError as e:
        suggestions = suggest_alternatives(nl_input)
        return {
            "input":       nl_input,
            "tokens":      None,
            "ast":         None,
            "sql":         None,
            "errors":      [str(e)],
            "error":       str(e),
            "error_phase": e.phase,
            "suggestions": suggestions,
            "ambiguous":   True,
        }


# ── CLI test ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    tests = [
        "Montre moi les zones pollues",          # slightly off
        "capteurs en panne combien",             # wrong word order
        "liste des interventions pas terminees", # paraphrase
        "zones avec beaucoup de pollution",      # vague
    ]
    for t in tests:
        result = compile_with_fallback(t)
        print(f"\nINPUT: {t}")
        if result["ambiguous"]:
            print(f"  [AMBIGUOUS] Error: {result['error']}")
            print(f"  Suggestions:")
            for s in result["suggestions"]:
                print(f"    ({s['score']:.2f}) {s['suggestion']}")
        else:
            print(f"  [OK] SQL: {result['sql']}")
