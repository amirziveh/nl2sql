import { describe, it, expect } from "vitest";
import { formatResultForLLM } from "../../src/pipeline/result-formatter.js";
import type { QueryResultData } from "../../src/sql/types.js";

describe("formatResultForLLM", () => {
  it("formats columns + row count", () => {
    const r: QueryResultData = {
      columns: ["id", "name"],
      rows: [{ id: 1, name: "A" }],
    };
    const out = formatResultForLLM(r);
    expect(out).toContain("columns: id, name");
    expect(out).toContain("rows returned: 1");
  });

  it("adds numeric aggregates", () => {
    const r: QueryResultData = {
      columns: ["revenue"],
      rows: [{ revenue: 100 }, { revenue: 200 }],
    };
    const out = formatResultForLLM(r);
    expect(out).toContain("revenue: sum=300");
    expect(out).toContain("avg=150");
    expect(out).toContain("min=100");
    expect(out).toContain("max=200");
  });

  it("caps row preview at 20", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: i }));
    const r: QueryResultData = { columns: ["id"], rows };
    const out = formatResultForLLM(r);
    expect(out).toContain("First 20 rows:");
    expect(out.match(/"id":\d+/g)?.length).toBe(20);
  });

  it("handles empty result", () => {
    const r: QueryResultData = { columns: [], rows: [] };
    const out = formatResultForLLM(r);
    expect(out).toContain("rows returned: 0");
  });

  it("includes error when present", () => {
    const r: QueryResultData = { columns: [], rows: [], error: "bad col" };
    const out = formatResultForLLM(r);
    expect(out).toContain("error: bad col");
  });

  it("ignores non-numeric columns for aggregates", () => {
    const r: QueryResultData = {
      columns: ["name"],
      rows: [{ name: "A" }, { name: "B" }],
    };
    const out = formatResultForLLM(r);
    expect(out).not.toContain("numeric aggregates");
  });
});
