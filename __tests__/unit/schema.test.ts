import { describe, it, expect } from "vitest";
import { buildSchemaDescription, buildSchemaWithSamples } from "../../src/schema/describe.js";
import { buildRelationshipHints } from "../../src/schema/relationships.js";
import type { TableSchema } from "../../src/sql/types.js";

const customers: TableSchema = {
  name: "customers",
  columns: [
    { name: "id", type: "INTEGER" },
    { name: "name", type: "STRING" },
    { name: "region", type: "STRING" },
  ],
  rowCount: 1240,
};

const orders: TableSchema = {
  name: "orders",
  columns: [
    { name: "id", type: "INTEGER" },
    { name: "customer_id", type: "INTEGER" },
  ],
  rowCount: 5300,
};

describe("buildSchemaDescription", () => {
  it("formats a single table", () => {
    const out = buildSchemaDescription([customers]);
    expect(out).toContain("TABLE [customers] (1,240 rows)");
    expect(out).toContain("- id (INTEGER)");
    expect(out).toContain("- name (STRING)");
  });

  it("formats multiple tables", () => {
    const out = buildSchemaDescription([customers, orders]);
    expect(out).toContain("TABLE [customers]");
    expect(out).toContain("TABLE [orders]");
  });

  it("omits rowCount when not provided", () => {
    const out = buildSchemaDescription([{ name: "t", columns: [] }]);
    expect(out).not.toContain("rows)");
  });
});

describe("buildSchemaWithSamples", () => {
  it("appends sample rows", () => {
    const out = buildSchemaWithSamples([customers], {
      customers: [{ id: 1, name: "Acme", region: "North" }],
    });
    expect(out).toContain("Sample rows from [customers]:");
    expect(out).toContain('"name":"Acme"');
  });

  it("handles empty samples", () => {
    const out = buildSchemaWithSamples([customers], {});
    expect(out).toContain("TABLE [customers]");
    expect(out).not.toContain("Sample rows");
  });

  it("caps samples at 3 rows", () => {
    const out = buildSchemaWithSamples([customers], {
      customers: [
        { id: 1, name: "A" },
        { id: 2, name: "B" },
        { id: 3, name: "C" },
        { id: 4, name: "D" },
      ],
    });
    expect(out.match(/"id":\d/g)?.length).toBe(3);
  });
});

describe("buildRelationshipHints", () => {
  it("detects shared columns", () => {
    const out = buildRelationshipHints([customers, orders]);
    expect(out).toContain("[customers] and [orders] share columns: id");
  });

  it("returns empty when no shared columns", () => {
    const out = buildRelationshipHints([
      { name: "a", columns: [{ name: "x", type: "INT" }] },
      { name: "b", columns: [{ name: "y", type: "INT" }] },
    ]);
    expect(out.trim()).toBe("");
  });

  it("includes scenario hints", () => {
    const out = buildRelationshipHints([customers], "Manual hint: customers are regional.");
    expect(out).toContain("Manual hint: customers are regional.");
  });
});
