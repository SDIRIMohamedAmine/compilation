# -*- coding: utf-8 -*-
"""
compiler/lexer.py
Phase 1: Tokenise raw French NL input into a list of Token objects.

Input : "Affiche les 5 zones les plus polluees"
Output: [Token(ACTION,'affiche'), Token(NUMBER,5), Token(ENTITY,'zones'),
         Token(KEYWORD,'plus'), Token(ATTR,'polluees')]
"""
import re
import unicodedata
from dataclasses import dataclass
from typing import List

from compiler.grammar import (
    T_ACTION, T_ENTITY, T_ATTR, T_OP, T_NUMBER, T_KEYWORD, T_STOP,
    ACTION_MAP, ENTITY_MAP, ATTR_MAP, OP_MAP, KEYWORD_MAP
)


# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class Token:
    type:  str
    value: str
    raw:   str = ""        # original text before normalization

    def __repr__(self):
        return f"{self.type}({self.value!r})"


class LexerError(Exception):
    pass


# ─────────────────────────────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    """Lowercase + strip accents + collapse whitespace."""
    text = text.lower().strip()
    # remove accents
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    # collapse whitespace
    text = re.sub(r"\s+", " ", text)
    return text


def tokenize(raw_input: str) -> List[Token]:
    """
    Main entry point.
    Returns a list of Tokens, STOP tokens filtered out.
    """
    text = _normalize(raw_input)
    tokens: List[Token] = []
    pos = 0
    n = len(text)

    while pos < n:
        # skip whitespace
        if text[pos] == " ":
            pos += 1
            continue

        matched = False

        # ── try multi-word phrases first (longest match) ──────────────────
        for length in (3, 2):
            words_ahead = " ".join(text[pos:].split()[:length])
            norm = words_ahead

            if norm in ATTR_MAP:
                table, col, op, val = ATTR_MAP[norm]
                tokens.append(Token(T_ATTR, norm, norm))
                pos += len(norm)
                matched = True
                break

            if norm in ACTION_MAP:
                tokens.append(Token(T_ACTION, norm, norm))
                pos += len(norm)
                matched = True
                break

        if matched:
            continue

        # ── single-word tokens ────────────────────────────────────────────
        # grab next word (or operator)
        op_match = re.match(r"(>=|<=|!=|>|<|=)", text[pos:])
        if op_match:
            raw_op = op_match.group(1)
            tokens.append(Token(T_OP, OP_MAP.get(raw_op, raw_op), raw_op))
            pos += len(raw_op)
            continue

        word_match = re.match(r"[\w\-]+", text[pos:])
        if not word_match:
            pos += 1   # skip unknown char (punctuation)
            continue

        word = word_match.group(0)
        pos += len(word)

        # number?
        if re.fullmatch(r"\d+(\.\d+)?", word):
            val = float(word) if "." in word else int(word)
            tokens.append(Token(T_NUMBER, val, word))
            continue

        # action?
        if word in ACTION_MAP:
            tokens.append(Token(T_ACTION, word, word))
            continue

        # entity?
        if word in ENTITY_MAP:
            tokens.append(Token(T_ENTITY, ENTITY_MAP[word], word))
            continue

        # single-word attr?
        if word in ATTR_MAP:
            tokens.append(Token(T_ATTR, word, word))
            continue

        # operator word?
        if word in OP_MAP:
            tokens.append(Token(T_OP, OP_MAP[word], word))
            continue

        # keyword / stop?
        kw = KEYWORD_MAP.get(word, None)
        if kw == "STOP" or kw is None:
            # unknown word — treat as STOP (ignore)
            tokens.append(Token(T_STOP, word, word))
            continue

        tokens.append(Token(T_KEYWORD, kw, word))

    # filter out STOP tokens
    return [t for t in tokens if t.type != T_STOP]


# ─────────────────────────────────────────────────────────────────────────────
# quick test
if __name__ == "__main__":
    tests = [
        "Affiche les 5 zones les plus polluees",
        "Combien de capteurs sont hors service ?",
        "Quels citoyens ont un score ecologique > 80 ?",
        "Donne-moi le trajet le plus economique en CO2",
        "Quelles interventions sont en cours ?",
        "capteurs actifs dans la zone",
    ]
    for t in tests:
        print(f"IN : {t}")
        print(f"OUT: {tokenize(t)}")
        print()
