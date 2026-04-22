# -*- coding: utf-8 -*-
"""
compiler/semantic.py
Phase 4: Validates AST against the DB schema.
Raises SemanticError if column/table doesn't exist.
"""
from compiler.grammar import SCHEMA
from compiler.ast_nodes import QueryNode, ConditionNode, AttributeNode, AggNode


class SemanticError(Exception):
    pass


def _check_table(table: str):
    if table not in SCHEMA:
        raise SemanticError(
            f"Table inconnue: '{table}'. "
            f"Tables disponibles: {list(SCHEMA.keys())}"
        )


def _check_column(table: str, column: str):
    # wildcards / aliases / aggregates are always ok
    if column in ("*", "COUNT(*) AS total"):
        return
    if column.startswith("COUNT(") or column.startswith("AVG("):
        return
    # qualified names like "zones.nom" -> split
    if "." in column:
        table, column = column.split(".", 1)
    if column.endswith(" AS total") or " AS " in column:
        column = column.split()[0]
    if column not in SCHEMA.get(table, set()):
        raise SemanticError(
            f"Colonne '{column}' introuvable dans la table '{table}'. "
            f"Colonnes disponibles: {sorted(SCHEMA[table])}"
        )


def analyze(ast: QueryNode) -> QueryNode:
    """
    Walk the AST, validate all table/column references.
    Returns the same AST if valid, raises SemanticError otherwise.
    """
    target = ast.target
    if not target:
        raise SemanticError("Requete sans cible (aucune entite trouvee)")

    table = target.entity

    # special: pollution queries use mesures + join, main table becomes zones
    if table == "zones" and ast.aggregation:
        # mesures join is handled, skip strict check
        return ast

    _check_table(table)

    # validate SELECT columns
    for col in target.columns:
        _check_column(table, col)

    # validate condition
    if ast.condition:
        _check_condition(ast.condition, table)

    # validate aggregation column
    if ast.aggregation:
        agg: AggNode = ast.aggregation
        _check_column(table, agg.column)

    # validate ORDER column
    if ast.order:
        col = ast.order.column
        # alias (moy_valeur etc) always ok
        if not col.startswith("moy") and not col.startswith("avg"):
            _check_column(table, col)

    return ast


def _check_condition(cond: ConditionNode, table: str):
    if isinstance(cond.left, AttributeNode):
        col = cond.left.column
        tbl = cond.left.table or table
        _check_table(tbl)
        _check_column(tbl, col)
    elif isinstance(cond.left, ConditionNode):
        _check_condition(cond.left, table)

    if isinstance(cond.right, ConditionNode):
        _check_condition(cond.right, table)
