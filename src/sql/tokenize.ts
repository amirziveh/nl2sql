import type { ColumnRef } from "./types.js";

const SQL_KEYWORDS = new Set([
  "select", "from", "where", "join", "inner", "left", "right", "outer",
  "on", "group", "by", "order", "having", "and", "or", "not", "null",
  "is", "in", "between", "like", "as", "asc", "desc", "distinct",
  "limit", "offset", "union", "all", "case", "when", "then", "else", "end",
  "count", "sum", "avg", "min", "max", "cast",
]);

const CLAUSE_KEYWORDS = new Set([
  "select", "from", "where", "join", "inner", "left", "right", "outer",
  "on", "group", "by", "order", "having",
]);

export function identifyTableRefs(sql: string): Set<string> {
  const normalized = sql.replace(/\s+/g, " ").trim();
  if (!/^select/i.test(normalized)) {
    return new Set();
  }
  const tokens = tokenize(normalized);
  const refs = new Set<string>();
  const TABLE_CLAUSES = new Set(["from", "join"]);
  for (let i = 0; i < tokens.length; i++) {
    const lower = tokens[i]!.toLowerCase();
    if (!TABLE_CLAUSES.has(lower)) continue;
    let j = i + 1;
    while (j < tokens.length && tokens[j] === " ") j++;
    if (j >= tokens.length) continue;
    const next = tokens[j]!;
    if (next === "(" || next === ")") continue;
    if (next === "*" || next === "," || next === ".") continue;
    if (/^['"`].*['"`]$/.test(next) || /^\d/.test(next)) continue;
    if (SQL_KEYWORDS.has(next.toLowerCase())) continue;
    refs.add(stripBrackets(next).toLowerCase());
  }
  return refs;
}

export function extractColumnRefs(sql: string): ColumnRef[] {
  const normalized = sql.replace(/\s+/g, " ").trim();
  if (!/^select/i.test(normalized)) {
    return [];
  }

  const tokens = tokenize(normalized);
  const refs: ColumnRef[] = [];
  let expectColumn = false;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    const lower = tok.toLowerCase();

    if (CLAUSE_KEYWORDS.has(lower) || lower === "and" || lower === "or") {
      expectColumn = true;
      continue;
    }
    if (SQL_KEYWORDS.has(lower)) {
      continue;
    }
    if (tok === "*" || tok === "," || tok === "(" || tok === ")" || tok === "." || tok === ";") {
      if (tok === ",") expectColumn = true;
      if (tok === "*" && expectColumn) {
        refs.push({ table: undefined, column: "*" });
        expectColumn = false;
      }
      continue;
    }
    if (tok === "=" || tok === "<" || tok === ">" || tok === "<=" || tok === ">=" || tok === "<>" || tok === "!=") {
      expectColumn = true;
      continue;
    }
    if (/^['"`].*['"`]$/.test(tok) || /^\d/.test(tok)) {
      continue;
    }
    if (lower === "as") {
      continue;
    }

    if (expectColumn || i === 0) {
      const next = tokens[i + 1];
      const prev = tokens[i - 1];
      if (next === ".") {
        const table = tok;
        const col = tokens[i + 2];
        if (col && !SQL_KEYWORDS.has(col.toLowerCase())) {
          refs.push({ table, column: stripBrackets(col).toLowerCase() });
        }
        i += 2;
        expectColumn = false;
        continue;
      }
      if (prev !== ".") {
        refs.push({ table: undefined, column: stripBrackets(tok).toLowerCase() });
      }
      expectColumn = false;
    }
  }

  return dedupe(refs);
}

function tokenize(sql: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i]!;
    if (ch === " " || ch === "\t" || ch === "\n") {
      i++;
      continue;
    }
    if (ch === "[" || ch === '"' || ch === "`" || ch === "'") {
      const close = ch === "[" ? "]" : ch;
      let j = i + 1;
      while (j < sql.length && sql[j] !== close) j++;
      tokens.push(sql.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    if (ch === "(" || ch === ")" || ch === "," || ch === "." || ch === ";") {
      tokens.push(ch);
      i++;
      continue;
    }
    if (ch === "=" || ch === "<" || ch === ">" || ch === "!") {
      let j = i + 1;
      if (j < sql.length && (sql[j] === "=" || sql[j] === ">")) j++;
      tokens.push(sql.slice(i, j));
      i = j;
      continue;
    }
    let j = i;
    while (j < sql.length && !/[\s(),.;[\]"'`=<>!]/.test(sql[j]!)) j++;
    tokens.push(sql.slice(i, j));
    i = j;
  }
  return tokens;
}

function stripBrackets(tok: string): string {
  if (tok.startsWith("[") && tok.endsWith("]")) return tok.slice(1, -1);
  if (tok.startsWith('"') && tok.endsWith('"')) return tok.slice(1, -1);
  if (tok.startsWith("`") && tok.endsWith("`")) return tok.slice(1, -1);
  return tok;
}

function dedupe(refs: ColumnRef[]): ColumnRef[] {
  const seen = new Set<string>();
  const out: ColumnRef[] = [];
  for (const r of refs) {
    const key = `${r.table ?? ""}.${r.column}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}
