import { describe, it, expect } from "vitest";
import { extractColumnRefs } from "../../src/sql/tokenize.js";

describe("extractColumnRefs", () => {
  it("extracts columns from simple SELECT", () => {
    const refs = extractColumnRefs("SELECT name, revenue FROM customers");
    expect(refs).toEqual([
      { table: undefined, column: "name" },
      { table: undefined, column: "revenue" },
      { table: undefined, column: "customers" },
    ]);
  });

  it("extracts qualified columns", () => {
    const refs = extractColumnRefs("SELECT c.name FROM customers c");
    expect(refs).toContainEqual({ table: "c", column: "name" });
    expect(refs).toContainEqual({ table: undefined, column: "customers" });
  });

  it("extracts JOIN columns", () => {
    const refs = extractColumnRefs(
      "SELECT a.id FROM orders a JOIN customers b ON a.customer_id = b.id"
    );
    expect(refs).toContainEqual({ table: "a", column: "id" });
    expect(refs).toContainEqual({ table: "a", column: "customer_id" });
    expect(refs).toContainEqual({ table: "b", column: "id" });
  });

  it("extracts WHERE columns", () => {
    const refs = extractColumnRefs("SELECT * FROM orders WHERE region = 'North'");
    expect(refs).toContainEqual({ table: undefined, column: "region" });
  });

  it("extracts GROUP BY columns", () => {
    const refs = extractColumnRefs("SELECT region, COUNT(*) FROM orders GROUP BY region");
    expect(refs.filter((r) => r.column === "region").length).toBeGreaterThanOrEqual(1);
  });

  it("extracts ORDER BY columns", () => {
    const refs = extractColumnRefs("SELECT * FROM orders ORDER BY created_at DESC");
    expect(refs).toContainEqual({ table: undefined, column: "created_at" });
  });

  it("lowercases column names", () => {
    const refs = extractColumnRefs("SELECT Name FROM Customers");
    expect(refs).toContainEqual({ table: undefined, column: "name" });
  });

  it("handles star (SELECT *)", () => {
    const refs = extractColumnRefs("SELECT * FROM customers");
    expect(refs).toContainEqual({ table: undefined, column: "*" });
    expect(refs).toContainEqual({ table: undefined, column: "customers" });
  });

  it("handles subqueries without throwing", () => {
    const refs = extractColumnRefs(
      "SELECT * FROM (SELECT id FROM customers) sub"
    );
    expect(refs).toContainEqual({ table: undefined, column: "id" });
    expect(refs).toContainEqual({ table: undefined, column: "customers" });
  });

  it("returns empty for non-SELECT statements", () => {
    const refs = extractColumnRefs("INSERT INTO customers VALUES (1)");
    expect(refs).toEqual([]);
  });

  it("ignores string literals", () => {
    const refs = extractColumnRefs("SELECT 'literal_string' FROM customers");
    expect(refs).not.toContainEqual({ table: undefined, column: "literal_string" });
  });

  it("strips brackets from identifiers", () => {
    const refs = extractColumnRefs("SELECT [name] FROM [customers]");
    expect(refs).toContainEqual({ table: undefined, column: "name" });
    expect(refs).toContainEqual({ table: undefined, column: "customers" });
  });
});
