import { Nl2SqlAgent, createOpenAiProvider, createStaticSqlProvider } from "nl2sql";
import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("Set OPENAI_API_KEY env var first.");
  process.exit(1);
}

const schemas = [
  {
    name: "users",
    columns: [
      { name: "id", type: "INTEGER" },
      { name: "name", type: "STRING" },
      { name: "active", type: "BOOLEAN" },
    ],
  },
];

const rows = [
  { id: 1, name: "Alice", active: true },
  { id: 2, name: "Bob", active: true },
  { id: 3, name: "Carol", active: false },
];

async function executeSQL(sql) {
  const trimmed = sql.trim().toLowerCase();
  if (trimmed.includes("count")) {
    return { columns: ["n"], rows: [{ n: rows.length }] };
  }
  if (trimmed.includes("where")) {
    const filtered = rows.filter((r) => r.active);
    return { columns: ["id", "name"], rows: filtered.map(({ id, name }) => ({ id, name })) };
  }
  return {
    columns: ["id", "name", "active"],
    rows,
  };
}

const agent = new Nl2SqlAgent({
  provider: createOpenAiProvider(new OpenAI({ apiKey }), {
    model: "gpt-4o-mini",
    temperature: 0,
  }),
  maxSteps: 10,
});

const result = await agent.query("How many users are there?", {
  sqlProvider: createStaticSqlProvider({ schemas, executeSQL }),
});

console.log("Answer:", result.answer);
console.log("SQL:", result.sql);
console.log("Steps:", result.steps.length);
