import type { TableSchema } from "../sql/types.js";
import {
  roleSection,
  capabilitiesSection,
  schemaSection,
  workflowSection,
  outputSection,
  instructionsSection,
} from "./sections.js";

interface PromptContext {
  schemas: TableSchema[];
  samples?: Record<string, Record<string, unknown>[]>;
  relationships?: string;
  dialectHints?: Record<string, unknown>;
  language: string;
  instructions?: string;
  requireSqlBeforeFinish?: boolean;
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const requireSql = ctx.requireSqlBeforeFinish ?? true;
  const sections: string[] = [
    roleSection(),
    capabilitiesSection(),
    schemaSection({
      schemas: ctx.schemas,
      samples: ctx.samples,
      relationships: ctx.relationships,
    }),
    workflowSection({ requireSqlBeforeFinish: requireSql }),
    outputSection({ language: ctx.language }),
  ];
  if (ctx.instructions) {
    sections.push(instructionsSection(ctx.instructions));
  }
  return sections.join("\n\n\n");
}
