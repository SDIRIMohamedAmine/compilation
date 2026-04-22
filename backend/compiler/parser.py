# -*- coding: utf-8 -*-
"""
compiler/parser.py
Phase 2: Token stream -> AST.

Grammar rules (BNF-style):
  query       ::= count_query | top_query | list_query | agg_query
  count_query ::= ACTION(COUNT) ENTITY [condition]
  top_query   ::= ACTION(LIST) NUMBER ENTITY [attr_filter] [order_hint]
  list_query  ::= ACTION(LIST) ENTITY [condition]
  agg_query   ::= ACTION(LIST) ENTITY KEYWORD(plus|moins) ATTR
  condition   ::= ATTR | ATTR OP NUMBER | ATTR OP STRING
"""
from typing import List, Optional

from compiler.lexer import Token, tokenize
from compiler.grammar import (
    T_ACTION, T_ENTITY, T_ATTR, T_OP, T_NUMBER, T_KEYWORD,
    ACTION_MAP, ATTR_MAP, ENTITY_MAP
)
from compiler.ast_nodes import (
    QueryNode, TargetNode, ConditionNode, AttributeNode,
    ValueNode, LimitNode, OrderNode, AggNode, JoinNode
)


class ParseError(Exception):
    pass


# ─────────────────────────────────────────────────────────────────────────────

class Parser:

    def __init__(self, tokens: List[Token]):
        self.tokens = tokens
        self.pos    = 0

    # ── helpers ───────────────────────────────────────────────────────────────

    def peek(self, offset=0) -> Optional[Token]:
        i = self.pos + offset
        return self.tokens[i] if i < len(self.tokens) else None

    def consume(self, expected_type=None) -> Token:
        tok = self.peek()
        if tok is None:
            raise ParseError("Unexpected end of input")
        if expected_type and tok.type != expected_type:
            raise ParseError(
                f"Expected {expected_type}, got {tok.type}({tok.value!r}) at position {self.pos}"
            )
        self.pos += 1
        return tok

    def match(self, *types) -> bool:
        tok = self.peek()
        return tok is not None and tok.type in types

    def match_value(self, *values) -> bool:
        tok = self.peek()
        return tok is not None and tok.value in values

    # ── grammar rules ─────────────────────────────────────────────────────────

    def parse(self) -> QueryNode:
        if not self.tokens:
            raise ParseError("Empty input — no tokens to parse")

        action = self.consume(T_ACTION)
        query_type = ACTION_MAP.get(action.value, "SELECT_LIST")

        # SELECT_COUNT: "Combien [de] capteurs [condition]"
        if query_type == "SELECT_COUNT":
            return self._parse_count()

        # SELECT_LIST or TOP: "Affiche [N] entity [condition]"
        return self._parse_list_or_top(query_type)

    def _parse_count(self) -> QueryNode:
        entity_tok = self._expect_entity()
        table = entity_tok.value
        condition = self._parse_condition(table)

        return QueryNode(
            query_type="SELECT_COUNT",
            target=TargetNode(entity=table, columns=["COUNT(*) AS total"]),
            condition=condition,
        )

    def _parse_list_or_top(self, query_type: str) -> QueryNode:
        # optional NUMBER -> becomes TOP N
        limit = None
        if self.match(T_NUMBER):
            n = self.consume(T_NUMBER).value
            limit = LimitNode(value=int(n))
            query_type = "SELECT_TOP"

        entity_tok = self._expect_entity()
        table = entity_tok.value

        # optional "plus / moins" + ATTR -> aggregation / ordering
        order   = None
        agg     = None
        condition = None

        # "plus polluees" / "plus economique en co2"
        if self.match(T_KEYWORD) and self.peek().value in ("PLUS", "MOINS"):
            direction = "DESC" if self.consume(T_KEYWORD).value == "PLUS" else "ASC"
            if self.match(T_ATTR):
                attr_tok = self.consume(T_ATTR)
                attr_info = ATTR_MAP.get(attr_tok.value)
                if attr_info:
                    _, col, _, _ = attr_info
                    # pollution special case -> AVG(valeur) GROUP BY zone
                    if col == "valeur":
                        agg   = AggNode(func="AVG", column="valeur", alias="moy_valeur", group_by="zone_id")
                        order = OrderNode(column="moy_valeur", direction=direction)
                        # need JOIN mesures
                        target = TargetNode(entity="zones", columns=["zones.zone_id", "zones.nom"],
                                            join=JoinNode(
                                                table="capteurs c JOIN mesures m ON m.capteur_id = c.capteur_id",
                                                on_left="zones.zone_id", on_right="c.zone_id"
                                            ))
                    else:
                        order  = OrderNode(column=col, direction=direction)
                        target = TargetNode(entity=table)
                else:
                    target = TargetNode(entity=table)
            else:
                target = TargetNode(entity=table)

            if not limit:
                limit = LimitNode(value=5)

        else:
            target    = TargetNode(entity=table)
            condition = self._parse_condition(table)

        return QueryNode(
            query_type=query_type,
            target=target,
            condition=condition,
            limit=limit,
            order=order,
            aggregation=agg,
        )

    def _expect_entity(self) -> Token:
        if not self.match(T_ENTITY):
            remaining = [str(t) for t in self.tokens[self.pos:]]
            raise ParseError(
                f"Expected ENTITY token, got {remaining} — "
                f"Did you name a table? (capteurs, zones, citoyens, trajets, interventions)"
            )
        return self.consume(T_ENTITY)

    def _parse_condition(self, table: str) -> Optional[ConditionNode]:
        """Parse optional WHERE condition from remaining tokens."""
        if not self.tokens[self.pos:]:
            return None

        # ATTR with built-in operator: "hors service", "actif", "en cours"
        if self.match(T_ATTR):
            attr_tok  = self.consume(T_ATTR)
            attr_info = ATTR_MAP.get(attr_tok.value)
            if attr_info and attr_info[2] is not None:
                _, col, op, val = attr_info
                return ConditionNode(
                    left=AttributeNode(table=table, column=col),
                    operator=op,
                    right=ValueNode(value=val, dtype="str"),
                )

            # ATTR followed by OP NUMBER: "score ecologique > 80"
            if attr_info and self.match(T_OP):
                op_tok  = self.consume(T_OP)
                if self.match(T_NUMBER):
                    num_tok = self.consume(T_NUMBER)
                    _, col, _, _ = attr_info
                    return ConditionNode(
                        left=AttributeNode(table=table, column=col),
                        operator=op_tok.value,
                        right=ValueNode(value=num_tok.value,
                                        dtype="float" if isinstance(num_tok.value, float) else "int"),
                    )

        # OP NUMBER directly (e.g. "> 80" after implicit attribute)
        if self.match(T_OP):
            op_tok = self.consume(T_OP)
            if self.match(T_NUMBER):
                num_tok = self.consume(T_NUMBER)
                # best-guess column for table
                col = _default_numeric_col(table)
                return ConditionNode(
                    left=AttributeNode(table=table, column=col),
                    operator=op_tok.value,
                    right=ValueNode(value=num_tok.value, dtype="int"),
                )

        return None


def _default_numeric_col(table: str) -> str:
    defaults = {
        "citoyens":      "score_ecologique",
        "capteurs":      "taux_erreur",
        "mesures":       "valeur",
        "trajets":       "economie_co2",
        "interventions": "intervention_id",
    }
    return defaults.get(table, "id")


# ─────────────────────────────────────────────────────────────────────────────

def parse(tokens: List[Token]) -> QueryNode:
    return Parser(tokens).parse()


# quick test
if __name__ == "__main__":
    tests = [
        "Affiche les 5 zones les plus polluees",
        "Combien de capteurs sont hors service ?",
        "Quels citoyens ont un score ecologique > 80 ?",
        "Donne-moi le trajet le plus economique en CO2",
        "Quelles interventions sont en cours ?",
    ]
    for t in tests:
        toks = tokenize(t)
        print(f"TOKENS: {toks}")
        ast = parse(toks)
        print(f"AST:    {ast}")
        print()
