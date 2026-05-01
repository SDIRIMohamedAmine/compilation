# -*- coding: utf-8 -*-
"""
compiler/compiler.py
Orchestrator: raw French string -> SQL in one call.

Usage:
    from compiler.compiler import compile_query
    result = compile_query("Affiche les 5 zones les plus polluees")
    print(result["sql"])
"""
from compiler.lexer          import tokenize, LexerError
from compiler.parser         import parse,    ParseError
from compiler.semantic       import analyze,  SemanticError
from compiler.code_generator import generate, CodeGenError


class CompilerError(Exception):
    def __init__(self, phase: str, message: str):
        self.phase   = phase
        self.message = message
        super().__init__(f"[{phase}] {message}")


# ─────────────────────────────────────────────────────────────────────────────

def compile_query(nl_input: str) -> dict:
    """
    Full pipeline: NL -> tokens -> AST -> validated AST -> SQL.

    Returns:
        {
          "input":   str,
          "tokens":  list[str],
          "ast":     str,
          "sql":     str,
          "errors":  []
        }

    Raises CompilerError on any phase failure.
    """
    result = {
        "input":  nl_input,
        "tokens": [],
        "ast":    None,
        "sql":    None,
        "errors": [],
    }

    # Phase 1 — Lexer
    try:
        tokens = tokenize(nl_input)
        result["tokens"] = [repr(t) for t in tokens]
    except LexerError as e:
        raise CompilerError("LEXER", str(e))

    if not tokens:
        raise CompilerError("LEXER", "Aucun token reconnu dans l'entree")

    # Phase 2 — Parser
    try:
        ast = parse(tokens)
        result["ast"] = repr(ast)
    except ParseError as e:
        raise CompilerError("PARSER", str(e))

    # Phase 3 — Semantic analysis
    try:
        ast = analyze(ast)
    except SemanticError as e:
        raise CompilerError("SEMANTIC", str(e))

    # Phase 4 — Code generation
    try:
        sql = generate(ast)
        result["sql"] = sql
    except CodeGenError as e:
        raise CompilerError("CODEGEN", str(e))

    return result


# ─────────────────────────────────────────────────────────────────────────────
# CLI
if __name__ == "__main__":
    import sys
    query = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Combien de capteurs sont hors service ?"
    try:
        r = compile_query(query)
        print(f"INPUT  : {r['input']}")
        print(f"TOKENS : {r['tokens']}")
        print(f"AST    : {r['ast']}")
        print(f"SQL    :\n{r['sql']}")
    except CompilerError as e:
        print(f"ERROR [{e.phase}]: {e.message}")
