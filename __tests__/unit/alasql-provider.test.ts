import { describe, it, expect } from "vitest";
import { createAlaSqlProvider } from "../../src/sql/alasql-provider.js";

const tables = {
  customers: [
    { id: 1, name: "Acme", region: "North" },
    { id: 2, name: "Globex", region: "South" },
    { id: 3, name: "Initech", region: "North" },
  ],
  orders: [
    { id: 100, customer_id: 1, revenue: 500 },
    { id: 101, customer_id: 2, revenue: 1000 },
    { id: 102, customer_id: 1, revenue: 200 },
  ],
};

describe("createAlaSqlProvider", () => {
  it("lists schemas from tables", async () => {
    const p = createAlaSqlProvider({ tables });
    const schemas = await p.listSchemas();
    const names = schemas.map((s) => s.name).sort();
    expect(names).toEqual(["customers", "orders"]);
  });

  it("gets schema for a specific table", async () => {
    const p = createAlaSqlProvider({ tables });
    const s = await p.getSchema("customers");
    expect(s.name).toBe("customers");
    const colNames = s.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("name");
    expect(colNames).toContain("region");
  });

  it("reports rowCount", async () => {
    const p = createAlaSqlProvider({ tables });
    const s = await p.getSchema("customers");
    expect(s.rowCount).toBe(3);
  });

  it("returns sample rows", async () => {
    const p = createAlaSqlProvider({ tables });
    const rows = await p.getSamples("customers", 2);
    expect(rows.length).toBe(2);
    expect(rows[0]).toMatchObject({ id: 1 });
  });

  it("executes SELECT and returns rows", async () => {
    const p = createAlaSqlProvider({ tables });
    const r = await p.execute("SELECT COUNT(*) AS n FROM customers");
    expect(r.rows[0]?.n).toBe(3);
  });

  it("handles SQL execution errors gracefully", async () => {
    const p = createAlaSqlProvider({ tables });
    const r = await p.execute("SELECT * FROM nonexistent_table");
    expect(r.error).toBeTruthy();
  });

  it("handles WHERE clause", async () => {
    const p = createAlaSqlProvider({ tables });
    const r = await p.execute("SELECT id FROM customers WHERE region = 'North'");
    expect(r.rows.length).toBe(2);
  });
});
