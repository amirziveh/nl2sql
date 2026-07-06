export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  rowCount?: number;
}

export interface ColumnSchema {
  name: string;
  type: string;
  description?: string;
}

export interface QueryResultData {
  columns: string[];
  rows: Record<string, unknown>[];
  error?: string;
}

export interface SqlProvider {
  listSchemas(): Promise<TableSchema[]>;
  getSchema(name: string): Promise<TableSchema>;
  getSamples(name: string, limit: number): Promise<Record<string, unknown>[]>;
  execute(sql: string): Promise<QueryResultData>;
}

export interface StaticSqlProviderInput {
  schemas: TableSchema[];
  executeSQL: (sql: string) => Promise<QueryResultData>;
  samples?: Record<string, Record<string, unknown>[]>;
  relationships?: string;
}

export interface AlaSqlProviderInput {
  tables: Record<string, Record<string, unknown>[]>;
}

export interface ColumnRef {
  table?: string;
  column: string;
}
