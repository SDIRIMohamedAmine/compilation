// pages/CompilerPage.jsx — full pipeline trace + ambiguity suggestions
import { useState } from "react";
import { runNLQuery, getQueryExamples } from "../services/api";
import { useApi } from "../hooks/useApi";
import SQLBlock  from "../components/SQLBlock";
import DataGrid  from "../components/DataGrid";

const PHASES = ["LEXER","PARSER","AST","SEMANTIC","CODEGEN"];

const TOKEN_COLOR = {
  ACTION:  "var(--accent)",
  ENTITY:  "var(--green)",
  ATTR:    "var(--amber)",
  NUMBER:  "var(--purple)",
  OP:      "var(--red)",
  KEYWORD: "var(--text-2)",
};

export default function CompilerPage() {
  const [input,   setInput]   = useState("");
  const [trace,   setTrace]   = useState(null);
  const [loading, setLoading] = useState(false);

  const { data: examples } = useApi(getQueryExamples);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setLoading(true); setTrace(null);
    try {
      const r = await runNLQuery(input.trim());
      setTrace(r);
    } catch (e) {
      setTrace({ error: e.message, error_phase: "NETWORK", suggestions: [], ambiguous: false });
    } finally {
      setLoading(false);
    }
  };

  const donePhases  = trace && !trace.error ? PHASES :
    trace ? PHASES.slice(0, PHASES.indexOf(trace.error_phase)) : [];
  const failedPhase = trace?.error_phase;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1.5rem", maxWidth:920 }}>

      {/* header */}
      <div>
        <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--accent)", letterSpacing:"0.1em", marginBottom:4 }}>
          MODULE 02 — COMPILATEUR NL→SQL
        </div>
        <div style={{ fontSize:18, fontWeight:500 }}>Requêtes en langage naturel</div>
        <div style={{ fontSize:12, color:"var(--text-2)", marginTop:4 }}>
          Pipeline: Lexer → Parser → AST → Analyse sémantique → CodeGen → SQL
        </div>
      </div>

      {/* input */}
      <div className="card">
        <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-3)", letterSpacing:"0.08em", marginBottom:10 }}>
          REQUÊTE EN FRANÇAIS
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <input
            style={{ flex:1, fontSize:14, padding:"10px 14px" }}
            placeholder="Ex: Affiche les 5 zones les plus polluées"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
          />
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "…" : "▶ Compiler"}
          </button>
        </div>

        {/* pipeline progress bar */}
        <div style={{ display:"flex", gap:4, marginTop:14, alignItems:"center" }}>
          {PHASES.map((p, i) => {
            const done   = donePhases.includes(p);
            const failed = p === failedPhase;
            return (
              <div key={p} style={{ display:"flex", alignItems:"center", gap:4 }}>
                <div style={{
                  fontFamily:"var(--font-mono)", fontSize:9,
                  padding:"3px 10px", borderRadius:3,
                  border:`1px solid ${failed ? "var(--red)" : done ? "var(--green)" : "var(--border-hi)"}`,
                  color:  failed ? "var(--red)" : done ? "var(--green)" : "var(--text-3)",
                  background: failed ? "var(--red-dim)" : done ? "var(--green-dim)" : "var(--bg)",
                  transition:"all 0.2s",
                }}>
                  {done && !failed ? "✓ " : failed ? "✕ " : ""}{p}
                </div>
                {i < PHASES.length-1 && (
                  <span style={{ color: done ? "var(--green)" : "var(--text-3)", fontSize:11 }}>→</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Ambiguity suggestions ── */}
      {trace?.ambiguous && trace.suggestions?.length > 0 && (
        <div className="card fade-up" style={{ borderColor:"var(--amber)", background:"var(--amber-dim)" }}>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--amber)", letterSpacing:"0.08em", marginBottom:10 }}>
            ⚠ REQUÊTE AMBIGUË — Vouliez-vous dire ?
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {trace.suggestions.map((s, i) => (
              <div key={i}
                onClick={() => { setInput(s.suggestion); setTrace(null); }}
                style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"8px 12px", borderRadius:"var(--radius)",
                  border:"1px solid var(--amber-dim)", background:"var(--bg-3)",
                  cursor:"pointer", transition:"border-color 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor="var(--amber)"}
                onMouseLeave={e => e.currentTarget.style.borderColor="var(--bg-3)"}
              >
                <span style={{ fontSize:12, color:"var(--text)" }}>{s.suggestion}</span>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--amber)" }}>
                  {Math.round(s.score * 100)}% similaire
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* pipeline steps */}
      {trace && (
        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>

          {/* PHASE 1 — LEXER */}
          <PhaseCard phase="LEXER" index="01"
            status={trace.tokens ? "ok" : trace.error_phase === "LEXER" ? "err" : "skip"}
            description="Découpe la phrase en tokens. Supprime les mots vides.">
            {trace.tokens && (
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {trace.tokens.map((t, i) => (
                  <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                    <span style={{
                      fontFamily:"var(--font-mono)", fontSize:11,
                      padding:"3px 8px", borderRadius:3,
                      border:"1px solid var(--border-hi)",
                      color: TOKEN_COLOR[t.type] || "var(--text-2)",
                      background:"var(--bg)",
                    }}>{t.value}</span>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:8, color:"var(--text-3)" }}>
                      {t.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {trace.error_phase === "LEXER" && <ErrMsg msg={trace.error} />}
          </PhaseCard>

          {/* PHASE 2 — PARSER */}
          <PhaseCard phase="PARSER" index="02"
            status={trace.ast ? "ok" : trace.error_phase === "PARSER" ? "err" : "skip"}
            description="Vérifie la grammaire. Construit la structure de la requête.">
            {trace.ast && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[
                  ["query_type",  trace.ast.query_type],
                  ["entity",      trace.ast.entity],
                  ["limit",       trace.ast.limit ?? "—"],
                  ["order",       trace.ast.order ? `${trace.ast.order.column} ${trace.ast.order.direction}` : "—"],
                  ["aggregation", trace.ast.aggregation ? `${trace.ast.aggregation.func}(${trace.ast.aggregation.column})` : "—"],
                  ["condition",   trace.ast.condition ? `${trace.ast.condition.left} ${trace.ast.condition.operator} ${trace.ast.condition.right}` : "—"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:"1px solid var(--border)" }}>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-3)" }}>{k}</span>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--accent)" }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
            {trace.error_phase === "PARSER" && <ErrMsg msg={trace.error} />}
          </PhaseCard>

          {/* PHASE 3 — AST */}
          <PhaseCard phase="AST (ARBRE SYNTAXIQUE)" index="03"
            status={trace.ast ? "ok" : "skip"}
            description="Représentation hiérarchique pure de l'intention.">
            {trace.ast && (
              <div className="code-block" style={{ fontSize:11 }}>
{`[QueryNode: ${trace.ast.query_type}]
  ├── [TargetNode: ENTITY = ${trace.ast.entity}]${
  trace.ast.condition ? `
  └── [ConditionNode: FILTER]
         ├── [Left:  ${trace.ast.condition.left}]
         ├── [Op:    ${trace.ast.condition.operator}]
         └── [Right: ${trace.ast.condition.right}]` :
  trace.ast.aggregation ? `
  └── [AggNode: ${trace.ast.aggregation.func}(${trace.ast.aggregation.column})]
         └── [OrderNode: ${trace.ast.order?.column} ${trace.ast.order?.direction}]
         └── [LimitNode: ${trace.ast.limit}]` : ""}`}
              </div>
            )}
          </PhaseCard>

          {/* PHASE 4 — SEMANTIC */}
          <PhaseCard phase="ANALYSE SÉMANTIQUE" index="04"
            status={trace.semantic?.status === "OK" ? "ok" : trace.error_phase === "SEMANTIC" ? "err" : "skip"}
            description="Vérifie que tables et colonnes existent dans le schéma PostgreSQL.">
            {trace.semantic && (
              <div style={{
                padding:"8px 12px", borderRadius:"var(--radius)",
                background: trace.semantic.status === "OK" ? "var(--green-dim)" : "var(--red-dim)",
                fontFamily:"var(--font-mono)", fontSize:11,
                color: trace.semantic.status === "OK" ? "var(--green)" : "var(--red)",
              }}>
                {trace.semantic.status === "OK" ? "✓" : "✕"} {trace.semantic.checks}
              </div>
            )}
            {trace.error_phase === "SEMANTIC" && <ErrMsg msg={trace.error} />}
          </PhaseCard>

          {/* PHASE 5 — SQL */}
          <PhaseCard phase="SQL GÉNÉRÉ (CODEGEN)" index="05"
            status={trace.sql ? "ok" : trace.error_phase === "CODEGEN" ? "err" : "skip"}
            description="Le visiteur d'arbre traduit chaque nœud en clause SQL.">
            {trace.sql && <SQLBlock sql={trace.sql} />}
            {trace.error_phase === "CODEGEN" && <ErrMsg msg={trace.error} />}
          </PhaseCard>

          {trace.error_phase === "SQL_EXEC" && (
            <div className="card" style={{ borderColor:"var(--red)", background:"var(--red-dim)" }}>
              <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--red)" }}>
                ✕ Erreur exécution SQL: {trace.error}
              </span>
            </div>
          )}

          {/* Results */}
          {trace.results?.length > 0 && (
            <div className="card">
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-3)", letterSpacing:"0.08em" }}>
                  RÉSULTATS POSTGRESQL
                </div>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--green)" }}>
                  {trace.count} lignes
                </span>
              </div>
              <DataGrid data={trace.results} />
            </div>
          )}
          {trace.sql && trace.results?.length === 0 && !trace.error && (
            <div style={{ textAlign:"center", color:"var(--text-3)", fontFamily:"var(--font-mono)", fontSize:12, padding:"1rem" }}>
              — 0 résultats —
            </div>
          )}
        </div>
      )}

      {/* examples */}
      <div className="card">
        <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-3)", letterSpacing:"0.08em", marginBottom:12 }}>
          EXEMPLES
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {(examples||[]).map((ex,i) => (
            <div key={i} onClick={() => { setInput(ex.nl); setTrace(null); }}
              style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"8px 12px", borderRadius:"var(--radius)",
                border:"1px solid var(--border)", cursor:"pointer", transition:"border-color 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor="var(--accent)"}
              onMouseLeave={e => e.currentTarget.style.borderColor="var(--border)"}
            >
              <span style={{ fontSize:12 }}>{ex.nl}</span>
              <span style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--text-3)" }}>{ex.hint}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PhaseCard({ phase, index, status, description, children }) {
  const color = status === "ok" ? "var(--green)" : status === "err" ? "var(--red)" : "var(--text-3)";
  const bg    = status === "ok" ? "var(--green-dim)" : status === "err" ? "var(--red-dim)" : "var(--bg)";
  return (
    <div className="card" style={{ borderColor: status === "err" ? "var(--red)" : "var(--border)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: children ? 14 : 0 }}>
        <div style={{ fontFamily:"var(--font-mono)", fontSize:9, padding:"2px 8px",
          borderRadius:3, background: bg, color, border:`1px solid ${color}` }}>
          {index}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color, letterSpacing:"0.07em" }}>
            {phase}
          </div>
          <div style={{ fontSize:11, color:"var(--text-3)", marginTop:1 }}>{description}</div>
        </div>
        <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color }}>
          {status === "ok" ? "✓ OK" : status === "err" ? "✕ ERREUR" : "—"}
        </div>
      </div>
      {children}
    </div>
  );
}

function ErrMsg({ msg }) {
  return (
    <div style={{ padding:"8px 12px", borderRadius:"var(--radius)",
      background:"var(--red-dim)", fontFamily:"var(--font-mono)",
      fontSize:11, color:"var(--red)" }}>
      ✕ {msg}
    </div>
  );
}
