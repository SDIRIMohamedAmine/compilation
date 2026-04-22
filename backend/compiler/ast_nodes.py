# -*- coding: utf-8 -*-
"""
compiler/ast_nodes.py
All AST node dataclasses. Pure data — no logic.
"""
from dataclasses import dataclass, field
from typing import Optional, List, Any


@dataclass
class Node:
    """Base AST node."""
    pass


# ── Query root ────────────────────────────────────────────────────────────────

@dataclass
class QueryNode(Node):
    """
    Root node.
    query_type: SELECT_LIST | SELECT_COUNT | SELECT_TOP | SELECT_AGG
    """
    query_type: str                          # SELECT_LIST | SELECT_COUNT | SELECT_TOP | SELECT_AGG
    target: "TargetNode" = None
    condition: Optional["ConditionNode"] = None
    limit: Optional["LimitNode"] = None
    order: Optional["OrderNode"] = None
    aggregation: Optional["AggNode"] = None


# ── Target (FROM clause) ──────────────────────────────────────────────────────

@dataclass
class TargetNode(Node):
    """The main entity being queried."""
    entity: str                              # capteurs | zones | citoyens | trajets | interventions
    columns: List[str] = field(default_factory=list)   # [] means SELECT *
    join: Optional["JoinNode"] = None


@dataclass
class JoinNode(Node):
    """Optional JOIN to another table."""
    table: str
    on_left: str
    on_right: str
    condition: Optional[str] = None          # extra filter on joined table


# ── Conditions (WHERE clause) ─────────────────────────────────────────────────

@dataclass
class ConditionNode(Node):
    """A single WHERE condition or compound (AND/OR)."""
    left: Any                                # AttributeNode | ConditionNode
    operator: str                            # > < = >= <= != AND OR
    right: Any                               # ValueNode | ConditionNode


@dataclass
class AttributeNode(Node):
    """A column reference."""
    table: Optional[str]
    column: str


@dataclass
class ValueNode(Node):
    """A literal value."""
    value: Any
    dtype: str                               # int | float | str


# ── Modifiers ─────────────────────────────────────────────────────────────────

@dataclass
class LimitNode(Node):
    value: int


@dataclass
class OrderNode(Node):
    column: str
    direction: str = "DESC"                  # ASC | DESC


@dataclass
class AggNode(Node):
    """Aggregation: AVG, COUNT, MAX, etc."""
    func: str                                # AVG | COUNT | MAX | MIN | SUM
    column: str
    alias: str = ""
    group_by: Optional[str] = None
