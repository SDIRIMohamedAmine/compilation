# -*- coding: utf-8 -*-
"""
compiler/test_compiler.py
12 test scenarios covering all compiler phases.
Usage: python test_compiler.py
"""
from compiler import compile_query, CompilerError

PASS = "[PASS]"
FAIL = "[FAIL]"
results = []


def test(name, fn):
    try:
        fn()
        print(f"  {PASS} {name}")
        results.append((name, True, None))
    except Exception as e:
        print(f"  {FAIL} {name}: {e}")
        results.append((name, False, str(e)))


def assert_sql_contains(nl, *fragments):
    r = compile_query(nl)
    sql = r["sql"].lower()
    for frag in fragments:
        assert frag.lower() in sql, f"Expected '{frag}' in SQL:\n{r['sql']}"


# ─────────────────────────────────────────────────────────────────────────────
# Phase 1 — Lexer
# ─────────────────────────────────────────────────────────────────────────────
print("\n[LEXER]")

def t1_tokens_extracted():
    from lexer import tokenize
    toks = tokenize("Affiche les 5 zones les plus polluees")
    types = [t.type for t in toks]
    assert "ACTION" in types
    assert "NUMBER" in types
    assert "ENTITY" in types
test("tokens extracted from 'Affiche les 5 zones les plus polluees'", t1_tokens_extracted)

def t2_stop_words_removed():
    from lexer import tokenize
    toks = tokenize("Combien de capteurs sont hors service ?")
    values = [t.value for t in toks]
    assert "de" not in values
    assert "sont" not in values
    assert "?" not in values
test("stop words removed (de, sont, ?)", t2_stop_words_removed)

def t3_multiword_attr():
    from lexer import tokenize
    toks = tokenize("capteurs hors service")
    attrs = [t.value for t in toks if t.type == "ATTR"]
    assert "hors service" in attrs, f"Got: {attrs}"
test("multi-word attr 'hors service' tokenized as single ATTR", t3_multiword_attr)

# ─────────────────────────────────────────────────────────────────────────────
# Phase 2 — Parser
# ─────────────────────────────────────────────────────────────────────────────
print("\n[PARSER]")

def t4_count_query():
    from lexer import tokenize
    from parser import parse
    ast = parse(tokenize("Combien de capteurs sont hors service ?"))
    assert ast.query_type == "SELECT_COUNT"
    assert ast.target.entity == "capteurs"
test("count query: query_type=SELECT_COUNT, entity=capteurs", t4_count_query)

def t5_top_query():
    from lexer import tokenize
    from parser import parse
    ast = parse(tokenize("Affiche les 5 zones les plus polluees"))
    assert ast.limit is not None
    assert ast.limit.value == 5
test("top query: limit=5 extracted", t5_top_query)

def t6_condition_parsed():
    from lexer import tokenize
    from parser import parse
    from ast_nodes import ConditionNode
    ast = parse(tokenize("Quels citoyens ont un score ecologique > 80 ?"))
    assert isinstance(ast.condition, ConditionNode)
    assert ast.condition.operator == ">"
    assert ast.condition.right.value == 80
test("condition parsed: score_ecologique > 80", t6_condition_parsed)

def t7_syntax_error_bad_order():
    from lexer import tokenize
    from parser import parse, ParseError
    try:
        parse(tokenize("capteurs 5 combien affiche"))
        assert False, "Should raise ParseError"
    except ParseError:
        pass
test("syntax error raised for 'capteurs 5 combien affiche'", t7_syntax_error_bad_order)

# ─────────────────────────────────────────────────────────────────────────────
# Phase 3 — Semantic
# ─────────────────────────────────────────────────────────────────────────────
print("\n[SEMANTIC]")

def t8_valid_query_passes():
    r = compile_query("Quels citoyens ont un score ecologique > 80 ?")
    assert r["sql"] is not None
test("valid query passes semantic check", t8_valid_query_passes)

def t9_invalid_column_blocked():
    from lexer import tokenize
    from parser import parse
    from semantic import analyze, SemanticError
    from ast_nodes import QueryNode, TargetNode, ConditionNode, AttributeNode, ValueNode
    # manually craft invalid AST: capteurs.score_ecologique doesn't exist
    ast = QueryNode(
        query_type="SELECT_LIST",
        target=TargetNode(entity="capteurs"),
        condition=ConditionNode(
            left=AttributeNode(table="capteurs", column="score_ecologique"),
            operator=">",
            right=ValueNode(value=80, dtype="int")
        )
    )
    try:
        analyze(ast)
        assert False, "Should raise SemanticError"
    except SemanticError as e:
        assert "score_ecologique" in str(e)
test("semantic blocks capteurs.score_ecologique (invalid column)", t9_invalid_column_blocked)

# ─────────────────────────────────────────────────────────────────────────────
# Phase 4 — SQL Generation (end-to-end)
# ─────────────────────────────────────────────────────────────────────────────
print("\n[SQL GENERATION]")

def t10_count_sql():
    assert_sql_contains(
        "Combien de capteurs sont hors service ?",
        "count(*)", "capteurs", "hors_service"
    )
test("COUNT SQL: 'Combien de capteurs sont hors service ?'", t10_count_sql)

def t11_citizen_filter_sql():
    assert_sql_contains(
        "Quels citoyens ont un score ecologique > 80 ?",
        "citoyens", "score_ecologique", "> 80"
    )
test("FILTER SQL: citoyens score_ecologique > 80", t11_citizen_filter_sql)

def t12_top_pollution_sql():
    assert_sql_contains(
        "Affiche les 5 zones les plus polluees",
        "avg(", "limit 5", "order by"
    )
test("TOP SQL: 5 zones les plus polluees with AVG + ORDER + LIMIT", t12_top_pollution_sql)

def t13_intervention_en_cours():
    assert_sql_contains(
        "Quelles interventions sont en cours ?",
        "interventions", "statut", "termine"
    )
test("FILTER SQL: interventions en cours (statut != termine)", t13_intervention_en_cours)

def t14_co2_trajet():
    assert_sql_contains(
        "Donne-moi le trajet le plus economique en CO2",
        "trajets", "economie_co2", "limit"
    )
test("TOP SQL: trajet le plus economique en CO2", t14_co2_trajet)

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*55)
passed = sum(1 for _, ok, _ in results if ok)
print(f"RESULTS: {passed}/{len(results)} passed")
for name, ok, err in results:
    s = PASS if ok else FAIL
    print(f"  {s} {name}" + (f"\n       -> {err}" if err else ""))
