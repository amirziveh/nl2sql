# Getting started with nl2sql-agent

## Install

```bash
npm install nl2sql openai
```

## Create your first agent

```ts
import { Nl2SqlAgent, createOpenAiProvider, createStaticSqlProvider } from "nl2sql";
import OpenAI from "openai";

const agent = new Nl2SqlAgent({
  provider: createOpenAiProvider(
    new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }),
    { model: "gpt-4o-mini" }
  ),
});

const result = await agent.query("How many active users?", {
  sqlProvider: createStaticSqlProvider({
    schemas: [{ name: "users", columns: [{ name: "active", type: "BOOLEAN" }] }],
    executeSQL: async (sql) => db.exec(sql),
  }),
});
```

## Inspect the steps

Each `QueryResult` contains `steps` — one entry per `run_sql` call:

```ts
for (const step of result.steps) {
  console.log(step.sql);
  console.log(step.verification.status);
  console.log(step.result.rows);
}
```

## Cancel mid-flight

```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);

const result = await agent.query(q, ctx, { signal: controller.signal });
```

## Streaming progress

```ts
await agent.query(q, ctx, {
  onStep: (step) => ui.addStep(step),
  onAnswer: (answer) => ui.setAnswer(answer),
});
```
