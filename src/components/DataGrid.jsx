// components/DataGrid.jsx — auto-columns from data shape
export default function DataGrid({ data = [], maxRows = 50 }) {
  if (!data.length) return (
    <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
      — no results —
    </div>
  );

  const cols = Object.keys(data[0]);
  const rows = data.slice(0, maxRows);

  const fmt = (v) => {
    if (v === null || v === undefined) return <span style={{ color: "var(--text-3)" }}>null</span>;
    if (typeof v === "boolean") return (
      <span className={`badge badge-${v ? "green" : "red"}`}>{v ? "true" : "false"}</span>
    );
    if (typeof v === "object") return (
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-2)" }}>
        {JSON.stringify(v)}
      </span>
    );
    // timestamps
    if (typeof v === "string" && v.match(/^\d{4}-\d{2}-\d{2}T/)) {
      return new Date(v).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
    }
    return String(v);
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>{cols.map(c => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {cols.map(c => (
                <td key={c} style={{ fontFamily: typeof row[c] === "number" ? "var(--font-mono)" : undefined }}>
                  {fmt(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > maxRows && (
        <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
          + {data.length - maxRows} more rows
        </div>
      )}
    </div>
  );
}
