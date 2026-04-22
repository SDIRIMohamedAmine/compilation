# -*- coding: utf-8 -*-
"""
api/paths.py
Adds all sibling folders to sys.path so imports work regardless
of where uvicorn is launched from.
"""
import sys
import os

# resolve backend/ root (parent of api/)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

FOLDERS = ["database", "compiler", "automata", "ai"]

for folder in FOLDERS:
    p = os.path.join(ROOT, folder)
    if p not in sys.path:
        sys.path.insert(0, p)
