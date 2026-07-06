import type { TableSchema } from "../sql/types.js";

export function buildSchemaDescription(schemas: TableSchema[]): string {
  return schemas.map(formatTable).join("\n\n");
}

function formatTable(s: TableSchema): string {
  const header = s.rowCount != null
    ? `TABLE [${s.name}] (${s.rowCount.toLocaleString("en-US")} rows)`
    : `TABLE [${s.name}]`;
  const cols = s.columns.map((c) => `  - ${c.name} (${c.type})`).join("\n");
  return `${header}\nColumns:\n${cols}`;
}

export function buildSchemaWithSamples(
  schemas: TableSchema[],
  samples: Record<string, Record<string, unknown>[]>
): string {
  const base = buildSchemaDescription(schemas);
  const samplesBlock = schemas
    .filter((s) => samples[s.name] && samples[s.name]!.length > 0)
    .map((s) => {
      const rows = samples[s.name]!.slice(0, 3);
      const body = rows.map((r) => JSON.stringify(r)).join("\n");
      return `Sample rows from [${s.name}]:\n${body}`;
    })
    .join("\n\n");
  return samplesBlock ? `${base}\n\n${samplesBlock}` : base;
}
