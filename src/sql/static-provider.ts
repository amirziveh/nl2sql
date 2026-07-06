import type {
  SqlProvider,
  StaticSqlProviderInput,
  TableSchema,
  QueryResultData,
} from "./types.js";

export function createStaticSqlProvider(
  input: StaticSqlProviderInput
): SqlProvider {
  const schemaMap = new Map<string, TableSchema>();
  for (const s of input.schemas) schemaMap.set(s.name.toLowerCase(), s);

  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- async signature is part of the SqlProvider contract
    async listSchemas(): Promise<TableSchema[]> {
      return input.schemas;
    },

    // eslint-disable-next-line @typescript-eslint/require-await -- async signature is part of the SqlProvider contract
    async getSchema(name: string): Promise<TableSchema> {
      const s = schemaMap.get(name.toLowerCase());
      if (!s) {
        throw new Error(
          `Schema "${name}" not found. Available: ${input.schemas
            .map((schema) => schema.name)
            .join(", ")}`
        );
      }
      return s;
    },

    // eslint-disable-next-line @typescript-eslint/require-await -- async signature is part of the SqlProvider contract
    async getSamples(
      name: string,
      limit: number
    ): Promise<Record<string, unknown>[]> {
      const rows = input.samples?.[name] ?? [];
      return rows.slice(0, limit);
    },

    async execute(sql: string): Promise<QueryResultData> {
      return input.executeSQL(sql);
    },
  };
}
