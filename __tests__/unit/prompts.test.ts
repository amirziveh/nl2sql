import { describe, it, expect } from "vitest";
import { roleSection, capabilitiesSection, schemaSection, workflowSection, outputSection, instructionsSection } from "../../src/prompts/sections.js";
import { buildSystemPrompt } from "../../src/prompts/system-prompt.js";
import { RUN_SQL_TOOL, FINISH_TOOL } from "../../src/prompts/tools.js";
import type { TableSchema } from "../../src/sql/types.js";

const schemas: TableSchema[] = [
  { name: "orders", columns: [{ name: "id", type: "INT" }, { name: "revenue", type: "FLOAT" }] },
];

describe("sections", () => {
  it("roleSection describes the assistant", () => {
    expect(roleSection()).toContain("NL2SQL");
    expect(roleSection()).toContain("SQL");
  });

  it("capabilitiesSection mentions identifier bracketing", () => {
    expect(capabilitiesSection()).toContain("bracketed identifiers");
  });

  it("schemaSection includes the table", () => {
    const s = schemaSection({ schemas, samples: undefined, relationships: undefined });
    expect(s).toContain("TABLE [orders]");
    expect(s).toContain("revenue");
  });

  it("workflowSection mentions plan/query/verify/answer", () => {
    const w = workflowSection({ requireSqlBeforeFinish: true });
    expect(w).toContain("plan");
    expect(w).toContain("run_sql");
    expect(w).toContain("finish");
  });

  it("outputSection includes English defaults", () => {
    expect(outputSection({ language: "en" })).toContain("English");
  });

  it("instructionsSection passes through custom instructions", () => {
    expect(instructionsSection("Custom: always cite sources.")).toContain("cite sources");
  });
});

describe("buildSystemPrompt", () => {
  it("assembles all sections", () => {
    const p = buildSystemPrompt({
      schemas,
      dialectHints: {},
      language: "en",
    });
    expect(p).toContain("NL2SQL");
    expect(p).toContain("TABLE [orders]");
    expect(p).toContain("run_sql");
  });

  it("includes samples when provided", () => {
    const p = buildSystemPrompt({
      schemas,
      dialectHints: {},
      language: "en",
      samples: { orders: [{ id: 1, revenue: 100 }] },
    });
    expect(p).toContain("Sample rows");
  });
});

describe("tools", () => {
  it("run_sql tool has correct shape", () => {
    expect(RUN_SQL_TOOL.name).toBe("run_sql");
    expect(RUN_SQL_TOOL.parameters).toMatchObject({
      type: "object",
      properties: { sql: {}, purpose: {}, explanation: {} },
      required: ["sql", "purpose", "explanation"],
    });
  });

  it("finish tool has correct shape", () => {
    expect(FINISH_TOOL.name).toBe("finish");
    expect(FINISH_TOOL.parameters).toMatchObject({
      type: "object",
      properties: { answer: {}, sql: {}, explanation: {} },
      required: ["answer", "sql", "explanation"],
    });
  });
});
