const RESERVED_WORDS = new Set([
  "VALUE", "TOTAL", "COUNT", "SUM", "AVG", "MIN", "MAX",
  "KEY", "GROUP", "ORDER", "INDEX", "TABLE", "COLUMN", "ROWS",
  "LIMIT", "OFFSET", "DESC", "ASC", "ALL", "DISTINCT",
  "SELECT", "FROM", "WHERE", "HAVING", "JOIN", "INNER",
  "LEFT", "RIGHT", "OUTER", "ON", "USING", "UNION", "CASE",
  "WHEN", "THEN", "ELSE", "END", "NULL", "NOT", "AND", "OR",
  "IS", "IN", "LIKE", "BETWEEN", "EXISTS", "AS", "BY",
]);

/**
 * Wrap reserved-word aliases in brackets so AlaSQL doesn't parse them as keywords.
 * e.g. `SUM(amount) AS total` → `SUM(amount) AS [total]`
 * Already-bracketed aliases are left alone.
 */
export function sanitizeReservedAliases(sql: string): string {
  return sql.replace(
    /\bAS\s+(\w+)/gi,
    (match, alias: string) => {
      if (RESERVED_WORDS.has(alias.toUpperCase())) {
        return `AS [${alias}]`;
      }
      return match;
    },
  );
}
