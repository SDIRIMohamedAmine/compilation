# -*- coding: utf-8 -*-
"""
compiler/code_generator.py
Phase 5: AST -> SQL string (tree walker / visitor pattern).
"""
from compiler.ast_nodes import (
    QueryNode, TargetNode, ConditionNode, AttributeNode,
    ValueNode, LimitNode, OrderNode, AggNode, JoinNode
)


class CodeGenError(Exception):
    pass


class SQLGenerator:

    def generate(self, ast: QueryNode) -> str:
        qt = ast.query_type
        if qt == "SELECT_COUNT":
            return self._gen_count(ast)
        return self._gen_select(ast)

    def _gen_count(self, ast: QueryNode) -> str:
        table = ast.target.entity
        sql   = f"SELECT COUNT(*) AS total\nFROM {table}"
        if ast.condition:
            sql += f"\nWHERE {self._gen_condition(ast.condition)}"
        return sql + ";"

    def _gen_select(self, ast: QueryNode) -> str:
        target = ast.target
        table  = target.entity

        # SELECT clause
        if ast.aggregation:
            agg      = ast.aggregation
            func_col = f"{agg.func}({agg.column})"
            alias    = agg.alias or f"{agg.func.lower()}_{agg.column}"
            prefix   = self._group_cols(ast)
            select   = f"SELECT {prefix}{func_col} AS {alias}"
        elif target.columns:
            select = f"SELECT {', '.join(target.columns)}"
        else:
            select = "SELECT *"

        from_clause = self._gen_from(table, target.join, ast.aggregation)

        where = f"\nWHERE {self._gen_condition(ast.condition)}" if ast.condition else ""

        # GROUP BY — always qualify with table name to avoid ambiguity
        group = ""
        if ast.aggregation and ast.aggregation.group_by:
            gb = ast.aggregation.group_by
            # ensure qualified
            if "." not in gb:
                gb = f"zones.{gb}"
            group = f"\nGROUP BY {gb}, zones.nom"

        order = f"\nORDER BY {ast.order.column} {ast.order.direction}" if ast.order else ""
        limit = f"\nLIMIT {ast.limit.value}" if ast.limit else ""

        return f"{select}\n{from_clause}{where}{group}{order}{limit};"

    def _group_cols(self, ast: QueryNode) -> str:
        if ast.target.entity == "zones" and ast.aggregation:
            return "zones.zone_id, zones.nom, "
        return ""

    def _gen_from(self, table: str, join: JoinNode = None, agg: AggNode = None) -> str:
        if join:
            if "mesures" in join.table:
                return (
                    f"FROM zones\n"
                    f"JOIN {join.table}\n"
                    f"  ON {join.on_right} = zones.zone_id"
                )
            return f"FROM {table}\nJOIN {join.table} ON {join.on_left} = {join.on_right}"
        return f"FROM {table}"

    def _gen_condition(self, cond: ConditionNode) -> str:
        return f"{self._gen_expr(cond.left)} {cond.operator} {self._gen_expr(cond.right)}"

    def _gen_expr(self, node) -> str:
        if isinstance(node, AttributeNode):
            return f"{node.table}.{node.column}" if node.table else node.column
        if isinstance(node, ValueNode):
            return f"'{node.value}'" if node.dtype == "str" else str(node.value)
        if isinstance(node, ConditionNode):
            return f"({self._gen_condition(node)})"
        return str(node)


def generate(ast: QueryNode) -> str:
    return SQLGenerator().generate(ast)