import type { QueryResultData } from "../sql/types.js";

const PREVIEW_LIMIT = 200;

export function formatResultForLLM(result: QueryResultData): string {
  if (result.error) {
    return `error: ${result.error}`;
  }

  const { columns, rows } = result;
  let text = `columns: ${columns.join(", ")}\nrows returned: ${rows.length}`;

  const aggregates = computeAggregates(columns, rows);
  if (aggregates.length > 0) {
    text += `\nnumeric aggregates:\n${aggregates.join("\n")}`;
  }

  if (rows.length > 0) {
    const preview = rows.slice(0, PREVIEW_LIMIT);
    const truncated = rows.length > preview.length;
    text += `\nShowing ${preview.length} of ${rows.length} rows${truncated ? " (truncated — you have enough data, do NOT query for the remaining rows)" : ""}:\n${preview.map((r) => JSON.stringify(r)).join("\n")}`;
  }

  return text;
}

function computeAggregates(
  columns: string[],
  rows: Record<string, unknown>[]
): string[] {
  const out: string[] = [];
  for (const col of columns) {
    const values = rows
      .map((r) => r[col])
      .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
    if (values.length === 0) continue;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    out.push(
      `  ${col}: sum=${sum.toFixed(2)}, avg=${avg.toFixed(2)}, min=${min.toFixed(2)}, max=${max.toFixed(2)}`
    );
  }
  return out;
}
