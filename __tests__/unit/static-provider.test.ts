/* eslint-disable @typescript-eslint/require-await -- mock executeSQL stubs return synchronously */
import { describe, it, expect } from "vitest";
import { createStaticSqlProvider } from "../../src/sql/static-provider.js";
import type { TableSchema } from "../../src/sql/types.js";

const schemas: TableSchema[] = [
  { name: "customers", columns: [{ name: "id", type: "INT" }] },
];

describe("createStaticSqlProvider", () => {
  it("returns schemas from listSchemas", async () => {
    const provider = createStaticSqlProvider({
      schemas,
      executeSQL: async () => ({ columns: [], rows: [] }),
    });
    const result = await provider.listSchemas();
    expect(result).toEqual(schemas);
  });

  it("returns a table by name from getSchema", async () => {
    const provider = createStaticSqlProvider({
      schemas,
      executeSQL: async () => ({ columns: [], rows: [] }),
    });
    const t = await provider.getSchema("customers");
    expect(t).toEqual(schemas[0]);
  });

  it("throws on unknown schema in getSchema", async () => {
    const provider = createStaticSqlProvider({
      schemas,
      executeSQL: async () => ({ columns: [], rows: [] }),
    });
    await expect(provider.getSchema("nonexistent")).rejects.toThrow();
  });

  it("returns samples when provided", async () => {
    const provider = createStaticSqlProvider({
      schemas,
      executeSQL: async () => ({ columns: [], rows: [] }),
      samples: { customers: [{ id: 1 }, { id: 2 }] },
    });
    const s = await provider.getSamples("customers", 10);
    expect(s).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("returns [] when no samples provided", async () => {
    const provider = createStaticSqlProvider({
      schemas,
      executeSQL: async () => ({ columns: [], rows: [] }),
    });
    const s = await provider.getSamples("customers", 10);
    expect(s).toEqual([]);
  });

  it("respects limit on samples", async () => {
    const provider = createStaticSqlProvider({
      schemas,
      executeSQL: async () => ({ columns: [], rows: [] }),
      samples: { customers: [{ id: 1 }, { id: 2 }, { id: 3 }] },
    });
    const s = await provider.getSamples("customers", 2);
    expect(s.length).toBe(2);
  });

  it("delegates execute to injected executeSQL", async () => {
    const calls: string[] = [];
    const provider = createStaticSqlProvider({
      schemas,
      executeSQL: async (sql) => {
        calls.push(sql);
        return { columns: ["x"], rows: [{ x: 1 }] };
      },
    });
    const result = await provider.execute("SELECT x FROM y");
    expect(calls).toEqual(["SELECT x FROM y"]);
    expect(result).toEqual({ columns: ["x"], rows: [{ x: 1 }] });
  });

  it("returns empty samples for unknown table", async () => {
    const provider = createStaticSqlProvider({
      schemas,
      executeSQL: async () => ({ columns: [], rows: [] }),
    });
    const s = await provider.getSamples("nonexistent", 10);
    expect(s).toEqual([]);
  });
});
