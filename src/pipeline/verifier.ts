import type { TableSchema, QueryResultData } from "../sql/types.js";
import type { VerificationOutcome } from "./types.js";
import { extractColumnRefs, identifyTableRefs } from "../sql/tokenize.js";
import type { ColumnRef } from "../sql/types.js";

const MIN_LEVENSHTEIN = 3;

interface VerifySqlInput {
  sql: string;
  schemas: TableSchema[];
  result?: QueryResultData;
  allowNonSelect?: boolean;
  maxRowsWarning?: number;
}

// eslint-disable-next-line @typescript-eslint/require-await -- async signature is part of the public API contract for pipeline stages
export async function verifySql(input: VerifySqlInput): Promise<VerificationOutcome> {
  const hardFailures: string[] = [];
  const warnings: string[] = [];

  if (!input.allowNonSelect && !/^\s*select/i.test(input.sql.trim())) {
    hardFailures.push("Only SELECT statements are allowed.");
  }

  const refs = extractColumnRefs(input.sql);
  const tableRefs = identifyTableRefs(input.sql);
  const tables = new Map<string, Set<string>>();
  for (const s of input.schemas) {
    tables.set(s.name.toLowerCase(), new Set(s.columns.map((c) => c.name.toLowerCase())));
  }

  if (hardFailures.length === 0 && refs.length > 0) {
    hardFailures.push(...verifyReferences(refs, tableRefs, tables));
  }

  if (input.result) {
    if (input.result.rows.length === 0) {
      warnings.push("No rows returned. The filter may be too restrictive.");
    }
    const limit = input.maxRowsWarning ?? 500;
    if (input.result.rows.length > limit) {
      warnings.push(
        `Returned ${input.result.rows.length.toLocaleString("en-US")} rows. Consider aggregating or limiting.`
      );
    }
    const allNullCols = input.result.columns.filter((col) =>
      input.result!.rows.length > 0 &&
      input.result!.rows.every((r) => r[col] == null)
    );
    for (const col of allNullCols) {
      warnings.push(`All values in column "${col}" are NULL.`);
    }
  }

  const status: VerificationOutcome["status"] =
    hardFailures.length > 0 ? "failed" : warnings.length > 0 ? "warning" : "passed";

  return { status, hardFailures, warnings, columnRefs: refs };
}

function verifyReferences(
  refs: ColumnRef[],
  tableRefs: Set<string>,
  tables: Map<string, Set<string>>
): string[] {
  const failures: string[] = [];
  for (const ref of refs) {
    if (ref.column === "*") continue;
    if (ref.table) {
      const result = matchQualifiedColumn(ref, tables);
      if (!result.ok) failures.push(result.message);
      continue;
    }
    const result = matchUnqualifiedRef(ref, tableRefs, tables);
    if (!result.ok) failures.push(result.message);
  }
  return failures;
}

function matchQualifiedColumn(
  ref: { table?: string; column: string },
  tables: Map<string, Set<string>>
): MatchResult {
  if (!ref.table) return { ok: true };
  const tableLower = ref.table.toLowerCase();
  const cols = tables.get(tableLower);
  if (!cols) {
    return {
      ok: false,
      message: `Table "${ref.table}" does not exist. Available tables: ${[...tables.keys()].join(", ")}.`,
    };
  }
  if (!cols.has(ref.column.toLowerCase())) {
    const suggestion = suggestClose(ref.column, [...cols]);
    return {
      ok: false,
      message: `Column "${ref.column}" does not exist in table "${ref.table}".${suggestion ? ` Did you mean "${suggestion}"?` : ""}`,
    };
  }
  return { ok: true };
}

function matchUnqualifiedRef(
  ref: { column: string },
  tableRefs: Set<string>,
  tables: Map<string, Set<string>>
): MatchResult {
  const colLower = ref.column.toLowerCase();
  if (tableRefs.has(colLower)) {
    if (tables.has(colLower)) return { ok: true };
    const tableSuggestion = suggestClose(ref.column, [...tables.keys()]);
    return {
      ok: false,
      message: `Table "${ref.column}" does not exist.${tableSuggestion ? ` Did you mean "${tableSuggestion}"?` : ` Available tables: ${[...tables.keys()].join(", ")}.`}`,
    };
  }
  let found = false;
  for (const [, cols] of tables) {
    if (cols.has(colLower)) {
      found = true;
      break;
    }
  }
  if (!found) {
    const allCols = [...tables.values()].flatMap((set) => [...set]);
    const suggestion = suggestClose(ref.column, allCols);
    return {
      ok: false,
      message: `Column "${ref.column}" does not exist.${suggestion ? ` Did you mean "${suggestion}"?` : ""}`,
    };
  }
  return { ok: true };
}

type MatchResult = { ok: true } | { ok: false; message: string };

function suggestClose(target: string, candidates: string[]): string | null {
  const targetLower = target.toLowerCase();
  let best: string | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = levenshtein(targetLower, c.toLowerCase());
    if (d < bestDist && d <= MIN_LEVENSHTEIN) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[m]![n]!;
}
