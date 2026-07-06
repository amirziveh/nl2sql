# nl2sql-agent — Design Specification

**Status:** Draft awaiting implementation plan  
**Supersedes:** `KallehAssistant/docs/superpowers/specs/2026-07-06-nl2sql-agent-package.md`

## 1. Overview

`nl2sql-agent` is an open-source TypeScript package that exposes the NL2SQL agent loop extracted from KallehAssistant in a reusable, provider-agnostic form. It turns natural-language questions into SQL through a plan → query → verify → answer loop, using native LLM function-calling (tool-use).

### Goals

- Ship a package the maintainer is proud to make public: clean API, tests, docs, CI, semantic releases.
- Browser-first environment target; Node.js works via bundlers or native ESM.
- Provider-agnostic: core depends only on interfaces; adapters ship as thin wrappers.
- SQL-runner agnostic: the caller supplies a `SqlProvider`; the package never opens DB sockets itself.
- Observable by default: every step is inspectable, cancellable, and replayable.

### Non-goals

- SQL execution engine (caller provides it).
- UI components, dashboards, or React hooks in v1.
- File upload / CSV/XLSX ingestion in v1.
- Authentication or API-key storage.
- A custom query planner that rewrites SQL in arbitrary ways.

---

## 2. Core Principles

1. **One provider interface, many adapters.** `LlmProvider` and `SqlProvider` are the only extension points. v1 ships one LLM adapter (OpenAI) and two SQL substrates (static provider + AlaSQL reference). More adapters follow without core changes.
2. **Functional core, imperative shell.** Pure functions implement each pipeline stage. `Nl2SqlAgent.query()` is a thin facade that wires dependencies and provides callback ergonomics.
3. **Layered verification.** Hard checks catch obviously-wrong SQL. Advisory checks warn the model. Prompt verification catches semantic mistakes.
4. **Dependency minimalism in the browser bundle.** No 150 KB SQL parser dependency. Column extraction is done with a small tokenizer ("good enough" + graceful fallback).
5. **Adopt then standardize.** Each provider adapter uses the official SDK of that provider so streaming, retries, and protocol edge cases are handled by experts.

---

## 3. Architecture

### Package layout

```
nl2sql-agent/
├── src/
│   ├── index.ts              # Public exports
│   ├── agent.ts              # Nl2SqlAgent class — thin facade
│   │
│   ├── llm/
│   │   ├── types.ts          # LlmProvider, ToolDefinition, ChatMessage, etc.
│   │   ├── openai-adapter.ts # v1 adapter (peer: openai)
│   │   ├── anthropic-adapter.ts   # v1.1
│   │   └── openrouter-adapter.ts  # v1.1
│   │
│   ├── sql/
│   │   ├── types.ts          # SqlProvider, TableSchema, QueryResultData
│   │   ├── static-provider.ts     # createStaticSqlProvider(...)
│   │   ├── alasql-provider.ts     # In-browser AlaSQL reference
│   │   └── tokenize.ts            # Minimal SQL tokenizer for column extraction
│   │
│   ├── pipeline/
│   │   ├── loop.ts           # runPipeline: plan → query → verify → answer
│   │   ├── verifier.ts       # Hard + advisory verification checks
│   │   ├── result-formatter.ts    # QueryResultData → LLM-friendly summary
│   │   └── history.ts        # Pluggable conversation history reducer
│   │
│   ├── prompts/
│   │   ├── sections.ts       # Composable prompt sections
│   │   ├── system-prompt.ts  # buildSystemPrompt assembler
│   │   └── tools.ts          # run_sql / finish tool schemas
│   │
│   ├── schema/
│   │   ├── describe.ts       # buildSchemaDescription, buildSchemaWithSamples
│   │   └── relationships.ts  # buildRelationshipHints
│   │
│   └── types.ts              # Shared public types
│
├── __tests__/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── examples/
│   ├── browser/              # Vite + AlaSQL minimal demo
│   └── node/                 # Node ESM script with static provider
│
├── docs/                     # Guides consumed by TypeDoc site
├── .github/workflows/        # CI + release automation
├── package.json              # type: "module", exports, peerDependencies
├── tsconfig.json
├── vitest.config.ts
├── .changeset/config.json
├── README.md
└── LICENSE (MIT)
```

### Dependency graph rules

Enforced by ESLint `no-restricted-imports`:

| Layer | Can import from |
|---|---|
| `src/index.ts`, `src/agent.ts` | any `src/*` |
| `src/pipeline/*` | `src/llm/types`, `src/sql/types`, `src/prompts/*`, sibling pipeline files |
| `src/llm/*` | own `types.ts` and the matching SDK package only |
| `src/sql/*` | own `types.ts` only |
| `src/prompts/*` | `src/sql/types` only |
| `src/schema/*` | `src/sql/types` only |

This guarantees the core never accidentally pulls in `openai`, `alasql`, or environment-specific globals.

### Build target

- **Output formats:** ESM (`dist/index.mjs`) + CJS (`dist/index.cjs`) + TypeScript declarations (`dist/index.d.ts`). No dedicated IIFE bundle — users who need a `<script>` tag run the ESM through their bundler.
- **Package exports:**
  ```json
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "sideEffects": false
  ```
- **Target:** TypeScript `lib`: `es2022`, `dom`. Node `>=18`. No `node-fetch` polyfill (native fetch is required).

---

## 4. Public API

### Installation

```bash
npm install nl2sql-agent openai
```

`openai` is a peer dependency of the OpenAI adapter. The core package declares no peer deps.

### Quickstart

```ts
import { Nl2SqlAgent, createOpenAiProvider, createStaticSqlProvider } from "nl2sql-agent";
import OpenAI from "openai";

const agent = new Nl2SqlAgent({
  provider: createOpenAiProvider(
    new OpenAI({ apiKey: process.env.OPENAI_API_KEY, dangerouslyAllowBrowser: true }),
    { model: "gpt-4o-mini", temperature: 0.1 }
  ),
});

const result = await agent.query("Top 5 customers by revenue last month", {
  sqlProvider: createStaticSqlProvider({
    schemas,
    executeSQL: async (sql) => db.exec(sql),
  }),
});

console.log(result.answer);
console.log(result.sql);
```

### Nl2SqlAgent

```ts
class Nl2SqlAgent {
  constructor(config: AgentConfig);

  query(
    question: string,
    context: QueryContext,
    callbacks?: QueryCallbacks
  ): Promise<QueryResult>;
}
```

### Config

```ts
interface AgentConfig {
  provider: LlmProvider;
  maxSteps?: number;              // default: 20
  language?: string;              // default: "en"
  historyReducer?: (messages: ChatMessage[], max: number) => ChatMessage[]; // default: keep last 8 messages in loop
  sqlHints?: {
    maxRowsWarning?: number;      // default: 500
    allowNonSelect?: boolean;     // default: false
  };
}

interface QueryContext {
  // If sqlProvider is supplied, it takes precedence and static fields are ignored.
  sqlProvider?: SqlProvider;

  // Static shape. The agent wraps these into a StaticSqlProvider internally.
  schemas?: TableSchema[];
  executeSQL?: (sql: string) => Promise<QueryResultData>;
  samples?: Record<string, Record<string, unknown>[]>;
  relationships?: string;

  history?: ChatMessage[];        // prior conversation for follow-up questions
  instructions?: string;          // extra domain instructions
}

interface QueryCallbacks {
  onStep?: (step: Step) => void;
  onFinalSQL?: (sql: string) => void;
  onAnswer?: (answer: string) => void;
  signal?: AbortSignal;
}

interface QueryResult {
  answer: string;
  sql: string;                    // canonical final SQL
  explanation: string;            // LLM explanation of what the SQL answers
  result: QueryResultData | null;
  steps: Step[];
}

interface Step {
  sql: string;
  purpose: string;                // from run_sql tool call
  explanation: string;
  result: QueryResultData;
  verification: VerificationOutcome;
}

interface VerificationOutcome {
  status: "passed" | "warning" | "failed";
  hardFailures: string[];         // blocking issues
  warnings: string[];             // advisory issues
  columnRefs: ColumnRef[];        // tables/columns detected by tokenizer
}

interface ColumnRef {
  table?: string;
  column: string;
}
```

### Core types

```ts
interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  rowCount?: number;
}

interface ColumnSchema {
  name: string;
  type: string;
  description?: string;
}

interface QueryResultData {
  columns: string[];
  rows: Record<string, unknown>[];
  error?: string;
}

type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: ToolCall[] }
  | { role: "tool"; content: string; toolCallId: string };

interface LlmProvider {
  chat(options: ChatOptions): Promise<AssistantMessage>;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface SqlProvider {
  listSchemas(): Promise<TableSchema[]>;
  getSchema(name: string): Promise<TableSchema>;
  getSamples(name: string, limit: number): Promise<Record<string, unknown>[]>;
  execute(sql: string): Promise<QueryResultData>;
}
```

### Low-level exports

The package also exports building blocks so power users can assemble custom pipelines:

```ts
export {
  buildSchemaDescription,
  buildSchemaWithSamples,
  buildRelationshipHints,
  formatResultForLLM,
  extractColumnRefs,
  createStaticSqlProvider,
  createAlaSqlProvider,
  createOpenAiProvider,
};
```

---

## 5. Provider Interfaces

### LlmProvider

The package never imports `openai` directly in core code. It only depends on:

```ts
interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface ChatOptions {
  messages: ChatMessage[];
  tools: ToolDefinition[];
  temperature?: number;
  signal?: AbortSignal;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface AssistantMessage {
  role: "assistant";
  content: string | null;
  toolCalls: ToolCall[];
}

interface LlmProvider {
  chat(options: ChatOptions): Promise<AssistantMessage>;
}
```

v1 ships `createOpenAiProvider(client, options)`. v1.1 adds Anthropic and OpenRouter adapters.

Future: `chatStream(options)` may be added as an optional method for agents that want real-time reasoning tokens. The v1 callback-based progress (`onStep`, `onAnswer`) is sufficient for most use cases.

### SqlProvider

The SQL substrate is fully abstracted. The pipeline does not know whether it is talking to AlaSQL, Postgres, SQLite, or a mock.

```ts
interface SqlProvider {
  listSchemas(): Promise<TableSchema[]>;
  getSchema(name: string): Promise<TableSchema>;
  getSamples(name: string, limit: number): Promise<Record<string, unknown>[]>;
  execute(sql: string): Promise<QueryResultData>;
}
```

v1 ships two implementations:

1. `createStaticSqlProvider({ schemas, executeSQL, samples?, relationships? })` — the common "I already have schemas" case.
2. `createAlaSqlProvider({ tables })` — in-browser AlaSQL reference implementation extracted from KallehAssistant.
   ```ts
   interface AlaSqlProviderInput {
     tables: Record<string, Record<string, unknown>[]>;
   }
   ```
   The provider lazily imports `alasql`, creates tables from the supplied row arrays, introspects columns from the first row, and executes queries.

Future: `PostgresSqlProvider`, `SqliteSqlProvider`, `MySqlSqlProvider` as community or v1.2+ packages.

---

## 6. Pipeline: Function-Calling Loop

### LLM tools

Each LLM turn sees exactly two tools:

```json
{
  "type": "function",
  "function": {
    "name": "run_sql",
    "description": "Run a SQL query against the database. Use this to collect data before answering.",
    "parameters": {
      "type": "object",
      "properties": {
        "sql": { "type": "string", "description": "A single SQL-92 SELECT statement." },
        "purpose": { "type": "string", "description": "One sentence: what question does this query answer?" },
        "explanation": { "type": "string", "description": "Why you chose these tables/columns." }
      },
      "required": ["sql", "purpose", "explanation"]
    }
  }
}
```

```json
{
  "type": "function",
  "function": {
    "name": "finish",
    "description": "Submit the final answer after running at least one SQL query.",
    "parameters": {
      "type": "object",
      "properties": {
        "answer": { "type": "string", "description": "Final natural-language answer." },
        "sql": { "type": "string", "description": "The canonical SQL that produced the data." },
        "explanation": { "type": "string", "description": "Brief explanation of the final SQL." }
      },
      "required": ["answer", "sql", "explanation"]
    }
  }
}
```

### Loop pseudocode

```ts
async function runPipeline(options) {
  const { llm, sqlProvider, systemPrompt, maxSteps, question } = options;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
  ];

  const steps: Step[] = [];
  const schemas = await sqlProvider.listSchemas();
  let executedAtLeastOneSQL = false;

  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
    const response = await llm.chat({ messages, tools });
    const toolCalls = response.toolCalls;

    const finishCall = toolCalls.find((tc) => tc.name === "finish");
    const sqlCalls = toolCalls.filter((tc) => tc.name === "run_sql");

    // Case A: SQL calls exist and no finish → execute them.
    if (sqlCalls.length > 0 && !finishCall) {
      const callResults = await Promise.all(
        sqlCalls.map(async (tc) => {
          const sql = tc.arguments.sql as string;
          const verification = await verifySql({ sql, schemas });

          let result: QueryResultData;
          if (verification.hardFailures.length > 0) {
            result = { columns: [], rows: [], error: verification.hardFailures.join("; ") };
          } else {
            result = await sqlProvider.execute(sql);
          }

          return {
            call: tc,
            result,
            verification,
          };
        })
      );

      executedAtLeastOneSQL = true;

      for (const r of callResults) {
        steps.push({
          sql: r.call.arguments.sql,
          purpose: r.call.arguments.purpose,
          explanation: r.call.arguments.explanation,
          result: r.result,
          verification: r.verification,
        });
        options.callbacks?.onStep?.(steps[steps.length - 1]);
      }

      messages.push(buildAssistantToolCallMessage(response));
      messages.push(buildToolResultMessage(callResults));
      continue;
    }

    // Case B: finish call exists.
    if (finishCall) {
      if (!executedAtLeastOneSQL) {
        messages.push({
          role: "system",
          content: "You must call run_sql at least once before using finish.",
        });
        continue;
      }

      const finalSQL = (finishCall.arguments.sql as string) || getLastSuccessfulSQL(steps);
      options.callbacks?.onFinalSQL?.(finalSQL);
      options.callbacks?.onAnswer?.(finishCall.arguments.answer);

      return {
        answer: finishCall.arguments.answer,
        sql: finalSQL,
        explanation: finishCall.arguments.explanation,
        result: getLastSuccessfulResult(steps),
        steps,
      };
    }

    // Case C: no useful tool calls — record the assistant content, then nudge.
    messages.push({
      role: "assistant",
      content: response.content ?? "",
      toolCalls: [],
    });
    messages.push({
      role: "system",
      content: "You must either call run_sql to collect data or finish to answer. Do not respond with plain text.",
    });
  }

  // Case D: max steps exhausted.
  // Make one final LLM call with a stronger instruction:
  //   "You have reached the step limit. Call `finish` now with the best answer
  //    from the data collected so far. Do not call run_sql."
  // If the LLM still doesn't call finish, synthesize a QueryResult from the
  // last successful step's data with a warning note attached.
  return forceFinalAnswer({ llm, messages, steps, tools });
}
```

### Streaming progress

`query()` returns a promise. Real-time progress arrives through callbacks:

- `onStep` — after each `run_sql` execution.
- `onFinalSQL` — when the agent decides on a final SQL.
- `onAnswer` — when the final answer is emitted.

Native token streaming may be added in v1.1 via a `streamQuery()` method on `LlmProvider` without changing the callback contract.

---

## 7. Verification

Every `run_sql` result runs through the verifier before being returned to the LLM. Verification has three layers:

### 7.1 Hard checks (blocking)

If a hard check fails, the SQL is **not executed** and the failure is returned as `QueryResultData.error`.

| Check | Failure message example |
|---|---|
| Referenced table does not exist in schema | `Table "customres" does not exist. Available tables: customers, orders.` |
| Referenced column does not exist | `Column "revenu" does not exist in table "orders". Did you mean "revenue"?` |
| SQL is not a SELECT | `Only SELECT statements are allowed.` |

Column extraction uses the minimal tokenizer (`extractColumnRefs`). If the tokenizer cannot confidently parse a subquery, it marks the query as "requires execution" and skips the hard check for that statement (errors are caught at runtime instead).

### 7.2 Advisory checks (warnings)

Advisory checks do not block execution. Their output is attached to the tool result as `warnings` so the LLM can decide what to do.

| Check | Warning example |
|---|---|
| Result has zero rows | `No rows returned. The filter may be too restrictive.` |
| All returned values are null | `All selected values are NULL.` |
| Result row count exceeds configured soft limit | `Returned 5,312 rows. Consider aggregating or limiting.` |
| A column used in GROUP BY is also aggregated in SELECT | `Column "region" appears in both GROUP BY and an aggregate; verify this is intended.` |

Soft limits are exposed through `AgentConfig.sqlHints?.maxRowsWarning` with a sensible default (e.g., 500).

### 7.3 Prompt verification (semantic)

The system prompt includes a verification phase:

> Before calling `finish`, review the collected data:
> - Does it answer the user's question directly?
> - Are the units and time windows correct?
> - Are there obvious outliers or nulls that should be noted?
> If anything looks off, run additional SQL. If good, call `finish` with a concise answer and cite the key numbers.

---

## 8. Prompt System

Prompts are built from composable sections rather than one giant template string.

### Sections

Each section is a pure function `SectionInput → string`:

- `roleSection()` — role and database personality.
- `capabilitiesSection()` — SQL dialect (SQL-92 / SQLite-like), identifier bracketing, case sensitivity, limits.
- `schemaSection({ schemas, samples?, relationships? })` — formatted schema + relationship hints + optional samples.
- `workflowSection()` — plan → query → verify → answer instructions, tool-call rules.
- `outputSection({ language })` — final-answer tone and formatting rules (numbers, units, Persian digit/scale rules when applicable).
- `instructionsSection(customInstructions)` — optional caller-provided domain guide.

### System prompt builder

```ts
function buildSystemPrompt(ctx: PromptContext): string {
  const sections = [
    roleSection(),
    capabilitiesSection(ctx.dialectHints),
    schemaSection(ctx),
    workflowSection(),
    outputSection({ language: ctx.language }),
    ctx.instructions ? instructionsSection(ctx.instructions) : null,
  ];
  return sections.filter(Boolean).join("\n\n");
}
```

### Language extension

The default `language: "en"` uses English prompts and formatting rules. Other languages are supported through two mechanisms:

1. **Prompt tone** — `outputSection` swaps locale-specific formatting rules (number scales, date formats, business units).
2. **Domain glossary** — caller-provided `instructions` can inject translations, KPI formulas, and value mappings.

A future `nl2sql-agent-persian` package will export Persian-specific helpers (`buildPersianGlossary`, `toPersianDigits`, unit formatters) that generate the `instructions` string.

---

## 9. Schema Description

### Table description format

```
TABLE [customers] (1,240 rows)
Columns:
  - id (INTEGER)
  - name (STRING)
  - region (STRING)
  - created_at (DATETIME)
```

### With samples

```
Sample rows from [customers]:
{"id":1,"name":"Acme Corp","region":"North","created_at":"2024-01-15"}
{"id":2,"name":"Globex","region":"South","created_at":"2024-02-20"}
```

### Relationship hints

`buildRelationshipHints(schemas)` scans column names pairwise and emits:

```
- [customers] and [orders] share columns: customer_id — likely JOIN key
```

This is purely heuristic. Callers can pass explicit `relationships` text to override or augment it.

### Result formatting

`formatResultForLLM(result)` produces compact text:

```
columns: customer_id, revenue
rows returned: 5
numeric aggregates:
  revenue: sum=1,240,000.00, avg=248,000.00, min=120,000.00, max=540,000.00
first 5 rows:
{"customer_id":12,"revenue":540000}
...
```

---

## 10. Error Handling & Edge Cases

| Scenario | Behavior |
|---|---|
| LLM responds with plain text, no tool calls | Push a system nudge: "Call run_sql or finish." Retry. |
| LLM tries to finish before running SQL | Push a system warning and continue loop. |
| SQL references unknown table/column | Hard check blocks execution; error returned to LLM with near-match suggestions. |
| SQL execution fails at runtime | Error message is returned as `QueryResultData.error`; LLM can retry. |
| SQL returns zero rows | Advisory warning attached; LLM decides how to handle. |
| Max steps exceeded | Force a final `finish` call with collected context; never hang. |
| AbortSignal triggered | Cancel the active LLM call and return a partial `QueryResult` with `steps` populated so far. |
| Rate limit / 429 from SDK | Surface as provider error with retry-after guidance; do not swallow. |
| Missing API key | Throw on adapter construction. |
| Missing schemas / provider | Throw on `query()`. |
| Token limit exceeded | Caught as provider error; pipeline aborts with explanatory message. |

---

## 11. Testing Strategy

### Unit tests (fast, no network)

- `extractColumnRefs` — validates column extraction across SQL shapes.
- `buildSchemaDescription` — verifies formatting and sample injection.
- `buildRelationshipHints` — verifies shared-column detection.
- `formatResultForLLM` — verifies aggregate compute and row limits.
- `history` reducer — verifies truncation preserves essential context.
- Verifier pure functions — hard checks and advisory checks.

### Integration tests

- Mocked `LlmProvider` + `SqlProvider` run the full pipeline.
- Fixtures are JSON files of recorded LLM tool-call traces.
- Tests assert exact `answer`, `sql`, and `steps` for curated questions.

### E2E tests

- Optional real OpenAI calls guarded by `process.env.NL2SQL_OPENAI_API_KEY`.
- A fixed set of ~10 NL questions against an in-memory sales schema.
- These tests are skipped in CI unless the secret is present ( nightly / manual run ).

### Coverage target

Minimum 80% branch coverage on `src/` before v1.0.0.

---

## 12. Quality Infrastructure

### TypeScript & linting

- TypeScript 5.6+, `strict: true`, `noUncheckedIndexedAccess: true`.
- `typescript-eslint` recommended + strict-type-checked.
- Prettier with default config.
- `knip` detects unused exports/dependencies before release.
- `publint` verifies package.json exports.
- `attw` checks that types and exports work for both `require` and `import` consumers.

### CI (GitHub Actions)

`ci.yml`: lint → typecheck → test → coverage → build → publint/attw on Node 18/20/22 and Ubuntu.

`release.yml`: triggers on merge to main; uses `changesets/action` to version and publish to npm with provenance.

### Release process

- Conventional-impact changesets on PRs that touch public API.
- `changeset version` bumps `package.json` and changelog.
- `changeset publish` publishes to npm and creates a GitHub Release.
- CHANGELOG.md generated automatically.

### Documentation

- README: install, quickstart, full API reference, provider examples.
- `./docs`: extended guides (custom providers, prompt sections, browser security).
- TypeDoc generates a static site published to GitHub Pages.
- `examples/browser/`: runnable Vite + AlaSQL demo.
- `examples/node/`: minimal Node ESM script.

---

## 13. Roadmap

| Version | Deliverable |
|---|---|
| **v1.0.0** | Core package + `createOpenAiProvider` + `createStaticSqlProvider` + `createAlaSqlProvider`. Function-calling pipeline. Verification layers. English prompts. Tests, docs, CI. |
| **v1.1.0** | `createAnthropicProvider`, `createOpenRouterProvider`. Optional `chatStream()` on `LlmProvider`. |
| **v1.2.0** | `nl2sql-agent-persian` addon package: Persian glossary helpers, right-to-left prompt support, Persian number/unit formatters. |
| **v1.3.0** | Advanced verification: schema-diff cross-checks, row-count anomaly detection, optional query-planner seeding. |
| **v2.0+** | Consider monorepo split (`@nl2sql/agent`, `@nl2sql/adapter-openai`, etc.) only if package count/cadence justify it. |

---

## 14. Out of Scope (v1)

- SQL execution engine (provided by caller).
- React/Vue/Svelte UI components or hooks.
- File upload, CSV/XLSX parsing, or data-ingestion workflows.
- Database connection pooling or connection management.
- Authentication, authorization, or API-key storage.
- Fine-tuned model hosting or training.
- Multi-database joins across providers.
- Visual/chart generation (map actions, charts).

---

## 15. Glossary

- **NL2SQL** — Natural Language to SQL.
- **LlmProvider** — Interface implemented by each LLM backend adapter.
- **SqlProvider** — Interface implemented by each database/sql-runner adapter.
- **Function-calling / tool-use** — LLM feature where the model emits structured tool calls instead of free text.
- **Hard check** — Verification that blocks SQL execution and returns an error to the model.
- **Advisory check** — Verification that produces a warning but allows execution.
