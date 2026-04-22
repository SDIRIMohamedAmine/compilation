// components/SQLBlock.jsx — syntax-highlighted SQL display
export default function SQLBlock({ sql }) {
  if (!sql) return null;

  const highlighted = sql
    .replace(/\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|JOIN|ON|COUNT|AVG|AS|AND|OR|NOT|DISTINCT|LEFT|INNER)\b/g,
      m => `<span class="kw-select">${m}</span>`)
    .replace(/\b(FROM|JOIN)\b/g,
      m => `<span class="kw-from">${m}</span>`)
    .replace(/\b(WHERE|AND|OR)\b/g,
      m => `<span class="kw-where">${m}</span>`)
    .replace(/'([^']+)'/g,
      (_, v) => `<span class="kw-val">'${v}'</span>`);

  return (
    <div className="code-block"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}
