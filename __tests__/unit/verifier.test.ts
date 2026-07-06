import { describe, it, expect } from "vitest";
import { verifySql } from "../../src/pipeline/verifier.js";
import type { TableSchema } from "../../src/sql/types.js";

const schemas: TableSchema[] = [
  {
    name: "customers",
    columns: [
      { name: "id", type: "INTEGER" },
      { name: "name", type: "STRING" },
      { name: "region", type: "STRING" },
    ],
  },
  {
    name: "orders",
    columns: [
      { name: "id", type: "INTEGER" },
      { name: "customer_id", type: "INTEGER" },
      { name: "revenue", type: "FLOAT" },
    ],
  },
];

describe("verifySql", () => {
  it("passes for valid SQL", async () => {
    const v = await verifySql({
      sql: "SELECT name FROM customers",
      schemas,
    });
    expect(v.status).toBe("passed");
    expect(v.hardFailures).toEqual([]);
  });

  it("fails for unknown table", async () => {
    const v = await verifySql({
      sql: "SELECT * FROM customres",
      schemas,
    });
    expect(v.status).toBe("failed");
    expect(v.hardFailures[0]).toContain("Table \"customres\"");
  });

  it("fails for unknown column", async () => {
    const v = await verifySql({
      sql: "SELECT revenu FROM orders",
      schemas,
    });
    expect(v.status).toBe("failed");
    expect(v.hardFailures[0]).toContain("Column \"revenu\"");
  });

  it("suggests near-match columns", async () => {
    const v = await verifySql({
      sql: "SELECT revenu FROM orders",
      schemas,
    });
    expect(v.hardFailures[0]).toContain("revenue");
  });

  it("fails for non-SELECT statements", async () => {
    const v = await verifySql({
      sql: "DELETE FROM customers",
      schemas,
      allowNonSelect: false,
    });
    expect(v.status).toBe("failed");
    expect(v.hardFailures[0]).toContain("SELECT");
  });

  it("allows non-SELECT when allowNonSelect=true", async () => {
    const v = await verifySql({
      sql: "DELETE FROM customers",
      schemas,
      allowNonSelect: true,
    });
    expect(v.status).toBe("passed");
  });

  it("does not hard-fail on unparseable subqueries", async () => {
    const v = await verifySql({
      sql: "SELECT * FROM (SELECT id FROM customers)",
      schemas,
    });
    expect(v.status).not.toBe("failed");
  });
});

describe("verifySql advisory checks", () => {
  it("warns on zero rows", async () => {
    const v = await verifySql({
      sql: "SELECT name FROM customers",
      schemas,
      result: { columns: ["name"], rows: [] },
    });
    expect(v.warnings).toContain("No rows returned. The filter may be too restrictive.");
  });

  it("warns on high row count", async () => {
    const v = await verifySql({
      sql: "SELECT * FROM customers",
      schemas,
      result: { columns: ["id"], rows: Array.from({ length: 600 }, () => ({ id: 1 })) },
      maxRowsWarning: 500,
    });
    expect(v.warnings.some((w) => w.includes("Consider aggregating"))).toBe(true);
  });

  it("warns on all-null column", async () => {
    const v = await verifySql({
      sql: "SELECT name FROM customers",
      schemas,
      result: { columns: ["name"], rows: [{ name: null }, { name: null }] },
    });
    expect(v.warnings.some((w) => w.includes("NULL"))).toBe(true);
  });
});
