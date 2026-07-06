# nl2sql-agent

> Browser-first TypeScript toolkit for converting natural-language questions to SQL via an LLM agent loop with verification layers.

## Why

Most NL2SQL libraries just translate a question to a single SQL string and call it done. Real users want **trustworthy answers**: the agent should plan, run queries, verify them, and iterate until the data actually answers the question. `nl2sql-agent` packages that loop in a small, dependency-light, provider-agnostic library that works in the browser and Node.

- **Plan → Query → Verify → Answer** loop powered by native LLM function-calling.
- **Layered verification**: hard checks (column/table existence), advisory warnings (zero rows, high row count, all-null columns), and a prompt-level semantic self-review.
- **Provider-agnostic**: ship your own `LlmProvider` (for any model) and `SqlProvider` (for any database). v1 ships reference OpenAI and AlaSQL adapters.
- **Browser-first**: works in Vite/Webpack out of the box. No Node-only polyfills.
- **Streaming progress**: hook into `onStep`, `onFinalSQL`, and `onAnswer` callbacks for real-time UI updates.
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
});

const result = await agent.query("Top 5 customers by revenue last month", {
  sqlProvider: createStaticSqlProvider({
    schemas: [{ name: "orders", columns: [{ name: "customer", type: "STRING" }, { name: "revenue", type: "FLOAT" }, { name: "created_at", type: "DATETIME" }] }],
    executeSQL: async (sql) => myDb.exec(sql),
  }),
});

console.log(result.answer);
console.log(result.sql);
console.log(result.steps);
```

## How it works

1. The agent assembles a system prompt from composable sections (role, capabilities, schema, workflow, output rules).
2. It calls the LLM with two tools: `run_sql` and `finish`.
3. SQL calls are verified before execution: column references must match the schema (`extractColumnRefs` minimal SQL tokenizer + Levenshtein near-match).
4. After execution, advisory warnings are computed (zero rows, high row count, all-null columns) and attached to the tool result returned to the LLM.
5. The LLM may call `run_sql` again to verify, or call `finish` with the final answer.

## Documentation

- [Getting started](./docs/getting-started.md)
- [Custom providers](./docs/custom-providers.md)
- [Browser security](./docs/browser-security.md)

## Examples

- [`examples/browser`](./examples/browser) — Vite + AlaSQL demo with OpenAI
- [`examples/node`](./examples/node) — Node ESM script

## Browser security note

Shipping OpenAI API keys in a browser exposes them to users. Use the OpenAI adapter's `dangerouslyAllowBrowser: true` flag only for local development or trusted internal tools. For production browser deployments, proxy requests through your own backend that injects the API key.

## Roadmap

| Version | Deliverable |
|---|---|
| v1.0.0 | Core package, OpenAI adapter, Static + AlaSQL providers, verification layers |
| v1.1.0 | Anthropic + OpenRouter adapters, optional `chatStream()` |
| v1.2.0 | `nl2sql-agent-persian` addon |
| v1.3.0 | Advanced verification (schema-diff, anomaly detection, query planner) |

## License

MIT
