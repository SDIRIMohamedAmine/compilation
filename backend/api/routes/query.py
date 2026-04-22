# -*- coding: utf-8 -*-
"""
routes/query.py -- NL -> SQL endpoint with full pipeline trace
"""
from fastapi import APIRouter, HTTPException
from database.db_utils import fetch_all


from compiler.lexer        import tokenize,  LexerError
from compiler.parser       import parse,     ParseError
from compiler.semantic     import analyze,   SemanticError
from compiler.code_generator import generate, CodeGenError

router = APIRouter()


@router.post("/")
def nl_query(body: dict):
    text = body.get("query", "").strip()
    if not text:
        raise HTTPException(400, "query field required")

    trace = {
        "input":    text,
        "tokens":   None,
        "ast":      None,
        "semantic": None,
        "sql":      None,
        "results":  [],
        "count":    0,
        "error":    None,
        "error_phase": None,
    }

    # ── Phase 1: Lexer ────────────────────────────────────────────────────
    try:
        tokens = tokenize(text)
        trace["tokens"] = [
            {"type": t.type, "value": str(t.value), "raw": t.raw}
            for t in tokens
        ]
    except LexerError as e:
        trace["error"] = str(e); trace["error_phase"] = "LEXER"
        return trace

    if not tokens:
        trace["error"] = "Aucun token reconnu"; trace["error_phase"] = "LEXER"
        return trace

    # ── Phase 2: Parser ───────────────────────────────────────────────────
    try:
        ast = parse(tokens)
        trace["ast"] = {
            "query_type": ast.query_type,
            "entity":     ast.target.entity if ast.target else None,
            "columns":    ast.target.columns if ast.target else [],
            "condition":  _fmt_condition(ast.condition),
            "limit":      ast.limit.value if ast.limit else None,
            "order":      {"column": ast.order.column, "direction": ast.order.direction} if ast.order else None,
            "aggregation":{"func": ast.aggregation.func, "column": ast.aggregation.column} if ast.aggregation else None,
        }
    except ParseError as e:
        trace["error"] = str(e); trace["error_phase"] = "PARSER"
        return trace

    # ── Phase 3: Semantic ─────────────────────────────────────────────────
    try:
        ast = analyze(ast)
        trace["semantic"] = {
            "status": "OK",
            "table":  ast.target.entity,
            "checks": f"Table '{ast.target.entity}' validee, colonnes OK",
        }
    except SemanticError as e:
        trace["semantic"] = {"status": "ERROR", "checks": str(e)}
        trace["error"] = str(e); trace["error_phase"] = "SEMANTIC"
        return trace

    # ── Phase 4: CodeGen ──────────────────────────────────────────────────
    try:
        sql = generate(ast)
        trace["sql"] = sql
    except CodeGenError as e:
        trace["error"] = str(e); trace["error_phase"] = "CODEGEN"
        return trace

    # ── Execute SQL ───────────────────────────────────────────────────────
    try:
        rows = fetch_all(sql)
        trace["results"] = [dict(r) for r in rows]
        trace["count"]   = len(trace["results"])
    except Exception as e:
        trace["error"] = str(e); trace["error_phase"] = "SQL_EXEC"

    return trace


def _fmt_condition(cond):
    if cond is None:
        return None
    from compiler.ast_nodes import ConditionNode, AttributeNode, ValueNode
    if isinstance(cond, ConditionNode):
        left  = f"{cond.left.table}.{cond.left.column}" if isinstance(cond.left, AttributeNode) else str(cond.left)
        right = cond.right.value if isinstance(cond.right, ValueNode) else str(cond.right)
        return {"left": left, "operator": cond.operator, "right": right}
    return str(cond)


@router.get("/examples")
def query_examples():
    return [
        {"nl": "Affiche les 5 zones les plus polluees",         "hint": "top 5 pollution"},
        {"nl": "Combien de capteurs sont hors service ?",        "hint": "count"},
        {"nl": "Quels citoyens ont un score ecologique > 80 ?",  "hint": "filter"},
        {"nl": "Donne-moi le trajet le plus economique en CO2",  "hint": "top 1"},
        {"nl": "Quelles interventions sont en cours ?",          "hint": "filter statut"},
        {"nl": "Affiche les capteurs actifs",                    "hint": "filter statut"},
    ]
