import type { TableSchema } from "../sql/types.js";

export function buildRelationshipHints(
  schemas: TableSchema[],
  scenarioHints?: string
): string {
  const parts: string[] = [];

  for (let i = 0; i < schemas.length; i++) {
    for (let j = i + 1; j < schemas.length; j++) {
      const a = schemas[i]!;
      const b = schemas[j]!;
      const aCols = new Set(a.columns.map((c) => c.name.toLowerCase()));
      const common = b.columns
        .map((c) => c.name.toLowerCase())
        .filter((name) => aCols.has(name));
      if (common.length > 0) {
        parts.push(
          `- [${a.name}] and [${b.name}] share columns: ${common.join(", ")} — likely JOIN key`
        );
      }
    }
  }

  if (scenarioHints && scenarioHints.trim()) {
    parts.push(scenarioHints.trim());
  }

  return parts.join("\n");
}
