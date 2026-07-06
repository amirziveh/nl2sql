# Custom providers

`nl2sql-agent` exposes two seams: `LlmProvider` and `SqlProvider`. Implement either to use any backend.

## Custom LlmProvider

```ts
import type { LlmProvider } from "nl2sql";

const myProvider: LlmProvider = {
  async chat({ messages, tools }) {
    const response = await myLlm.chat({ messages, tools });
    return {
      role: "assistant",
      content: response.content,
      toolCalls: response.toolCalls,
    };
  },
};
```

## Custom SqlProvider

```ts
import type { SqlProvider } from "nl2sql";

const postgresProvider: SqlProvider = {
  async listSchemas() {
    const res = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    return res.rows.map((r) => ({ name: r.table_name, columns: [] }));
  },
  async getSchema(name) {
    const res = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = $1
    `, [name]);
    return {
      name,
      columns: res.rows.map((r) => ({ name: r.column_name, type: r.data_type })),
    };
  },
  async getSamples(name, limit) {
    const res = await client.query(`SELECT * FROM ${name} LIMIT $1`, [limit]);
    return res.rows;
  },
  async execute(sql) {
    try {
      const res = await client.query(sql);
      return { columns: res.fields.map((f) => f.name), rows: res.rows };
    } catch (e) {
      return { columns: [], rows: [], error: e.message };
    }
  },
};
```
