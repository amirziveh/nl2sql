# nl2sql

> Browser-first TypeScript toolkit for converting natural-language questions to SQL via an LLM agent loop with verification layers.

## Why

Most NL2SQL libraries just translate a question to a single SQL string and call it done. Real users want **trustworthy answers**: the agent should plan, run queries, verify them, and iterate until the data actually answers the question. `nl2sql` packages that loop in a small, dependency-light, provider-agnostic library that works in the browser and Node.

- **Plan -> Query -> Verify -> Answer** loop powered by native LLM function-calling.
- **Streaming**: `onToken` callback streams answer tokens to the UI as they arrive.
- **Configurable SQL requirement**: `requireSqlBeforeFinish: false` lets the model answer greetings and non-data questions without running SQL.
- **Stuck detection**: after 3 consecutive query failures, the model is told to change approach or finish with what it has.
- **Duplicate query cache**: identical SQL is detected and cached — the model gets the cached result with a warning instead of re-executing.
- **Reserved-word sanitization**: `AS total` -> `AS [total]` automatically, preventing AlaSQL parse errors.
- **Layered verification**: hard checks (column/table existence), advisory warnings (zero rows, high row count, all-null columns).
- **Provider-agnostic**: ship your own `LlmProvider` (for any model) and `SqlProvider` (for any database). Reference OpenAI adapter included.
- **Browser-first**: works in Vite/Webpack/Next.js out of the box. No Node-only polyfills.
- **Cancellable**: pass an `AbortSignal` to bail out mid-flight.

## Install

```bash
npm install nl2sql openai
```

`openai` is a peer dependency when you use the bundled OpenAI adapter. If you implement your own `LlmProvider`, you don't need it.

## Quickstart

```ts
import { Nl2SqlAgent, createOpenAiProvider, createStaticSqlProvider } from "nl2sql";
import OpenAI from "openai";

const agent = new Nl2SqlAgent({
  provider: createOpenAiProvider(
    new OpenAI({ apiKey: process.env.OPENAI_API_KEY!, dangerouslyAllowBrowser: true }),
    { model: "gpt-4o-mini", temperature: 0.1 }
  ),
  language: "en",
  requireSqlBeforeFinish: true, // default; set false for conversational mode
});

const result = await agent.query("Top 5 customers by revenue last month", {
  sqlProvider: createStaticSqlProvider({
    schemas: [{ name: "orders", columns: [{ name: "customer", type: "STRING" }, { name: "revenue", type: "FLOAT" }, { name: "created_at", type: "DATETIME" }] }],
    executeSQL: async (sql) => myDb.exec(sql),
  }),
}, {
  onStep: (step) => console.log("ran:", step.sql),
  onToken: (token) => process.stdout.write(token), // streaming
  onAnswer: (answer) => console.log("done:", answer),
});

console.log(result.answer);
console.log(result.sql);
console.log(result.steps);
```

## Configuration

### `AgentConfig`

| Option | Type | Default | Description |
|---|---|---|---|
| `provider` | `LlmProvider` | required | LLM provider (use `createOpenAiProvider` or implement your own) |
| `language` | `string` | `"en"` | Locale code for output formatting (`"en"`, `"fa"`, etc.) |
| `maxSteps` | `number` | `20` | Maximum LLM round-trips before forcing a final answer |
| `requireSqlBeforeFinish` | `boolean` | `true` | When `false`, the model can answer non-data questions (greetings, thanks) without running SQL. The `finish` tool only requires `answer`, not `sql`/`explanation`. |
| `historyReducer` | `(messages, max) => messages` | `defaultHistoryReducer` | Trims conversation history to fit context windows |
| `sqlHints.maxRowsWarning` | `number` | `500` | Advisory warning threshold for large result sets |
| `sqlHints.allowNonSelect` | `boolean` | `false` | Allow INSERT/UPDATE/DELETE statements |

### `QueryCallbacks`

| Callback | Description |
|---|---|
| `onStep(step)` | Fired after each SQL query executes (includes sql, result, verification) |
| `onToken(token)` | Streams answer tokens as they arrive from the LLM |
| `onAnswer(answer)` | Fired when the model produces its final answer |
| `onFinalSQL(sql)` | Fired with the canonical SQL from the `finish` call |
| `signal` | `AbortSignal` to cancel mid-flight |

## How it works

1. The agent assembles a system prompt from composable sections (role, capabilities, schema, workflow, output rules, optional instructions).
2. It calls the LLM with two tools: `run_sql` and `finish`.
3. SQL is sanitized (`sanitizeReservedAliases`) and verified before execution: column references must match the schema (minimal SQL tokenizer + Levenshtein near-match).
4. Duplicate queries are detected via normalized SQL cache and return cached results.
5. After execution, advisory warnings are computed (zero rows, high row count, all-null columns) and attached to the tool result.
6. If 3 consecutive queries fail, a system message tells the model to change approach or finish.
7. The LLM may call `run_sql` again to verify, or call `finish` with the final answer.
8. Answer tokens stream to the UI via `onToken` as they arrive.

## Documentation

- [Getting started](./docs/getting-started.md)
- [Custom providers](./docs/custom-providers.md)
- [Browser security](./docs/browser-security.md)

## Examples

- [`examples/browser`](./examples/browser) — Vite + AlaSQL demo with OpenAI
- [`examples/node`](./examples/node) — Node ESM script

## Browser security note

Shipping OpenAI API keys in a browser exposes them to users. Use the OpenAI adapter's `dangerouslyAllowBrowser: true` flag only for local development or trusted internal tools. For production browser deployments, proxy requests through your own backend that injects the API key.

## License

MIT
