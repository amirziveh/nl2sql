import type {
  SqlProvider,
  TableSchema,
  QueryResultData,
  ColumnSchema,
  AlaSqlProviderInput,
} from "./types.js";

interface AlaSqlModule {
  (sql: string, params?: unknown[]): unknown;
  autoval: unknown;
}

let alaSqlPromise: Promise<AlaSqlModule> | null = null;

/**
 * Tracks which (tableName, dataSignature) pairs have already been registered
 * with the alasql engine. The alasql module is a process-wide singleton, so
 * without this guard, repeated `CREATE TABLE` calls across provider instances
 * fail with "table already exists". We key on the data signature so a provider
 * constructed with different rows for the same table name still re-registers.
 */
const registeredTables = new Map<string, string>();

async function loadAlaSql(): Promise<AlaSqlModule> {
  if (!alaSqlPromise) {
    alaSqlPromise = import("alasql").then((mod: unknown) => {
      const alaSql =
        (mod as { default: AlaSqlModule }).default ?? (mod as AlaSqlModule);
      return alaSql;
    });
  }
  return alaSqlPromise;
}

export function createAlaSqlProvider(input: AlaSqlProviderInput): SqlProvider {
  let initialized = false;

  async function ensureLoaded(): Promise<AlaSqlModule> {
    const alasql = await loadAlaSql();
    if (!initialized) {
      for (const [tableName, rows] of Object.entries(input.tables)) {
        const signature = JSON.stringify(rows);
        if (registeredTables.get(tableName) === signature) {
          // Already registered with identical data; skip.
          continue;
        }
        // Best-effort cleanup of any prior registration with different data.
        try {
          alasql(`DROP TABLE IF EXISTS [${tableName}];`);
        } catch {
          /* ignore - table may not exist yet */
        }
        if (rows.length > 0) {
          const columns = Object.keys(rows[0]!);
          const colDefs = columns.map((c) => `[${c}]`).join(", ");
          alasql(`CREATE TABLE [${tableName}] (${colDefs});`);
          for (const row of rows) {
            const placeholders = columns.map(() => "?").join(", ");
            alasql(
              `INSERT INTO [${tableName}] VALUES (${placeholders});`,
              columns.map((c) => row[c])
            );
          }
        } else {
          alasql(`CREATE TABLE [${tableName}];`);
        }
        registeredTables.set(tableName, signature);
      }
      initialized = true;
    }
    return alasql;
  }

  function inferColumns(rows: Record<string, unknown>[]): ColumnSchema[] {
    if (rows.length === 0) return [];
    const sample = rows[0]!;
    return Object.keys(sample).map((name) => {
      const val = sample[name];
      let type = "STRING";
      if (typeof val === "number") type = Number.isInteger(val) ? "INTEGER" : "FLOAT";
      else if (typeof val === "boolean") type = "BOOLEAN";
      else if (val instanceof Date) type = "DATETIME";
      return { name, type };
    });
  }

  return {
    async listSchemas(): Promise<TableSchema[]> {
      await ensureLoaded();
      return Object.entries(input.tables).map(([name, rows]) => ({
        name,
        columns: inferColumns(rows),
        rowCount: rows.length,
      }));
    },

    // eslint-disable-next-line @typescript-eslint/require-await -- async signature is part of the SqlProvider contract
    async getSchema(name: string): Promise<TableSchema> {
      const rows = input.tables[name];
      if (!rows) {
        throw new Error(
          `Table "${name}" not found. Available: ${Object.keys(input.tables).join(", ")}`
        );
      }
      return {
        name,
        columns: inferColumns(rows),
        rowCount: rows.length,
      };
    },

    // eslint-disable-next-line @typescript-eslint/require-await -- async signature is part of the SqlProvider contract
    async getSamples(
      name: string,
      limit: number
    ): Promise<Record<string, unknown>[]> {
      const rows = input.tables[name] ?? [];
      return rows.slice(0, limit);
    },

    async execute(sql: string): Promise<QueryResultData> {
      const alasql = await ensureLoaded();
      try {
        const result = alasql(sql) as Record<string, unknown>[] | undefined;
        if (!result || result.length === 0) {
          return { columns: [], rows: [] };
        }
        const columns = Object.keys(result[0]!);
        return { columns, rows: result };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { columns: [], rows: [], error: message };
      }
    },
  };
}
