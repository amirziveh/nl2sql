# nl2sql-agent v1.0.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## ⚡ EXECUTION PROGRESS — README for the next session

**Status as of this commit (hand-off):** Tasks 1–8 complete. Tasks 9–21 + final review remain.

**Completed tasks (do NOT redo):**
- Task 1: `chore: package skeleton` (commit `957662b`) + `fix(package): align exports.import path with tsup output` (`77c3909`)
- Task 2: `chore: vitest, eslint (flat config), prettier setup` (`be04998`)
- Task 3: `chore: changesets setup` (`7404e5d`)
- Task 4: `feat(types): shared public types` (`42eb932`)
- Task 5: `feat(sql): extractColumnRefs tokenizer` (`beb7d83`) — note: `ColumnRef` was moved from `pipeline/types.ts` to `sql/types.ts` to satisfy layer rules
- Task 6: `feat(schema): description + relationship helpers` (`498ffe3`)
- Task 7: `feat(pipeline): result formatter` (`41af3b3`)
- Task 8: `feat(pipeline): verifier with hard + advisory checks` (`29d8062`) — note: tokenizer got an added `identifyTableRefs` export so the verifier could produce `Table "X"` vs `Column "X"` error messages

**Next session start here:** Task 9 (Prompt System). Resume the subagent-driven-development pattern: dispatch implementer with full task text + context, then spec compliance reviewer, then mark complete and proceed. The user opted to skip per-task code-quality reviews for the remainder — do spec-compliance only per task, with a FINAL whole-implementation code-quality review after Task 21.

**Verification state at hand-off:** 38 tests passing, `npm run lint` clean, `npm run typecheck` clean. Repo-local git identity set: `nl2sql-agent <agent@nl2sql.local>`. Branch is `master` (rename to `main` planned for Task 21's CI workflow step).

**Resume by running:**
```bash
cd /home/ubuntu/nl2sql
git log --oneline -10
npm test   # confirm 38 tests pass
npm run lint && npm run typecheck   # confirm clean
```

Then read "**Task 9: Prompt System**" below (around line ~2000) and dispatch the implementer subagent with that section's verbatim test + implementation code.

**Cross-task lessons worth knowing before resuming:**
1. `tsconfig.json` has `verbatimModuleSyntax: true` — all type-only imports MUST use `import type`. ESLint flat-config (`eslint.config.mjs`) enforces this.
2. Relative imports use `.js` extensions (e.g., `../sql/types.js`) — required by `moduleResolution: "bundler"` + ESM emission.
3. `tsconfig.json` has `noUncheckedIndexedAccess: true` — array access returns `T | undefined`; subagents handle via `!` non-null assertion in controlled places.
4. Plan's verbatim code sometimes needs minor adjustments to pass the verbatim tests (Tasks 5 and 8 both had this). When implementers hit this, they should MODIFY IMPLEMENTATION to satisfy tests, not the other way around. Document any deviation in the implementer report.
5. Repo-local git identity (`nl2sql-agent <agent@nl2sql.local>`) was set inline via `git -c` in Task 1's commit + as a local config in some later tasks. Don't change it; just commit using this identity.
6. The `.opencode/` directory is Opencode's internal plugin state — it's gitignored at the project root.

---

**Goal:** Ship `nl2sql-agent@1.0.0` — a browser-first TypeScript package that converts natural-language questions to SQL through a function-calling agent loop with verification layers.

**Architecture:** Modular core, single package. Layered structure: `llm/` (provider adapters), `sql/` (provider adapters + tokenizer), `pipeline/` (loop, verifier, formatter, history), `prompts/` (composable sections), `schema/` (description helpers). Functional core, imperative shell via `Nl2SqlAgent` class. v1 ships OpenAI adapter + Static + AlaSQL SQL providers.

**Tech Stack:** TypeScript 5.6+ (strict), Vitest, ESLint + Prettier, Changesets, OpenAI SDK (peer), AlaSQL (peer for reference provider), Node 18+.

**Spec:** `docs/superpowers/specs/2026-07-06-nl2sql-agent-design.md`

---

## File Structure

| Path | Responsibility |
|---|---|
| `package.json` | Dependencies, exports, scripts |
| `tsconfig.json` | TypeScript compiler config (strict) |
| `vitest.config.ts` | Test runner config |
| `.eslintrc.cjs` | Lint rules + layer enforcement |
| `.prettierrc.json` | Code style |
| `.changeset/config.json` | Release config |
| `src/index.ts` | Public exports |
| `src/agent.ts` | `Nl2SqlAgent` class (facade) |
| `src/types.ts` | Shared public types |
| `src/llm/types.ts` | `LlmProvider`, `ToolDefinition`, `ChatMessage` |
| `src/llm/openai-adapter.ts` | `createOpenAiProvider` |
| `src/sql/types.ts` | `SqlProvider`, `TableSchema`, `QueryResultData` |
| `src/sql/static-provider.ts` | `createStaticSqlProvider` |
| `src/sql/alasql-provider.ts` | `createAlaSqlProvider` |
| `src/sql/tokenize.ts` | `extractColumnRefs` (minimal SQL tokenizer) |
| `src/pipeline/loop.ts` | `runPipeline`, `forceFinalAnswer` |
| `src/pipeline/verifier.ts` | `verifySql`, hard + advisory checks |
| `src/pipeline/result-formatter.ts` | `formatResultForLLM` |
| `src/pipeline/history.ts` | Default history reducer |
| `src/prompts/sections.ts` | Composable prompt sections |
| `src/prompts/system-prompt.ts` | `buildSystemPrompt` assembler |
| `src/prompts/tools.ts` | `run_sql` + `finish` tool definitions |
| `src/schema/describe.ts` | `buildSchemaDescription`, `buildSchemaWithSamples` |
| `src/schema/relationships.ts` | `buildRelationshipHints` |
| `__tests__/unit/*.test.ts` | Pure-function tests |
| `__tests__/integration/*.test.ts` | Pipeline + agent tests with mocks |
| `__tests__/fixtures/*.json` | Recorded LLM traces |
| `examples/browser/` | Vite + AlaSQL demo |
| `examples/node/` | Node ESM script demo |
| `.github/workflows/ci.yml` | CI: lint, typecheck, test, build |
| `.github/workflows/release.yml` | Changeset publish |
| `README.md` | Project docs |

---

## Task 1: Package Skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `LICENSE`
- Create: `src/index.ts`

- [ ] **Step 1: Initialize package.json**

Create `package.json`:

```json
{
  "name": "nl2sql-agent",
  "version": "0.0.0",
  "description": "Browser-first TypeScript toolkit for natural-language to SQL agent loops with verification.",
  "type": "module",
  "license": "MIT",
  "author": "",
  "keywords": ["nl2sql", "text-to-sql", "ai", "agent", "openai", "alasql"],
  "sideEffects": false,
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts --clean",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src __tests__ --ext .ts",
    "format": "prettier --write ."
  },
  "engines": {
    "node": ">=18"
  }
}
```

- [ ] **Step 2: Initialize tsconfig.json**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": ".",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src/**/*", "__tests__/**/*"],
  "exclude": ["node_modules", "dist", "examples"]
}
```

- [ ] **Step 3: Create .gitignore**

Create `.gitignore`:

```
node_modules/
dist/
coverage/
.env
.env.local
*.log
.DS_Store
.vscode/
.turbo/
```

- [ ] **Step 4: Create LICENSE (MIT)**

Create `LICENSE`:

```
MIT License

Copyright (c) 2026 nl2sql-agent contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 5: Create empty src/index.ts**

Create `src/index.ts`:

```ts
// Public exports will be added as modules are implemented.
export {};
```

- [ ] **Step 6: Install dependencies**

Run:

```bash
npm install
```

Expected: Installs without errors (no dependencies yet).

- [ ] **Step 7: Verify typecheck passes**

Run:

```bash
npm run typecheck
```

Expected: PASS with no errors.

- [ ] **Step 8: Init git and commit**

Run:

```bash
git init
git add .
git commit -m "chore: package skeleton"
```

---

## Task 2: Vitest + ESLint + Prettier Setup

**Files:**
- Create: `vitest.config.ts`
- Create: `.eslintrc.cjs`
- Create: `.prettierrc.json`
- Create: `eslintignore`
- Modify: `package.json`
- Create: `__tests__/unit/sanity.test.ts`

- [ ] **Step 1: Install dev dependencies**

Run:

```bash
npm install -D vitest@^2 typescript@^5.6 @typescript-eslint/eslint-plugin@^8 @typescript-eslint/parser@^8 eslint@^9 prettier@^3 tsup@^8
```

Expected: Installs successfully.

- [ ] **Step 2: Create vitest.config.ts**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**"],
    },
  },
});
```

- [ ] **Step 3: Create .eslintrc.cjs**

Create `.eslintrc.cjs`:

```js
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    project: "./tsconfig.json",
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
  ignorePatterns: ["dist", "node_modules", "examples", "*.config.ts"],
};
```

- [ ] **Step 4: Create .eslintignore**

Create `.eslintignore`:

```
dist
node_modules
examples
coverage
```

- [ ] **Step 5: Create .prettierrc.json**

Create `.prettierrc.json`:

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 6: Update package.json scripts and devDependencies**

Edit `package.json` to add:

```json
{
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^8",
    "@typescript-eslint/parser": "^8",
    "eslint": "^9",
    "prettier": "^3",
    "tsup": "^8",
    "typescript": "^5.6",
    "vitest": "^2"
  }
}
```

(The versions above are placeholders; use whatever npm installed in Step 1 — check `package.json` for actual versions.)

- [ ] **Step 7: Write a sanity test**

Create `__tests__/unit/sanity.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Verify test passes**

Run:

```bash
npm test
```

Expected: 1 test passes.

- [ ] **Step 9: Verify lint passes**

Run:

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "chore: vitest, eslint, prettier setup"
```

---

## Task 3: Changesets Setup

**Files:**
- Create: `.changeset/config.json`
- Create: `.changeset/README.md`
- Modify: `package.json`

- [ ] **Step 1: Install changesets**

Run:

```bash
npm install -D @changesets/cli@^2
```

- [ ] **Step 2: Initialize changesets**

Run:

```bash
npx changeset init
```

Expected: Creates `.changeset/config.json` and `.changeset/README.md`.

- [ ] **Step 3: Edit .changeset/config.json**

Replace with:

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": false,
  "ignore": []
}
```

- [ ] **Step 4: Add changeset scripts to package.json**

Edit `package.json` scripts to add:

```json
{
  "scripts": {
    "changeset": "changeset",
    "version": "changeset version",
    "release": "changeset publish"
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: changesets setup"
```

---

## Task 4: Shared Types

**Files:**
- Create: `src/types.ts`
- Create: `src/llm/types.ts`
- Create: `src/sql/types.ts`
- Create: `src/pipeline/types.ts`
- Create: `__tests__/unit/types.test-d.ts`

- [ ] **Step 1: Create src/sql/types.ts**

Create `src/sql/types.ts`:

```ts
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
```

- [ ] **Step 2: Create src/llm/types.ts**

Create `src/llm/types.ts`:

```ts
export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: ToolCall[] }
  | { role: "tool"; content: string; toolCallId: string };

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatOptions {
  messages: ChatMessage[];
  tools: ToolDefinition[];
  temperature?: number;
  signal?: AbortSignal;
}

export interface AssistantMessage {
  role: "assistant";
  content: string | null;
  toolCalls: ToolCall[];
}

export interface LlmProvider {
  chat(options: ChatOptions): Promise<AssistantMessage>;
}
```

- [ ] **Step 3: Create src/pipeline/types.ts**

Create `src/pipeline/types.ts`:

```ts
import type { QueryResultData } from "../sql/types.js";

export interface ColumnRef {
  table?: string;
  column: string;
}

export interface VerificationOutcome {
  status: "passed" | "warning" | "failed";
  hardFailures: string[];
  warnings: string[];
  columnRefs: ColumnRef[];
}

export interface Step {
  sql: string;
  purpose: string;
  explanation: string;
  result: QueryResultData;
  verification: VerificationOutcome;
}
```

- [ ] **Step 4: Create src/types.ts**

Create `src/types.ts`:

```ts
import type { ChatMessage, LlmProvider } from "./llm/types.js";
import type {
  QueryResultData,
  SqlProvider,
  StaticSqlProviderInput,
  TableSchema,
} from "./sql/types.js";
import type { Step } from "./pipeline/types.js";

export interface AgentConfig {
  provider: LlmProvider;
  maxSteps?: number;
  language?: string;
  historyReducer?: (messages: ChatMessage[], max: number) => ChatMessage[];
  sqlHints?: {
    maxRowsWarning?: number;
    allowNonSelect?: boolean;
  };
}

export interface QueryContext {
  sqlProvider?: SqlProvider;
  schemas?: TableSchema[];
  executeSQL?: (sql: string) => Promise<QueryResultData>;
  samples?: Record<string, Record<string, unknown>[]>;
  relationships?: string;
  history?: ChatMessage[];
  instructions?: string;
}

export interface QueryCallbacks {
  onStep?: (step: Step) => void;
  onFinalSQL?: (sql: string) => void;
  onAnswer?: (answer: string) => void;
  signal?: AbortSignal;
}

export interface QueryResult {
  answer: string;
  sql: string;
  explanation: string;
  result: QueryResultData | null;
  steps: Step[];
}

export type { ChatMessage, LlmProvider, ToolCall, ToolDefinition } from "./llm/types.js";
export type {
  QueryResultData,
  SqlProvider,
  StaticSqlProviderInput,
  TableSchema,
  ColumnSchema,
  AlaSqlProviderInput,
} from "./sql/types.js";
export type { Step, VerificationOutcome, ColumnRef } from "./pipeline/types.js";
```

- [ ] **Step 5: Write type-level test**

Create `__tests__/unit/types.test-d.ts`:

```ts
import { describe, it, expectTypeOf } from "vitest";
import type { AgentConfig, QueryContext, QueryResult, QueryCallbacks } from "../../src/types.js";
import type { LlmProvider, SqlProvider } from "../../src/types.js";

describe("type contracts", () => {
  it("AgentConfig requires provider", () => {
    expectTypeOf<AgentConfig>().toMatchTypeOf<{ provider: LlmProvider }>();
  });

  it("QueryContext accepts static shape", () => {
    const ctx: QueryContext = {
      schemas: [{ name: "t", columns: [{ name: "id", type: "INTEGER" }] }],
      executeSQL: async () => ({ columns: [], rows: [] }),
    };
    expectTypeOf(ctx).toMatchTypeOf<QueryContext>();
  });

  it("QueryResult has answer/sql/steps", () => {
    expectTypeOf<QueryResult>().toMatchTypeOf<{ answer: string; sql: string; steps: unknown[] }>();
  });
});
```

- [ ] **Step 6: Verify typecheck**

Run:

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat(types): shared public types"
```

---

## Task 5: SQL Tokenizer (extractColumnRefs)

**Files:**
- Create: `src/sql/tokenize.ts`
- Create: `__tests__/unit/tokenize.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/unit/tokenize.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { extractColumnRefs } from "../../src/sql/tokenize.js";

describe("extractColumnRefs", () => {
  it("extracts columns from simple SELECT", () => {
    const refs = extractColumnRefs("SELECT name, revenue FROM customers");
    expect(refs).toEqual([
      { table: undefined, column: "name" },
      { table: undefined, column: "revenue" },
      { table: undefined, column: "customers" },
    ]);
  });

  it("extracts qualified columns", () => {
    const refs = extractColumnRefs("SELECT c.name FROM customers c");
    expect(refs).toContainEqual({ table: "c", column: "name" });
    expect(refs).toContainEqual({ table: undefined, column: "customers" });
  });

  it("extracts JOIN columns", () => {
    const refs = extractColumnRefs(
      "SELECT a.id FROM orders a JOIN customers b ON a.customer_id = b.id"
    );
    expect(refs).toContainEqual({ table: "a", column: "id" });
    expect(refs).toContainEqual({ table: "a", column: "customer_id" });
    expect(refs).toContainEqual({ table: "b", column: "id" });
  });

  it("extracts WHERE columns", () => {
    const refs = extractColumnRefs("SELECT * FROM orders WHERE region = 'North'");
    expect(refs).toContainEqual({ table: undefined, column: "region" });
  });

  it("extracts GROUP BY columns", () => {
    const refs = extractColumnRefs("SELECT region, COUNT(*) FROM orders GROUP BY region");
    expect(refs.filter((r) => r.column === "region").length).toBeGreaterThanOrEqual(1);
  });

  it("extracts ORDER BY columns", () => {
    const refs = extractColumnRefs("SELECT * FROM orders ORDER BY created_at DESC");
    expect(refs).toContainEqual({ table: undefined, column: "created_at" });
  });

  it("lowercases column names", () => {
    const refs = extractColumnRefs("SELECT Name FROM Customers");
    expect(refs).toContainEqual({ table: undefined, column: "name" });
  });

  it("handles star (SELECT *)", () => {
    const refs = extractColumnRefs("SELECT * FROM customers");
    expect(refs).toContainEqual({ table: undefined, column: "*" });
    expect(refs).toContainEqual({ table: undefined, column: "customers" });
  });

  it("handles subqueries without throwing", () => {
    const refs = extractColumnRefs(
      "SELECT * FROM (SELECT id FROM customers) sub"
    );
    expect(refs).toContainEqual({ table: undefined, column: "id" });
    expect(refs).toContainEqual({ table: undefined, column: "customers" });
  });

  it("returns empty for non-SELECT statements", () => {
    const refs = extractColumnRefs("INSERT INTO customers VALUES (1)");
    expect(refs).toEqual([]);
  });

  it("ignores string literals", () => {
    const refs = extractColumnRefs("SELECT 'literal_string' FROM customers");
    expect(refs).not.toContainEqual({ table: undefined, column: "literal_string" });
  });

  it("strips brackets from identifiers", () => {
    const refs = extractColumnRefs("SELECT [name] FROM [customers]");
    expect(refs).toContainEqual({ table: undefined, column: "name" });
    expect(refs).toContainEqual({ table: undefined, column: "customers" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tokenize
```

Expected: FAIL — module `../../src/sql/tokenize.js` does not exist.

- [ ] **Step 3: Implement extractColumnRefs**

Create `src/sql/tokenize.ts`:

```ts
import type { ColumnRef } from "../pipeline/types.js";

const SQL_KEYWORDS = new Set([
  "select", "from", "where", "join", "inner", "left", "right", "outer",
  "on", "group", "by", "order", "having", "and", "or", "not", "null",
  "is", "in", "between", "like", "as", "asc", "desc", "distinct",
  "limit", "offset", "union", "all", "case", "when", "then", "else", "end",
  "count", "sum", "avg", "min", "max", "cast",
]);

const CLAUSE_KEYWORDS = new Set([
  "select", "from", "where", "join", "inner", "left", "right", "outer",
  "on", "group", "by", "order", "having",
]);

export function extractColumnRefs(sql: string): ColumnRef[] {
  const normalized = sql.replace(/\s+/g, " ").trim();
  if (!/^select/i.test(normalized)) {
    return [];
  }

  const tokens = tokenize(normalized);
  const refs: ColumnRef[] = [];
  let expectColumn = false;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    const lower = tok.toLowerCase();

    if (CLAUSE_KEYWORDS.has(lower) || lower === "and" || lower === "or") {
      expectColumn = true;
      continue;
    }
    if (SQL_KEYWORDS.has(lower)) {
      continue;
    }
    if (tok === "*" || tok === "," || tok === "(" || tok === ")" || tok === "." || tok === ";") {
      if (tok === ",") expectColumn = true;
      continue;
    }
    if (/^['"`].*['"`]$/.test(tok) || /^\d/.test(tok)) {
      continue;
    }
    if (lower === "as") {
      continue;
    }

    if (expectColumn || i === 0) {
      const next = tokens[i + 1];
      const prev = tokens[i - 1];
      if (next === ".") {
        const table = tok;
        const col = tokens[i + 2];
        if (col && !SQL_KEYWORDS.has(col.toLowerCase())) {
          refs.push({ table, column: stripBrackets(col).toLowerCase() });
        }
        i += 2;
        expectColumn = false;
        continue;
      }
      if (prev !== ".") {
        refs.push({ table: undefined, column: stripBrackets(tok).toLowerCase() });
      }
      expectColumn = false;
    }
  }

  return dedupe(refs);
}

function tokenize(sql: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i]!;
    if (ch === " " || ch === "\t" || ch === "\n") {
      i++;
      continue;
    }
    if (ch === "[" || ch === '"' || ch === "`" || ch === "'") {
      const close = ch === "[" ? "]" : ch;
      let j = i + 1;
      while (j < sql.length && sql[j] !== close) j++;
      tokens.push(sql.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    if (ch === "(" || ch === ")" || ch === "," || ch === "." || ch === ";") {
      tokens.push(ch);
      i++;
      continue;
    }
    let j = i;
    while (j < sql.length && !/[\s(),.;[\]"'`]/.test(sql[j]!)) j++;
    tokens.push(sql.slice(i, j));
    i = j;
  }
  return tokens;
}

function stripBrackets(tok: string): string {
  if (tok.startsWith("[") && tok.endsWith("]")) return tok.slice(1, -1);
  if (tok.startsWith('"') && tok.endsWith('"')) return tok.slice(1, -1);
  if (tok.startsWith("`") && tok.endsWith("`")) return tok.slice(1, -1);
  return tok;
}

function dedupe(refs: ColumnRef[]): ColumnRef[] {
  const seen = new Set<string>();
  const out: ColumnRef[] = [];
  for (const r of refs) {
    const key = `${r.table ?? ""}.${r.column}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- tokenize
```

Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(sql): extractColumnRefs tokenizer"
```

---

## Task 6: Schema Description + Relationships

**Files:**
- Create: `src/schema/describe.ts`
- Create: `src/schema/relationships.ts`
- Create: `__tests__/unit/schema.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/unit/schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildSchemaDescription, buildSchemaWithSamples } from "../../src/schema/describe.js";
import { buildRelationshipHints } from "../../src/schema/relationships.js";
import type { TableSchema } from "../../src/sql/types.js";

const customers: TableSchema = {
  name: "customers",
  columns: [
    { name: "id", type: "INTEGER" },
    { name: "name", type: "STRING" },
    { name: "region", type: "STRING" },
  ],
  rowCount: 1240,
};

const orders: TableSchema = {
  name: "orders",
  columns: [
    { name: "id", type: "INTEGER" },
    { name: "customer_id", type: "INTEGER" },
  ],
  rowCount: 5300,
};

describe("buildSchemaDescription", () => {
  it("formats a single table", () => {
    const out = buildSchemaDescription([customers]);
    expect(out).toContain("TABLE [customers] (1,240 rows)");
    expect(out).toContain("- id (INTEGER)");
    expect(out).toContain("- name (STRING)");
  });

  it("formats multiple tables", () => {
    const out = buildSchemaDescription([customers, orders]);
    expect(out).toContain("TABLE [customers]");
    expect(out).toContain("TABLE [orders]");
  });

  it("omits rowCount when not provided", () => {
    const out = buildSchemaDescription([{ name: "t", columns: [] }]);
    expect(out).not.toContain("rows)");
  });
});

describe("buildSchemaWithSamples", () => {
  it("appends sample rows", () => {
    const out = buildSchemaWithSamples([customers], {
      customers: [{ id: 1, name: "Acme", region: "North" }],
    });
    expect(out).toContain("Sample rows from [customers]:");
    expect(out).toContain('"name":"Acme"');
  });

  it("handles empty samples", () => {
    const out = buildSchemaWithSamples([customers], {});
    expect(out).toContain("TABLE [customers]");
    expect(out).not.toContain("Sample rows");
  });

  it("caps samples at 3 rows", () => {
    const out = buildSchemaWithSamples([customers], {
      customers: [
        { id: 1, name: "A" },
        { id: 2, name: "B" },
        { id: 3, name: "C" },
        { id: 4, name: "D" },
      ],
    });
    expect(out.match(/"id":\d/g)?.length).toBe(3);
  });
});

describe("buildRelationshipHints", () => {
  it("detects shared columns", () => {
    const out = buildRelationshipHints([customers, orders]);
    expect(out).toContain("[customers] and [orders] share columns: id");
  });

  it("returns empty when no shared columns", () => {
    const out = buildRelationshipHints([
      { name: "a", columns: [{ name: "x", type: "INT" }] },
      { name: "b", columns: [{ name: "y", type: "INT" }] },
    ]);
    expect(out.trim()).toBe("");
  });

  it("includes scenario hints", () => {
    const out = buildRelationshipHints([customers], "Manual hint: customers are regional.");
    expect(out).toContain("Manual hint: customers are regional.");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- schema
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement buildSchemaDescription and buildSchemaWithSamples**

Create `src/schema/describe.ts`:

```ts
import type { TableSchema } from "../sql/types.js";

export function buildSchemaDescription(schemas: TableSchema[]): string {
  return schemas.map(formatTable).join("\n\n");
}

function formatTable(s: TableSchema): string {
  const header = s.rowCount != null
    ? `TABLE [${s.name}] (${s.rowCount.toLocaleString("en-US")} rows)`
    : `TABLE [${s.name}]`;
  const cols = s.columns.map((c) => `  - ${c.name} (${c.type})`).join("\n");
  return `${header}\nColumns:\n${cols}`;
}

export function buildSchemaWithSamples(
  schemas: TableSchema[],
  samples: Record<string, Record<string, unknown>[]>
): string {
  const base = buildSchemaDescription(schemas);
  const samplesBlock = schemas
    .filter((s) => samples[s.name] && samples[s.name]!.length > 0)
    .map((s) => {
      const rows = samples[s.name]!.slice(0, 3);
      const body = rows.map((r) => JSON.stringify(r)).join("\n");
      return `Sample rows from [${s.name}]:\n${body}`;
    })
    .join("\n\n");
  return samplesBlock ? `${base}\n\n${samplesBlock}` : base;
}
```

- [ ] **Step 4: Implement buildRelationshipHints**

Create `src/schema/relationships.ts`:

```ts
import type { TableSchema } from "../sql/types.js";

export function buildRelationshipHints(
  schemas: TableSchema[],
  scenarioHints?: string
): string {
  const parts: string[] = [];

  for (let i = 0; i < schemas.length; i++) {
    for (let j = i + 1; j < schemas.length; j++) {
      const a = schemas[i]!;
      const b = schemas[j]!;
      const aCols = new Set(a.columns.map((c) => c.name.toLowerCase()));
      const common = b.columns
        .map((c) => c.name.toLowerCase())
        .filter((name) => aCols.has(name));
      if (common.length > 0) {
        parts.push(
          `- [${a.name}] and [${b.name}] share columns: ${common.join(", ")} — likely JOIN key`
        );
      }
    }
  }

  if (scenarioHints && scenarioHints.trim()) {
    parts.push(scenarioHints.trim());
  }

  return parts.join("\n");
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- schema
```

Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(schema): description + relationship helpers"
```

---

## Task 7: Result Formatter

**Files:**
- Create: `src/pipeline/result-formatter.ts`
- Create: `__tests__/unit/result-formatter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/unit/result-formatter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatResultForLLM } from "../../src/pipeline/result-formatter.js";
import type { QueryResultData } from "../../src/sql/types.js";

describe("formatResultForLLM", () => {
  it("formats columns + row count", () => {
    const r: QueryResultData = {
      columns: ["id", "name"],
      rows: [{ id: 1, name: "A" }],
    };
    const out = formatResultForLLM(r);
    expect(out).toContain("columns: id, name");
    expect(out).toContain("rows returned: 1");
  });

  it("adds numeric aggregates", () => {
    const r: QueryResultData = {
      columns: ["revenue"],
      rows: [{ revenue: 100 }, { revenue: 200 }],
    };
    const out = formatResultForLLM(r);
    expect(out).toContain("revenue: sum=300");
    expect(out).toContain("avg=150");
    expect(out).toContain("min=100");
    expect(out).toContain("max=200");
  });

  it("caps row preview at 20", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: i }));
    const r: QueryResultData = { columns: ["id"], rows };
    const out = formatResultForLLM(r);
    expect(out).toContain("First 20 rows:");
    expect(out.match(/"id":\d+/g)?.length).toBe(20);
  });

  it("handles empty result", () => {
    const r: QueryResultData = { columns: [], rows: [] };
    const out = formatResultForLLM(r);
    expect(out).toContain("rows returned: 0");
  });

  it("includes error when present", () => {
    const r: QueryResultData = { columns: [], rows: [], error: "bad col" };
    const out = formatResultForLLM(r);
    expect(out).toContain("error: bad col");
  });

  it("ignores non-numeric columns for aggregates", () => {
    const r: QueryResultData = {
      columns: ["name"],
      rows: [{ name: "A" }, { name: "B" }],
    };
    const out = formatResultForLLM(r);
    expect(out).not.toContain("numeric aggregates");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- result-formatter
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement formatResultForLLM**

Create `src/pipeline/result-formatter.ts`:

```ts
import type { QueryResultData } from "../sql/types.js";

const PREVIEW_LIMIT = 20;

export function formatResultForLLM(result: QueryResultData): string {
  if (result.error) {
    return `error: ${result.error}`;
  }

  const { columns, rows } = result;
  let text = `columns: ${columns.join(", ")}\nrows returned: ${rows.length}`;

  const aggregates = computeAggregates(columns, rows);
  if (aggregates.length > 0) {
    text += `\nnumeric aggregates:\n${aggregates.join("\n")}`;
  }

  if (rows.length > 0) {
    const preview = rows.slice(0, PREVIEW_LIMIT);
    text += `\nFirst ${preview.length} rows:\n${preview.map((r) => JSON.stringify(r)).join("\n")}`;
  }

  return text;
}

function computeAggregates(
  columns: string[],
  rows: Record<string, unknown>[]
): string[] {
  const out: string[] = [];
  for (const col of columns) {
    const values = rows
      .map((r) => r[col])
      .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
    if (values.length === 0) continue;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    out.push(
      `  ${col}: sum=${sum.toFixed(2)}, avg=${avg.toFixed(2)}, min=${min.toFixed(2)}, max=${max.toFixed(2)}`
    );
  }
  return out;
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- result-formatter
```

Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(pipeline): result formatter"
```

---

## Task 8: Verifier

**Files:**
- Create: `src/pipeline/verifier.ts`
- Create: `__tests__/unit/verifier.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/unit/verifier.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { verifySql } from "../../src/pipeline/verifier.js";
import type { TableSchema } from "../../src/sql/types.js";

const schemas: TableSchema[] = [
  {
    name: "customers",
    columns: [
      { name: "id", type: "INTEGER" },
      { name: "name", type: "STRING" },
      { name: "region", type: "STRING" },
    ],
  },
  {
    name: "orders",
    columns: [
      { name: "id", type: "INTEGER" },
      { name: "customer_id", type: "INTEGER" },
      { name: "revenue", type: "FLOAT" },
    ],
  },
];

describe("verifySql", () => {
  it("passes for valid SQL", async () => {
    const v = await verifySql({
      sql: "SELECT name FROM customers",
      schemas,
    });
    expect(v.status).toBe("passed");
    expect(v.hardFailures).toEqual([]);
  });

  it("fails for unknown table", async () => {
    const v = await verifySql({
      sql: "SELECT * FROM customres",
      schemas,
    });
    expect(v.status).toBe("failed");
    expect(v.hardFailures[0]).toContain("Table \"customres\"");
  });

  it("fails for unknown column", async () => {
    const v = await verifySql({
      sql: "SELECT revenu FROM orders",
      schemas,
    });
    expect(v.status).toBe("failed");
    expect(v.hardFailures[0]).toContain("Column \"revenu\"");
  });

  it("suggests near-match columns", async () => {
    const v = await verifySql({
      sql: "SELECT revenu FROM orders",
      schemas,
    });
    expect(v.hardFailures[0]).toContain("revenue");
  });

  it("fails for non-SELECT statements", async () => {
    const v = await verifySql({
      sql: "DELETE FROM customers",
      schemas,
      allowNonSelect: false,
    });
    expect(v.status).toBe("failed");
    expect(v.hardFailures[0]).toContain("SELECT");
  });

  it("allows non-SELECT when allowNonSelect=true", async () => {
    const v = await verifySql({
      sql: "DELETE FROM customers",
      schemas,
      allowNonSelect: true,
    });
    expect(v.status).toBe("passed");
  });

  it("does not hard-fail on unparseable subqueries", async () => {
    const v = await verifySql({
      sql: "SELECT * FROM (SELECT id FROM customers)",
      schemas,
    });
    expect(v.status).not.toBe("failed");
  });
});

describe("verifySql advisory checks", () => {
  it("warns on zero rows", async () => {
    const v = await verifySql({
      sql: "SELECT name FROM customers",
      schemas,
      result: { columns: ["name"], rows: [] },
    });
    expect(v.warnings).toContain("No rows returned. The filter may be too restrictive.");
  });

  it("warns on high row count", async () => {
    const v = await verifySql({
      sql: "SELECT * FROM customers",
      schemas,
      result: { columns: ["id"], rows: Array.from({ length: 600 }, () => ({ id: 1 })) },
      maxRowsWarning: 500,
    });
    expect(v.warnings.some((w) => w.includes("Consider aggregating"))).toBe(true);
  });

  it("warns on all-null column", async () => {
    const v = await verifySql({
      sql: "SELECT name FROM customers",
      schemas,
      result: { columns: ["name"], rows: [{ name: null }, { name: null }] },
    });
    expect(v.warnings.some((w) => w.includes("NULL"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- verifier
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement verifySql**

Create `src/pipeline/verifier.ts`:

```ts
import type { TableSchema, QueryResultData } from "../sql/types.js";
import type { VerificationOutcome } from "./types.js";
import { extractColumnRefs } from "../sql/tokenize.js";

const MIN_LEVENSHTEIN = 3;

export interface VerifySqlInput {
  sql: string;
  schemas: TableSchema[];
  result?: QueryResultData;
  allowNonSelect?: boolean;
  maxRowsWarning?: number;
}

export async function verifySql(input: VerifySqlInput): Promise<VerificationOutcome> {
  const hardFailures: string[] = [];
  const warnings: string[] = [];

  if (!input.allowNonSelect && !/^\s*select/i.test(input.sql.trim())) {
    hardFailures.push("Only SELECT statements are allowed.");
  }

  const refs = extractColumnRefs(input.sql);
  const tables = new Map<string, Set<string>>();
  for (const s of input.schemas) {
    tables.set(s.name.toLowerCase(), new Set(s.columns.map((c) => c.name.toLowerCase())));
  }

  if (hardFailures.length === 0) {
    for (const ref of refs) {
      if (ref.column === "*") continue;
      const matched = findColumnMatch(ref, tables);
      if (!matched.ok) {
        hardFailures.push(matched.message);
      }
    }
  }

  if (input.result) {
    if (input.result.rows.length === 0) {
      warnings.push("No rows returned. The filter may be too restrictive.");
    }
    const limit = input.maxRowsWarning ?? 500;
    if (input.result.rows.length > limit) {
      warnings.push(
        `Returned ${input.result.rows.length.toLocaleString("en-US")} rows. Consider aggregating or limiting.`
      );
    }
    const allNullCols = input.result.columns.filter((col) =>
      input.result!.rows.length > 0 &&
      input.result!.rows.every((r) => r[col] == null)
    );
    for (const col of allNullCols) {
      warnings.push(`All values in column "${col}" are NULL.`);
    }
  }

  const status: VerificationOutcome["status"] =
    hardFailures.length > 0 ? "failed" : warnings.length > 0 ? "warning" : "passed";

  return { status, hardFailures, warnings, columnRefs: refs };
}

type MatchResult = { ok: true } | { ok: false; message: string };

function findColumnMatch(
  ref: { table?: string; column: string },
  tables: Map<string, Set<string>>
): MatchResult {
  if (ref.table) {
    const tableLower = ref.table.toLowerCase();
    const cols = tables.get(tableLower);
    if (!cols) {
      return {
        ok: false,
        message: `Table "${ref.table}" does not exist. Available tables: ${[...tables.keys()].join(", ")}.`,
      };
    }
    if (!cols.has(ref.column.toLowerCase())) {
      const suggestion = suggestClose(ref.column, [...cols]);
      return {
        ok: false,
        message: `Column "${ref.column}" does not exist in table "${ref.table}".${suggestion ? ` Did you mean "${suggestion}"?` : ""}`,
      };
    }
    return { ok: true };
  }
  let found = false;
  for (const [tableName, cols] of tables) {
    if (cols.has(ref.column.toLowerCase())) {
      found = true;
      break;
    }
  }
  if (!found) {
    const allCols = [...tables.values()].flatMap((set) => [...set]);
    const suggestion = suggestClose(ref.column, allCols);
    return {
      ok: false,
      message: `Column "${ref.column}" does not exist.${suggestion ? ` Did you mean "${suggestion}"?` : ""}`,
    };
  }
  return { ok: true };
}

function suggestClose(target: string, candidates: string[]): string | null {
  const targetLower = target.toLowerCase();
  let best: string | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = levenshtein(targetLower, c.toLowerCase());
    if (d < bestDist && d <= MIN_LEVENSHTEIN) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[m]![n]!;
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- verifier
```

Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(pipeline): verifier with hard + advisory checks"
```

---

## Task 9: Prompt System

**Files:**
- Create: `src/prompts/sections.ts`
- Create: `src/prompts/system-prompt.ts`
- Create: `src/prompts/tools.ts`
- Create: `__tests__/unit/prompts.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/unit/prompts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { roleSection, capabilitiesSection, schemaSection, workflowSection, outputSection, instructionsSection } from "../../src/prompts/sections.js";
import { buildSystemPrompt } from "../../src/prompts/system-prompt.js";
import { RUN_SQL_TOOL, FINISH_TOOL } from "../../src/prompts/tools.js";
import type { TableSchema } from "../../src/sql/types.js";

const schemas: TableSchema[] = [
  { name: "orders", columns: [{ name: "id", type: "INT" }, { name: "revenue", type: "FLOAT" }] },
];

describe("sections", () => {
  it("roleSection describes the assistant", () => {
    expect(roleSection()).toContain("NL2SQL");
    expect(roleSection()).toContain("SQL");
  });

  it("capabilitiesSection mentions identifier bracketing", () => {
    expect(capabilitiesSection()).toContain("bracketed identifiers");
  });

  it("schemaSection includes the table", () => {
    const s = schemaSection({ schemas, samples: undefined, relationships: undefined });
    expect(s).toContain("TABLE [orders]");
    expect(s).toContain("revenue");
  });

  it("workflowSection mentions plan/query/verify/answer", () => {
    const w = workflowSection();
    expect(w).toContain("plan");
    expect(w).toContain("run_sql");
    expect(w).toContain("finish");
  });

  it("outputSection includes English defaults", () => {
    expect(outputSection({ language: "en" })).toContain("English");
  });

  it("instructionsSection passes through custom instructions", () => {
    expect(instructionsSection("Custom: always cite sources.")).toContain("cite sources");
  });
});

describe("buildSystemPrompt", () => {
  it("assembles all sections", () => {
    const p = buildSystemPrompt({
      schemas,
      dialectHints: {},
      language: "en",
    });
    expect(p).toContain("NL2SQL");
    expect(p).toContain("TABLE [orders]");
    expect(p).toContain("run_sql");
  });

  it("includes samples when provided", () => {
    const p = buildSystemPrompt({
      schemas,
      dialectHints: {},
      language: "en",
      samples: { orders: [{ id: 1, revenue: 100 }] },
    });
    expect(p).toContain("Sample rows");
  });
});

describe("tools", () => {
  it("run_sql tool has correct shape", () => {
    expect(RUN_SQL_TOOL.name).toBe("run_sql");
    expect(RUN_SQL_TOOL.parameters).toMatchObject({
      type: "object",
      properties: { sql: {}, purpose: {}, explanation: {} },
      required: ["sql", "purpose", "explanation"],
    });
  });

  it("finish tool has correct shape", () => {
    expect(FINISH_TOOL.name).toBe("finish");
    expect(FINISH_TOOL.parameters).toMatchObject({
      type: "object",
      properties: { answer: {}, sql: {}, explanation: {} },
      required: ["answer", "sql", "explanation"],
    });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- prompts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement prompt tools**

Create `src/prompts/tools.ts`:

```ts
import type { ToolDefinition } from "../llm/types.js";

export const RUN_SQL_TOOL: ToolDefinition = {
  name: "run_sql",
  description: "Run a SQL query against the database. Use this to collect data before answering.",
  parameters: {
    type: "object",
    properties: {
      sql: {
        type: "string",
        description: "A single SQL-92 SELECT statement using bracketed identifiers for reserved-word-named columns.",
      },
      purpose: {
        type: "string",
        description: "One sentence: what question does this query answer?",
      },
      explanation: {
        type: "string",
        description: "Why you chose these tables/columns.",
      },
    },
    required: ["sql", "purpose", "explanation"],
  },
};

export const FINISH_TOOL: ToolDefinition = {
  name: "finish",
  description: "Submit the final answer after running at least one SQL query.",
  parameters: {
    type: "object",
    properties: {
      answer: {
        type: "string",
        description: "Final natural-language answer to the user's question.",
      },
      sql: {
        type: "string",
        description: "The canonical SQL that produced the data you are reporting.",
      },
      explanation: {
        type: "string",
        description: "Brief explanation of why this SQL answers the question.",
      },
    },
    required: ["answer", "sql", "explanation"],
  },
};

export const ALL_TOOLS: ToolDefinition[] = [RUN_SQL_TOOL, FINISH_TOOL];
```

- [ ] **Step 4: Implement prompt sections**

Create `src/prompts/sections.ts`:

```ts
import type { TableSchema } from "../sql/types.js";
import { buildSchemaDescription, buildSchemaWithSamples } from "../schema/describe.js";
import { buildRelationshipHints } from "../schema/relationships.js";

export interface SchemaSectionInput {
  schemas: TableSchema[];
  samples?: Record<string, Record<string, unknown>[]>;
  relationships?: string;
}

export function roleSection(): string {
  return `# Role

You are an NL2SQL assistant. Your job is to translate natural-language
questions into SQL queries, run them against the user's database, and
report concise, accurate answers. You never fabricate data — every number
in your final answer must come from a query you executed.`;
}

export function capabilitiesSection(): string {
  return `# Capabilities & SQL Dialect

- Database: SQL-92 compatible (similar to SQLite / AlaSQL).
- Identifiers: use [bracketed identifiers] for table names, column names,
  and aliases that collide with SQL reserved words (e.g., [VALUE], [COUNT]).
- Column names are CASE-SENSITIVE. Match the casing shown in the schema.
- Default LIMIT 200 on SELECTs unless aggregating.
- Use AS for aliases. Avoid reserved words as aliases when possible.`;
}

export function schemaSection(input: SchemaSectionInput): string {
  const description =
    input.samples != null
      ? buildSchemaWithSamples(input.schemas, input.samples)
      : buildSchemaDescription(input.schemas);
  const hints = buildRelationshipHints(input.schemas, input.relationships);
  return `# Database Schema\n\n${description}${hints ? `\n\n# Relationship Hints\n\n${hints}` : ""}`;
}

export function workflowSection(): string {
  return `# Workflow

Follow this plan→query→verify→answer loop:

1. PLAN (optional): internally reason about which tables and columns to query
2. QUERY: call the \`run_sql\` tool with a SQL SELECT statement. You may issue
   multiple \`run_sql\` calls in one turn for independent queries — they run in
   parallel and all results come back together.
3. VERIFY: review the returned results. If columns are missing, numbers look
   off, or the result doesn't answer the question, run more queries.
4. ANSWER: when you have the data you need, call \`finish\` with the final
   answer, canonical SQL, and a brief explanation.

# Rules

- You MUST call \`run_sql\` at least once before calling \`finish\`.
- Never report numbers from memory or reasoning — only from query results.
- If a query returns an error, fix the SQL and retry.
- If you receive a "warnings" list in a tool result, consider running a
  follow-up query to confirm before finishing.`;
}

export function outputSection(opts: { language: string }): string {
  if (opts.language === "en") {
    return `# Output Format

- Answer in English.
- Cite specific numbers from the query results.
- Round to two decimal places unless precision is requested.
- Do not use markdown tables. Prefer short prose.
- If no data matches, say so explicitly — do not fabricate.`;
  }
  return `# Output Format

- Answer in the locale corresponding to language code "${opts.language}".
- Use locale-appropriate number formatting and units.
- Cite specific numbers from the query results.
- Do not use markdown tables. Prefer short prose.`;
}

export function instructionsSection(customInstructions: string): string {
  return `# Additional Instructions\n\n${customInstructions}`;
}
```

- [ ] **Step 5: Implement buildSystemPrompt**

Create `src/prompts/system-prompt.ts`:

```ts
import type { TableSchema } from "../sql/types.js";
import {
  roleSection,
  capabilitiesSection,
  schemaSection,
  workflowSection,
  outputSection,
  instructionsSection,
} from "./sections.js";

export interface PromptContext {
  schemas: TableSchema[];
  samples?: Record<string, Record<string, unknown>[]>;
  relationships?: string;
  dialectHints?: Record<string, unknown>;
  language: string;
  instructions?: string;
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const sections: string[] = [
    roleSection(),
    capabilitiesSection(),
    schemaSection({
      schemas: ctx.schemas,
      samples: ctx.samples,
      relationships: ctx.relationships,
    }),
    workflowSection(),
    outputSection({ language: ctx.language }),
  ];
  if (ctx.instructions) {
    sections.push(instructionsSection(ctx.instructions));
  }
  return sections.join("\n\n\n");
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- prompts
```

Expected: ALL PASS.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat(prompts): composable sections + system prompt assembler"
```

---

## Task 10: Static SQL Provider

**Files:**
- Create: `src/sql/static-provider.ts`
- Create: `__tests__/unit/static-provider.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/unit/static-provider.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createStaticSqlProvider } from "../../src/sql/static-provider.js";
import type { TableSchema, QueryResultData } from "../../src/sql/types.js";

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
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- static-provider
```

Expected: FAIL.

- [ ] **Step 3: Implement createStaticSqlProvider**

Create `src/sql/static-provider.ts`:

```ts
import type {
  SqlProvider,
  StaticSqlProviderInput,
  TableSchema,
  QueryResultData,
} from "./types.js";

export function createStaticSqlProvider(input: StaticSqlProviderInput): SqlProvider {
  const schemaMap = new Map<string, TableSchema>();
  for (const s of input.schemas) schemaMap.set(s.name.toLowerCase(), s);

  return {
    async listSchemas(): Promise<TableSchema[]> {
      return input.schemas;
    },

    async getSchema(name: string): Promise<TableSchema> {
      const s = schemaMap.get(name.toLowerCase());
      if (!s) {
        throw new Error(
          `Schema "${name}" not found. Available: ${input.schemas.map((s) => s.name).join(", ")}`
        );
      }
      return s;
    },

    async getSamples(name: string, limit: number): Promise<Record<string, unknown>[]> {
      const rows = input.samples?.[name] ?? [];
      return rows.slice(0, limit);
    },

    async execute(sql: string): Promise<QueryResultData> {
      return input.executeSQL(sql);
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- static-provider
```

Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(sql): static SQL provider"
```

---

## Task 11: AlaSQL Provider

**Files:**
- Create: `src/sql/alasql-provider.ts`
- Modify: `package.json` (peer dep)
- Create: `__tests__/unit/alasql-provider.test.ts`

- [ ] **Step 1: Install alasql as dev dependency and peer dependency**

Run:

```bash
npm install -D alasql@^4
npm pkg set peerDependencies.alasql="^4"
npm pkg set peerDependenciesMeta.alasql='{"optional":true}'
```

Expected: `package.json` now has `peerDependencies` with `alasql` listed as optional.

- [ ] **Step 2: Write failing tests**

Create `__tests__/unit/alasql-provider.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createAlaSqlProvider } from "../../src/sql/alasql-provider.js";

const tables = {
  customers: [
    { id: 1, name: "Acme", region: "North" },
    { id: 2, name: "Globex", region: "South" },
    { id: 3, name: "Initech", region: "North" },
  ],
  orders: [
    { id: 100, customer_id: 1, revenue: 500 },
    { id: 101, customer_id: 2, revenue: 1000 },
    { id: 102, customer_id: 1, revenue: 200 },
  ],
};

describe("createAlaSqlProvider", () => {
  it("lists schemas from tables", async () => {
    const p = createAlaSqlProvider({ tables });
    const schemas = await p.listSchemas();
    const names = schemas.map((s) => s.name).sort();
    expect(names).toEqual(["customers", "orders"]);
  });

  it("gets schema for a specific table", async () => {
    const p = createAlaSqlProvider({ tables });
    const s = await p.getSchema("customers");
    expect(s.name).toBe("customers");
    const colNames = s.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("name");
    expect(colNames).toContain("region");
  });

  it("reports rowCount", async () => {
    const p = createAlaSqlProvider({ tables });
    const s = await p.getSchema("customers");
    expect(s.rowCount).toBe(3);
  });

  it("returns sample rows", async () => {
    const p = createAlaSqlProvider({ tables });
    const rows = await p.getSamples("customers", 2);
    expect(rows.length).toBe(2);
    expect(rows[0]).toMatchObject({ id: 1 });
  });

  it("executes SELECT and returns rows", async () => {
    const p = createAlaSqlProvider({ tables });
    const r = await p.execute("SELECT COUNT(*) AS n FROM customers");
    expect(r.rows[0]?.n).toBe(3);
  });

  it("handles SQL execution errors gracefully", async () => {
    const p = createAlaSqlProvider({ tables });
    const r = await p.execute("SELECT * FROM nonexistent_table");
    expect(r.error).toBeTruthy();
  });

  it("handles WHERE clause", async () => {
    const p = createAlaSqlProvider({ tables });
    const r = await p.execute("SELECT id FROM customers WHERE region = 'North'");
    expect(r.rows.length).toBe(2);
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npm test -- alasql-provider
```

Expected: FAIL.

- [ ] **Step 4: Implement createAlaSqlProvider**

Create `src/sql/alasql-provider.ts`:

```ts
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

async function loadAlaSql(): Promise<AlaSqlModule> {
  if (!alaSqlPromise) {
    alaSqlPromise = import("alasql").then((mod: unknown) => {
      const alaSql = (mod as { default: AlaSqlModule }).default ?? (mod as AlaSqlModule);
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
        if (rows.length > 0) {
          const columns = Object.keys(rows[0]!);
          const colDefs = columns.map((c) => `[${c}]`).join(", ");
          alasql(`CREATE TABLE [${tableName}] (${colDefs});`);
          for (const row of rows) {
            const placeholders = columns.map(() => "?").join(", ");
            alasql(`INSERT INTO [${tableName}] VALUES (${placeholders});`, columns.map((c) => row[c]));
          }
        } else {
          alasql(`CREATE TABLE [${tableName}];`);
        }
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
      const alasql = await ensureLoaded();
      return Object.entries(input.tables).map(([name, rows]) => ({
        name,
        columns: inferColumns(rows),
        rowCount: rows.length,
      }));
    },

    async getSchema(name: string): Promise<TableSchema> {
      const rows = input.tables[name];
      if (!rows) {
        throw new Error(`Table "${name}" not found. Available: ${Object.keys(input.tables).join(", ")}`);
      }
      return {
        name,
        columns: inferColumns(rows),
        rowCount: rows.length,
      };
    },

    async getSamples(name: string, limit: number): Promise<Record<string, unknown>[]> {
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
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- alasql-provider
```

Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(sql): AlaSQL reference provider"
```

---

## Task 12: OpenAI Adapter

**Files:**
- Modify: `package.json` (peer dep: openai)
- Create: `src/llm/openai-adapter.ts`
- Create: `__tests__/unit/openai-adapter.test.ts`

- [ ] **Step 1: Install openai as dev dep and declare peer**

Run:

```bash
npm install -D openai@^4
npm pkg set peerDependencies.openai="^4"
```

- [ ] **Step 2: Write failing tests**

Create `__tests__/unit/openai-adapter.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createOpenAiProvider } from "../../src/llm/openai-adapter.js";
import type { ToolDefinition } from "../../src/llm/types.js";

function makeMockOpenAI(responses: unknown[]) {
  let i = 0;
  return {
    chat: {
      completions: {
        create: vi.fn(async () => responses[i++] ?? responses[responses.length - 1]),
      },
    },
  };
}

const tools: ToolDefinition[] = [
  {
    name: "run_sql",
    description: "Run SQL",
    parameters: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"] },
  },
];

describe("createOpenAiProvider", () => {
  it("translates ChatMessage[] to OpenAI format", async () => {
    const mock = makeMockOpenAI([
      {
        choices: [{ message: { role: "assistant", content: null, tool_calls: [] } }],
      },
    ]);
    const provider = createOpenAiProvider(mock as never, { model: "gpt-4o-mini" });

    await provider.chat({
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "hi" },
      ],
      tools,
    });

    const callArgs = mock.chat.completions.create.mock.calls[0]![0];
    expect(callArgs.model).toBe("gpt-4o-mini");
    expect(callArgs.messages[0]).toEqual({ role: "system", content: "sys" });
    expect(callArgs.messages[1]).toEqual({ role: "user", content: "hi" });
  });

  it("parses tool_calls from response", async () => {
    const mock = makeMockOpenAI([
      {
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "run_sql",
                    arguments: '{"sql":"SELECT 1","purpose":"x","explanation":"y"}',
                  },
                },
              ],
            },
          },
        ],
      },
    ]);
    const provider = createOpenAiProvider(mock as never, { model: "gpt-4o-mini" });
    const resp = await provider.chat({ messages: [], tools });

    expect(resp.role).toBe("assistant");
    expect(resp.content).toBe(null);
    expect(resp.toolCalls).toEqual([
      {
        id: "call_1",
        name: "run_sql",
        arguments: { sql: "SELECT 1", purpose: "x", explanation: "y" },
      },
    ]);
  });

  it("includes tool definitions in OpenAI format", async () => {
    const mock = makeMockOpenAI([
      { choices: [{ message: { role: "assistant", content: "ok", tool_calls: [] } }] },
    ]);
    const provider = createOpenAiProvider(mock as never, { model: "gpt-4o-mini" });
    await provider.chat({ messages: [], tools });

    const callArgs = mock.chat.completions.create.mock.calls[0]![0];
    expect(callArgs.tools).toEqual([
      {
        type: "function",
        function: {
          name: "run_sql",
          description: "Run SQL",
          parameters: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"] },
        },
      },
    ]);
  });

  it("passes through temperature and signal", async () => {
    const mock = makeMockOpenAI([
      { choices: [{ message: { role: "assistant", content: "ok", tool_calls: [] } }] },
    ]);
    const controller = new AbortController();
    const provider = createOpenAiProvider(mock as never, { model: "gpt-4o-mini", temperature: 0.2 });
    await provider.chat({ messages: [], tools, temperature: 0.5, signal: controller.signal });

    const callArgs = mock.chat.completions.create.mock.calls[0]![0];
    expect(callArgs.temperature).toBe(0.5);
    expect(callArgs.signal).toBe(controller.signal);
  });

  it("passes assistant content back when no tool_calls", async () => {
    const mock = makeMockOpenAI([
      { choices: [{ message: { role: "assistant", content: "hello", tool_calls: [] } }] },
    ]);
    const provider = createOpenAiProvider(mock as never, { model: "gpt-4o-mini" });
    const resp = await provider.chat({ messages: [], tools });
    expect(resp.content).toBe("hello");
    expect(resp.toolCalls).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npm test -- openai-adapter
```

Expected: FAIL.

- [ ] **Step 4: Implement createOpenAiProvider**

Create `src/llm/openai-adapter.ts`:

```ts
import type OpenAI from "openai";
import type {
  LlmProvider,
  ChatOptions,
  AssistantMessage,
  ToolCall,
  ToolDefinition,
  ChatMessage,
} from "./types.js";

export interface CreateOpenAiProviderOptions {
  model: string;
  temperature?: number;
}

export function createOpenAiProvider(
  client: OpenAI,
  options: CreateOpenAiProviderOptions
): LlmProvider {
  return {
    async chat(input: ChatOptions): Promise<AssistantMessage> {
      const response = await client.chat.completions.create({
        model: options.model,
        messages: toOpenAiMessages(input.messages),
        tools: input.tools.map(toOpenAiTool),
        temperature: input.temperature ?? options.temperature ?? 0.1,
        signal: input.signal,
      } as parameters);
      const choice = response.choices[0];
      if (!choice) {
        throw new Error("OpenAI returned no choices");
      }
      const msg = choice.message;
      const toolCalls: ToolCall[] = (msg.tool_calls ?? []).map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: safeParseArguments(tc.function.arguments),
      }));
      return {
        role: "assistant",
        content: msg.content ?? null,
        toolCalls,
      };
    },
  };
}

type OpenAiParameters = Parameters<OpenAI["chat"]["completions"]["create"]>[0];
const parameters: OpenAiParameters = {} as never;

function toOpenAiMessages(messages: ChatMessage[]): unknown[] {
  return messages.map((m) => {
    if (m.role === "system") return { role: "system", content: m.content };
    if (m.role === "user") return { role: "user", content: m.content };
    if (m.role === "assistant") {
      return {
        role: "assistant",
        content: m.content,
        tool_calls: m.toolCalls?.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      };
    }
    return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
  });
}

function toOpenAiTool(tool: ToolDefinition): unknown {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

function safeParseArguments(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { _raw: raw };
  }
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- openai-adapter
```

Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(llm): OpenAI provider adapter"
```

---

## Task 13: History Reducer

**Files:**
- Create: `src/pipeline/history.ts`
- Create: `__tests__/unit/history.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/unit/history.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { defaultHistoryReducer } from "../../src/pipeline/history.js";
import type { ChatMessage } from "../../src/llm/types.js";

describe("defaultHistoryReducer", () => {
  it("returns messages unchanged when under max", () => {
    const msgs: ChatMessage[] = [
      { role: "system", content: "s" },
      { role: "user", content: "u1" },
    ];
    expect(defaultHistoryReducer(msgs, 8)).toEqual(msgs);
  });

  it("keeps system message + last N", () => {
    const msgs: ChatMessage[] = [
      { role: "system", content: "s" },
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1", toolCalls: [] },
      { role: "tool", content: "t1", toolCallId: "1" },
      { role: "user", content: "u2" },
      { role: "assistant", content: "a2", toolCalls: [] },
      { role: "tool", content: "t2", toolCallId: "2" },
      { role: "user", content: "u3" },
      { role: "assistant", content: "a3", toolCalls: [] },
    ];
    const out = defaultHistoryReducer(msgs, 4);
    expect(out[0]).toEqual({ role: "system", content: "s" });
    expect(out.length).toBeLessThanOrEqual(5);
    expect(out[out.length - 1]).toEqual({ role: "assistant", content: "a3", toolCalls: [] });
  });

  it("preserves tool messages with their assistant counterpart", () => {
    const msgs: ChatMessage[] = [
      { role: "system", content: "s" },
      { role: "user", content: "u" },
      { role: "assistant", content: null, toolCalls: [{ id: "1", name: "run_sql", arguments: {} }] },
      { role: "tool", content: "result", toolCallId: "1" },
      { role: "user", content: "u2" },
      { role: "assistant", content: null, toolCalls: [{ id: "2", name: "run_sql", arguments: {} }] },
      { role: "tool", content: "result2", toolCallId: "2" },
    ];
    const out = defaultHistoryReducer(msgs, 2);
    for (const m of out) {
      if (m.role === "tool") {
        const hasAssistant = out.some(
          (x) => x.role === "assistant" && x.toolCalls?.some((tc) => tc.id === m.toolCallId)
        );
        expect(hasAssistant).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- history
```

Expected: FAIL.

- [ ] **Step 3: Implement defaultHistoryReducer**

Create `src/pipeline/history.ts`:

```ts
import type { ChatMessage } from "../llm/types.js";

export function defaultHistoryReducer(
  messages: ChatMessage[],
  max: number
): ChatMessage[] {
  if (messages.length <= max) return messages;

  const system = messages.filter((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");

  const trimmed = nonSystem.slice(nonSystem.length - max);

  const toolCallIds = new Set<string>();
  for (const m of trimmed) {
    if (m.role === "assistant" && m.toolCalls) {
      for (const tc of m.toolCalls) toolCallIds.add(tc.id);
    }
  }

  const deduped: ChatMessage[] = [];
  for (const m of trimmed) {
    if (m.role === "tool" && !toolCallIds.has(m.toolCallId)) continue;
    deduped.push(m);
  }

  return [...system, ...deduped];
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- history
```

Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(pipeline): default history reducer"
```

---

## Task 14: Pipeline Loop

**Files:**
- Create: `src/pipeline/loop.ts`
- Create: `__tests__/integration/pipeline.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/integration/pipeline.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { runPipeline } from "../../src/pipeline/loop.js";
import { createStaticSqlProvider } from "../../src/sql/static-provider.js";
import { buildSystemPrompt } from "../../src/prompts/system-prompt.js";
import { ALL_TOOLS } from "../../src/prompts/tools.js";
import type { LlmProvider, AssistantMessage, ChatOptions, ToolCall } from "../../src/llm/types.js";
import type { TableSchema } from "../../src/sql/types.js";

function makeMockProvider(scripts: AssistantMessage[]): LlmProvider & { calls: number } {
  let i = 0;
  return {
    calls: 0,
    async chat(opts: ChatOptions): Promise<AssistantMessage> {
      this.calls++;
      return scripts[i++] ?? scripts[scripts.length - 1]!;
    },
  } as LlmProvider & { calls: number };
}

const schemas: TableSchema[] = [
  {
    name: "orders",
    columns: [
      { name: "id", type: "INT" },
      { name: "customer", type: "STRING" },
      { name: "revenue", type: "FLOAT" },
    ],
  },
];

function sqlResult(rows: Record<string, unknown>[]) {
  return { columns: Object.keys(rows[0] ?? {}), rows };
}

describe("runPipeline", () => {
  it("runs SQL then finishes", async () => {
    const scripts: AssistantMessage[] = [
      {
        role: "assistant",
        content: null,
        toolCalls: [
          {
            id: "1",
            name: "run_sql",
            arguments: { sql: "SELECT customer, revenue FROM orders ORDER BY revenue DESC LIMIT 1", purpose: "top customer", explanation: "rank by revenue" },
          },
        ],
      },
      {
        role: "assistant",
        content: null,
        toolCalls: [
          {
            id: "2",
            name: "finish",
            arguments: { answer: "Acme is the top customer with $1000.", sql: "SELECT customer, revenue FROM orders ORDER BY revenue DESC LIMIT 1", explanation: "Sorted by revenue descending" },
          },
        ],
      },
    ];
    const provider = makeMockProvider(scripts);
    const sqlProvider = createStaticSqlProvider({
      schemas,
      executeSQL: async () => sqlResult([{ customer: "Acme", revenue: 1000 }]),
    });

    const result = await runPipeline({
      llm: provider,
      sqlProvider,
      systemPrompt: buildSystemPrompt({ schemas, language: "en" }),
      question: "Who is the top customer by revenue?",
      maxSteps: 10,
      tools: ALL_TOOLS,
    });

    expect(result.answer).toContain("Acme");
    expect(result.sql).toContain("SELECT");
    expect(result.steps.length).toBe(1);
    expect(result.steps[0]?.result.rows[0]?.customer).toBe("Acme");
  });

  it("blocks finish before any run_sql", async () => {
    const scripts: AssistantMessage[] = [
      {
        role: "assistant",
        content: null,
        toolCalls: [{ id: "1", name: "finish", arguments: { answer: "guess", sql: "SELECT 1", explanation: "x" } }],
      },
      {
        role: "assistant",
        content: null,
        toolCalls: [
          { id: "2", name: "run_sql", arguments: { sql: "SELECT * FROM orders", purpose: "x", explanation: "y" } },
        ],
      },
      {
        role: "assistant",
        content: null,
        toolCalls: [{ id: "3", name: "finish", arguments: { answer: "ok", sql: "SELECT * FROM orders", explanation: "y" } }],
      },
    ];
    const provider = makeMockProvider(scripts);
    const sqlProvider = createStaticSqlProvider({
      schemas,
      executeSQL: async () => sqlResult([{ id: 1, customer: "A", revenue: 100 }]),
    });

    const result = await runPipeline({
      llm: provider,
      sqlProvider,
      systemPrompt: "sys",
      question: "q",
      maxSteps: 10,
      tools: ALL_TOOLS,
    });

    expect(result.answer).toBe("ok");
    expect(provider.calls).toBe(3);
  });

  it("handles hard-failed SQL by feeding error back to LLM", async () => {
    const scripts: AssistantMessage[] = [
      {
        role: "assistant",
        content: null,
        toolCalls: [
          { id: "1", name: "run_sql", arguments: { sql: "SELECT revenu FROM orders", purpose: "x", explanation: "y" } },
        ],
      },
      {
        role: "assistant",
        content: null,
        toolCalls: [
          { id: "2", name: "run_sql", arguments: { sql: "SELECT revenue FROM orders", purpose: "x", explanation: "y" } },
        ],
      },
      {
        role: "assistant",
        content: null,
        toolCalls: [{ id: "3", name: "finish", arguments: { answer: "ok", sql: "SELECT revenue FROM orders", explanation: "y" } }],
      },
    ];
    const provider = makeMockProvider(scripts);
    const sqlProvider = createStaticSqlProvider({
      schemas,
      executeSQL: async () => sqlResult([{ revenue: 100 }]),
    });

    const result = await runPipeline({
      llm: provider,
      sqlProvider,
      systemPrompt: "sys",
      question: "q",
      maxSteps: 10,
      tools: ALL_TOOLS,
    });

    expect(result.steps[0]?.result.error).toContain("revenu");
    expect(result.steps.length).toBe(2);
  });

  it("executes parallel sql calls in one turn", async () => {
    const scripts: AssistantMessage[] = [
      {
        role: "assistant",
        content: null,
        toolCalls: [
          { id: "1", name: "run_sql", arguments: { sql: "SELECT COUNT(*) AS n FROM orders", purpose: "x", explanation: "y" } },
          { id: "2", name: "run_sql", arguments: { sql: "SELECT MAX(revenue) AS m FROM orders", purpose: "x", explanation: "y" } },
        ],
      },
      {
        role: "assistant",
        content: null,
        toolCalls: [{ id: "3", name: "finish", arguments: { answer: "ok", sql: "SELECT 1", explanation: "y" } }],
      },
    ];
    const provider = makeMockProvider(scripts);
    const sqlProvider = createStaticSqlProvider({
      schemas,
      executeSQL: async (sql) => sqlResult([{ n: 5 }]),
    });

    const result = await runPipeline({
      llm: provider,
      sqlProvider,
      systemPrompt: "sys",
      question: "q",
      maxSteps: 10,
      tools: ALL_TOOLS,
    });

    expect(result.steps.length).toBe(2);
  });

  it("forces a final answer when maxSteps is exceeded", async () => {
    const scripts: AssistantMessage[] = Array.from({ length: 20 }, () => ({
      role: "assistant" as const,
      content: null as string | null,
      toolCalls: [{ id: "1", name: "run_sql", arguments: { sql: "SELECT 1", purpose: "x", explanation: "y" } }] as ToolCall[],
    }));
    scripts.push({
      role: "assistant",
      content: null,
      toolCalls: [{ id: "final", name: "finish", arguments: { answer: "out of steps", sql: "SELECT 1", explanation: "y" } }],
    });

    const provider = makeMockProvider(scripts);
    const sqlProvider = createStaticSqlProvider({
      schemas,
      executeSQL: async () => sqlResult([{ n: 1 }]),
    });

    const result = await runPipeline({
      llm: provider,
      sqlProvider,
      systemPrompt: "sys",
      question: "q",
      maxSteps: 3,
      tools: ALL_TOOLS,
    });

    expect(result.answer).toContain("out of steps");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- pipeline
```

Expected: FAIL.

- [ ] **Step 3: Implement runPipeline**

Create `src/pipeline/loop.ts`:

```ts
import type { LlmProvider, ChatMessage, ToolDefinition, AssistantMessage, ToolCall } from "../llm/types.js";
import type { SqlProvider, QueryResultData } from "../sql/types.js";
import type { Step, VerificationOutcome } from "./types.js";
import { verifySql } from "./verifier.js";
import { formatResultForLLM } from "./result-formatter.js";
import { defaultHistoryReducer } from "./history.js";
import type { QueryResult } from "../types.js";

export interface RunPipelineOptions {
  llm: LlmProvider;
  sqlProvider: SqlProvider;
  systemPrompt: string;
  question: string;
  maxSteps: number;
  tools: ToolDefinition[];
  maxRowsWarning?: number;
  allowNonSelect?: boolean;
  historyReducer?: (messages: ChatMessage[], max: number) => ChatMessage[];
  historyMax?: number;
  instructions?: string;
  callbacks?: {
    onStep?: (step: Step) => void;
    onFinalSQL?: (sql: string) => void;
    onAnswer?: (answer: string) => void;
    signal?: AbortSignal;
  };
}

export async function runPipeline(options: RunPipelineOptions): Promise<QueryResult> {
  const { llm, sqlProvider, systemPrompt, question, maxSteps, tools } = options;
  const reducer = options.historyReducer ?? defaultHistoryReducer;
  const historyMax = options.historyMax ?? 8;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
  ];

  const steps: Step[] = [];
  const schemas = await sqlProvider.listSchemas();
  let executedAtLeastOneSQL = false;

  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
    const trimmed = reducer(messages, historyMax);
    const response = await llm.chat({
      messages: trimmed,
      tools,
      signal: options.callbacks?.signal,
    });

    const toolCalls = response.toolCalls;
    const finishCall = toolCalls.find((tc) => tc.name === "finish");
    const sqlCalls = toolCalls.filter((tc) => tc.name === "run_sql");

    if (sqlCalls.length > 0 && !finishCall) {
      const callResults = await Promise.all(
        sqlCalls.map(async (tc) => {
          const sql = String(tc.arguments.sql ?? "");
          const verification = await verifySql({
            sql,
            schemas,
            allowNonSelect: options.allowNonSelect,
            maxRowsWarning: options.maxRowsWarning,
          });

          let result: QueryResultData;
          if (verification.hardFailures.length > 0) {
            result = { columns: [], rows: [], error: verification.hardFailures.join("; ") };
          } else {
            result = await sqlProvider.execute(sql);
            const reVerified = await verifySql({
              sql,
              schemas,
              result,
              allowNonSelect: options.allowNonSelect,
              maxRowsWarning: options.maxRowsWarning,
            });
            reVerified.columnRefs = verification.columnRefs;
            reVerified.hardFailures = verification.hardFailures;
            Object.assign(verification, reVerified);
          }

          return { call: tc, result, verification };
        })
      );

      executedAtLeastOneSQL = true;

      for (const r of callResults) {
        const step: Step = {
          sql: String(r.call.arguments.sql ?? ""),
          purpose: String(r.call.arguments.purpose ?? ""),
          explanation: String(r.call.arguments.explanation ?? ""),
          result: r.result,
          verification: r.verification,
        };
        steps.push(step);
        options.callbacks?.onStep?.(step);
      }

      messages.push(buildAssistantToolCallMessage(response));
      messages.push(...buildToolResultMessages(callResults));
      continue;
    }

    if (finishCall) {
      if (!executedAtLeastOneSQL) {
        messages.push({
          role: "assistant",
          content: response.content ?? "",
          toolCalls: [],
        });
        messages.push({
          role: "system",
          content: "You must call run_sql at least once before using finish.",
        });
        continue;
      }

      const finalSQL = String(finishCall.arguments.sql ?? "") || getLastSuccessfulSQL(steps);
      const finalAnswer = String(finishCall.arguments.answer ?? "");
      const finalExplanation = String(finishCall.arguments.explanation ?? "");
      options.callbacks?.onFinalSQL?.(finalSQL);
      options.callbacks?.onAnswer?.(finalAnswer);

      return {
        answer: finalAnswer,
        sql: finalSQL,
        explanation: finalExplanation,
        result: getLastSuccessfulResult(steps),
        steps,
      };
    }

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

  return forceFinalAnswer({
    llm,
    messages,
    steps,
    tools,
    signal: options.callbacks?.signal,
  });
}

interface CallResultEntry {
  call: ToolCall;
  result: QueryResultData;
  verification: VerificationOutcome;
}

function buildAssistantToolCallMessage(response: AssistantMessage): ChatMessage {
  return {
    role: "assistant",
    content: response.content,
    toolCalls: response.toolCalls,
  };
}

function buildToolResultMessages(entries: CallResultEntry[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const e of entries) {
    const text = formatResultForLLM(e.result);
    const warnings = e.verification.warnings.length > 0
      ? `\nwarnings: ${e.verification.warnings.map((w) => `- ${w}`).join("\n")}`
      : "";
    out.push({
      role: "tool",
      toolCallId: e.call.id,
      content: `${text}${warnings}`,
    });
  }
  return out;
}

function getLastSuccessfulSQL(steps: Step[]): string {
  for (let i = steps.length - 1; i >= 0; i--) {
    if (!steps[i]!.result.error) return steps[i]!.sql;
  }
  return steps.length > 0 ? steps[steps.length - 1]!.sql : "";
}

function getLastSuccessfulResult(steps: Step[]): QueryResultData | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    if (!steps[i]!.result.error) return steps[i]!.result;
  }
  return steps.length > 0 ? steps[steps.length - 1]!.result : null;
}

async function forceFinalAnswer(input: {
  llm: LlmProvider;
  messages: ChatMessage[];
  steps: Step[];
  tools: ToolDefinition[];
  signal?: AbortSignal;
}): Promise<QueryResult> {
  const messages = [...input.messages];
  messages.push({
    role: "system",
    content:
      "You have reached the step limit. Call `finish` now with the best answer from the data collected so far. Do not call run_sql.",
  });

  const response = await input.llm.chat({
    messages,
    tools: input.tools,
    signal: input.signal,
  });

  const finishCall = response.toolCalls.find((tc) => tc.name === "finish");
  const answerText = finishCall
    ? String(finishCall.arguments.answer ?? "Reached step limit before producing an answer.")
    : response.content ?? "Reached step limit before producing an answer.";
  const sqlText = finishCall ? String(finishCall.arguments.sql ?? "") : getLastSuccessfulSQL(input.steps);
  const explanation = finishCall ? String(finishCall.arguments.explanation ?? "") : "Reached step limit.";

  return {
    answer: answerText,
    sql: sqlText,
    explanation,
    result: getLastSuccessfulResult(input.steps),
    steps: input.steps,
  };
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- pipeline
```

Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(pipeline): runPipeline with verification loop"
```

---

## Task 15: Nl2SqlAgent Class + Public Exports

**Files:**
- Create: `src/agent.ts`
- Modify: `src/index.ts`
- Create: `__tests__/integration/agent.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/integration/agent.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Nl2SqlAgent } from "../../src/agent.js";
import type { LlmProvider, AssistantMessage, ChatOptions } from "../../src/llm/types.js";

function makeMockProvider(response: AssistantMessage): LlmProvider {
  return {
    async chat(_opts: ChatOptions): Promise<AssistantMessage> {
      return response;
    },
  };
}

describe("Nl2SqlAgent", () => {
  it("runs a query end-to-end", async () => {
    const provider: LlmProvider = makeMockProvider({
      role: "assistant",
      content: null,
      toolCalls: [
        {
          id: "1",
          name: "run_sql",
          arguments: {
            sql: "SELECT name FROM users",
            purpose: "list users",
            explanation: "direct query",
          },
        },
      ],
    });

    const agent = new Nl2SqlAgent({ provider, maxSteps: 5 });

    const result = await agent.query(
      "What users are there?",
      {
        schemas: [{ name: "users", columns: [{ name: "name", type: "STRING" }] }],
        executeSQL: async () => ({
          columns: ["name"],
          rows: [{ name: "Alice" }, { name: "Bob" }],
        }),
      }
    );

    expect(result.steps.length).toBe(1);
    expect(result.steps[0]?.result.rows[0]?.name).toBe("Alice");
  });

  it("supports a full SqlProvider instance", async () => {
    const provider: LlmProvider = makeMockProvider({
      role: "assistant",
      content: null,
      toolCalls: [
        {
          id: "1",
          name: "finish",
          arguments: {
            answer: "no SQL needed",
            sql: "SELECT 1",
            explanation: "already known",
          },
        },
      ],
    });

    const agent = new Nl2SqlAgent({ provider, maxSteps: 5 });

    const result = await agent.query("any q?", {
      sqlProvider: {
        listSchemas: async () => [{ name: "t", columns: [] }],
        getSchema: async () => ({ name: "t", columns: [] }),
        getSamples: async () => [],
        execute: async () => ({ columns: [], rows: [] }),
      },
    });

    expect(result.answer).toBe("no SQL needed");
  });

  it("honors maxSteps", async () => {
    let calls = 0;
    const provider: LlmProvider = {
      async chat(): Promise<AssistantMessage> {
        calls++;
        return {
          role: "assistant",
          content: null,
          toolCalls: [
            {
              id: "1",
              name: "run_sql",
              arguments: { sql: "SELECT 1", purpose: "x", explanation: "y" },
            },
          ],
        };
      },
    };

    const agent = new Nl2SqlAgent({ provider, maxSteps: 2 });
    await agent.query("q", {
      schemas: [{ name: "t", columns: [{ name: "x", type: "INT" }] }],
      executeSQL: async () => ({ columns: ["x"], rows: [{ x: 1 }] }),
    });

    expect(calls).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- agent
```

Expected: FAIL.

- [ ] **Step 3: Implement Nl2SqlAgent**

Create `src/agent.ts`:

```ts
import type {
  AgentConfig,
  QueryContext,
  QueryCallbacks,
  QueryResult,
  SqlProvider,
  StaticSqlProviderInput,
} from "./types.js";
import { runPipeline } from "./pipeline/loop.js";
import { buildSystemPrompt } from "./prompts/system-prompt.js";
import { ALL_TOOLS } from "./prompts/tools.js";
import { createStaticSqlProvider } from "./sql/static-provider.js";

const DEFAULT_MAX_STEPS = 20;
const DEFAULT_MAX_ROWS_WARNING = 500;

export class Nl2SqlAgent {
  private readonly config: Required<
    Pick<AgentConfig, "maxSteps" | "language">
  > &
    Pick<AgentConfig, "provider" | "historyReducer" | "sqlHints">;

  constructor(config: AgentConfig) {
    this.config = {
      provider: config.provider,
      maxSteps: config.maxSteps ?? DEFAULT_MAX_STEPS,
      language: config.language ?? "en",
      historyReducer: config.historyReducer,
      sqlHints: config.sqlHints,
    };
  }

  async query(
    question: string,
    context: QueryContext,
    callbacks?: QueryCallbacks
  ): Promise<QueryResult> {
    const sqlProvider = resolveSqlProvider(context);
    const schemas = await sqlProvider.listSchemas();

    const systemPrompt = buildSystemPrompt({
      schemas,
      samples: context.samples,
      relationships: context.relationships,
      language: this.config.language,
      instructions: context.instructions,
    });

    const mergedCallbacks: QueryCallbacks = {
      onStep: callbacks?.onStep,
      onFinalSQL: callbacks?.onFinalSQL,
      onAnswer: callbacks?.onAnswer,
      signal: callbacks?.signal,
    };

    return runPipeline({
      llm: this.config.provider,
      sqlProvider,
      systemPrompt,
      question,
      maxSteps: this.config.maxSteps,
      tools: ALL_TOOLS,
      maxRowsWarning: this.config.sqlHints?.maxRowsWarning ?? DEFAULT_MAX_ROWS_WARNING,
      allowNonSelect: this.config.sqlHints?.allowNonSelect,
      historyReducer: this.config.historyReducer,
      callbacks: mergedCallbacks,
    });
  }
}

function resolveSqlProvider(context: QueryContext): SqlProvider {
  if (context.sqlProvider) return context.sqlProvider;
  if (context.schemas && context.executeSQL) {
    const input: StaticSqlProviderInput = {
      schemas: context.schemas,
      executeSQL: context.executeSQL,
      samples: context.samples,
      relationships: context.relationships,
    };
    return createStaticSqlProvider(input);
  }
  throw new Error(
    "QueryContext requires either `sqlProvider` or both `schemas` and `executeSQL`."
  );
}
```

- [ ] **Step 4: Update src/index.ts with public exports**

Replace `src/index.ts`:

```ts
export { Nl2SqlAgent } from "./agent.js";
export { createOpenAiProvider } from "./llm/openai-adapter.js";
export type { CreateOpenAiProviderOptions } from "./llm/openai-adapter.js";
export { createStaticSqlProvider } from "./sql/static-provider.js";
export { createAlaSqlProvider } from "./sql/alasql-provider.js";
export { extractColumnRefs } from "./sql/tokenize.js";
export {
  buildSchemaDescription,
  buildSchemaWithSamples,
} from "./schema/describe.js";
export { buildRelationshipHints } from "./schema/relationships.js";
export { formatResultForLLM } from "./pipeline/result-formatter.js";
export { verifySql } from "./pipeline/verifier.js";
export { buildSystemPrompt } from "./prompts/system-prompt.js";
export { ALL_TOOLS, RUN_SQL_TOOL, FINISH_TOOL } from "./prompts/tools.js";
export { defaultHistoryReducer } from "./pipeline/history.js";

export type {
  AgentConfig,
  QueryContext,
  QueryCallbacks,
  QueryResult,
} from "./types.js";
export type {
  ChatMessage,
  LlmProvider,
  ToolCall,
  ToolDefinition,
  ChatOptions,
  AssistantMessage,
} from "./llm/types.js";
export type {
  TableSchema,
  ColumnSchema,
  QueryResultData,
  SqlProvider,
  StaticSqlProviderInput,
  AlaSqlProviderInput,
} from "./sql/types.js";
export type { Step, VerificationOutcome, ColumnRef } from "./pipeline/types.js";
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test
```

Expected: ALL PASS.

- [ ] **Step 6: Verify build**

Run:

```bash
npm run build
```

Expected: `dist/index.mjs`, `dist/index.cjs`, and `dist/index.d.ts` are created.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: Nl2SqlAgent class + public exports"
```

---

## Task 16: Integration Test Fixtures

**Files:**
- Create: `__tests__/fixtures/top-customers.json`
- Create: `__tests__/integration/fixtures.test.ts`

- [ ] **Step 1: Create a fixture file**

Create `__tests__/fixtures/top-customers.json`:

```json
{
  "description": "Top customer by revenue",
  "schemas": [
    {
      "name": "orders",
      "columns": [
        { "name": "id", "type": "INT" },
        { "name": "customer", "type": "STRING" },
        { "name": "revenue", "type": "FLOAT" }
      ]
    }
  ],
  "question": "Who is the top customer by revenue?",
  "expectedAnswerContains": "Acme",
  "sqlResults": [
    { "columns": ["customer", "revenue"], "rows": [{ "customer": "Acme", "revenue": 1500 }] }
  ],
  "responses": [
    {
      "role": "assistant",
      "content": null,
      "toolCalls": [
        {
          "id": "c1",
          "name": "run_sql",
          "arguments": {
            "sql": "SELECT customer, revenue FROM orders ORDER BY revenue DESC LIMIT 1",
            "purpose": "find top customer",
            "explanation": "sorted desc"
          }
        }
      ]
    },
    {
      "role": "assistant",
      "content": null,
      "toolCalls": [
        {
          "id": "c2",
          "name": "finish",
          "arguments": {
            "answer": "Acme is the top customer with $1,500 in revenue.",
            "sql": "SELECT customer, revenue FROM orders ORDER BY revenue DESC LIMIT 1",
            "explanation": "highest revenue first"
          }
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Write fixtures test**

Create `__tests__/integration/fixtures.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Nl2SqlAgent } from "../../src/agent.js";
import { createStaticSqlProvider } from "../../src/sql/static-provider.js";
import type { LlmProvider, AssistantMessage, ChatOptions } from "../../src/llm/types.js";
import type { TableSchema, QueryResultData } from "../../src/sql/types.js";

interface Fixture {
  description: string;
  schemas: TableSchema[];
  question: string;
  expectedAnswerContains: string;
  sqlResults: QueryResultData[];
  responses: AssistantMessage[];
}

function loadFixture(name: string): Fixture {
  const path = resolve(__dirname, "../fixtures", name);
  return JSON.parse(readFileSync(path, "utf8")) as Fixture;
}

function makeScriptedProvider(responses: AssistantMessage[]): LlmProvider {
  let i = 0;
  return {
    async chat(_opts: ChatOptions): Promise<AssistantMessage> {
      return responses[i++] ?? responses[responses.length - 1]!;
    },
  };
}

describe("fixture: top-customers", () => {
  it("replays the recorded LLM trace", async () => {
    const fx = loadFixture("top-customers.json");

    const provider = makeScriptedProvider(fx.responses);
    let sqlCall = 0;
    const sqlProvider = createStaticSqlProvider({
      schemas: fx.schemas,
      executeSQL: async () => fx.sqlResults[sqlCall++] ?? fx.sqlResults[fx.sqlResults.length - 1]!,
    });

    const agent = new Nl2SqlAgent({ provider, maxSteps: 10 });
    const result = await agent.query(fx.question, { sqlProvider });

    expect(result.answer).toContain(fx.expectedAnswerContains);
    expect(result.steps.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run tests**

Run:

```bash
npm test -- fixtures
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "test: integration fixture for top-customers"
```

---

## Task 17: Browser Example

**Files:**
- Create: `examples/browser/package.json`
- Create: `examples/browser/index.html`
- Create: `examples/browser/src/main.ts`

- [ ] **Step 1: Create examples/browser/package.json**

Create `examples/browser/package.json`:

```json
{
  "name": "nl2sql-agent-browser-example",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "alasql": "^4",
    "nl2sql-agent": "file:../../",
    "openai": "^4"
  },
  "devDependencies": {
    "vite": "^5"
  }
}
```

- [ ] **Step 2: Create examples/browser/index.html**

Create `examples/browser/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>nl2sql-agent browser demo</title>
    <style>
      body {
        font-family: system-ui, sans-serif;
        max-width: 720px;
        margin: 2rem auto;
        padding: 0 1rem;
      }
      textarea {
        width: 100%;
        box-sizing: border-box;
        font: inherit;
        padding: 0.5rem;
      }
      button {
        margin-top: 0.5rem;
        padding: 0.5rem 1rem;
        cursor: pointer;
      }
      pre {
        background: #f4f4f5;
        padding: 1rem;
        border-radius: 4px;
        overflow-x: auto;
      }
      .step {
        border-left: 2px solid #888;
        padding-left: 1rem;
        margin: 0.5rem 0;
      }
    </style>
  </head>
  <body>
    <h1>nl2sql-agent browser demo</h1>
    <p>
      This demo loads a small in-memory dataset into AlaSQL and lets you ask
      natural-language questions. You need an OpenAI API key.
    </p>
    <label>
      OpenAI API key:
      <input id="api-key" type="password" placeholder="sk-..." style="width: 320px" />
    </label>
    <p>
      <textarea id="question" rows="2">Top 3 customers by revenue</textarea>
      <br />
      <button id="ask">Ask</button>
      <button id="stop">Stop</button>
    </p>
    <div id="output"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 3: Create examples/browser/src/main.ts**

Create `examples/browser/src/main.ts`:

```ts
import { Nl2SqlAgent, createOpenAiProvider, createAlaSqlProvider } from "nl2sql-agent";
import OpenAI from "openai";

const tables = {
  customers: [
    { id: 1, name: "Acme Corp", region: "North" },
    { id: 2, name: "Globex", region: "South" },
    { id: 3, name: "Initech", region: "North" },
  ],
  orders: [
    { id: 100, customer_id: 1, revenue: 5400 },
    { id: 101, customer_id: 2, revenue: 2300 },
    { id: 102, customer_id: 1, revenue: 1200 },
    { id: 103, customer_id: 3, revenue: 4100 },
  ],
};

const apiKeyInput = document.getElementById("api-key") as HTMLInputElement;
const questionInput = document.getElementById("question") as HTMLTextAreaElement;
const askButton = document.getElementById("ask") as HTMLButtonElement;
const stopButton = document.getElementById("stop") as HTMLButtonElement;
const output = document.getElementById("output") as HTMLDivElement;

let controller: AbortController | null = null;

askButton.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    alert("OpenAI API key required");
    return;
  }

  output.innerHTML = "<p>Thinking...</p>";
  controller = new AbortController();

  const agent = new Nl2SqlAgent({
    provider: createOpenAiProvider(
      new OpenAI({ apiKey, dangerouslyAllowBrowser: true }),
      { model: "gpt-4o-mini", temperature: 0.1 }
    ),
    maxSteps: 10,
  });

  try {
    const result = await agent.query(
      questionInput.value,
      { sqlProvider: createAlaSqlProvider({ tables }) },
      {
        signal: controller.signal,
        onStep: (step) => {
          const el = document.createElement("div");
          el.className = "step";
          el.innerHTML = `<strong>${escapeHtml(step.purpose)}</strong>
            <pre>${escapeHtml(step.sql)}</pre>
            <pre>${escapeHtml(JSON.stringify(step.result.rows, null, 2))}</pre>`;
          output.appendChild(el);
        },
      }
    );

    const answer = document.createElement("p");
    answer.innerHTML = `<strong>Answer:</strong> ${escapeHtml(result.answer)}`;
    output.appendChild(answer);
  } catch (e) {
    output.innerHTML = `<p style="color: red">Error: ${escapeHtml(e instanceof Error ? e.message : String(e))}</p>`;
  } finally {
    controller = null;
  }
});

stopButton.addEventListener("click", () => {
  controller?.abort();
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"
  );
}
```

- [ ] **Step 4: Verify example build**

Run:

```bash
cd examples/browser && npm install && npm run build
```

Expected: Vite builds without errors.

- [ ] **Step 5: Commit**

```bash
git add examples/browser
git commit -m "examples: browser demo with AlaSQL"
```

---

## Task 18: Node Example

**Files:**
- Create: `examples/node/package.json`
- Create: `examples/node/index.mjs`

- [ ] **Step 1: Create examples/node/package.json**

Create `examples/node/package.json`:

```json
{
  "name": "nl2sql-agent-node-example",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node index.mjs"
  },
  "dependencies": {
    "nl2sql-agent": "file:../../",
    "openai": "^4"
  }
}
```

- [ ] **Step 2: Create examples/node/index.mjs**

Create `examples/node/index.mjs`:

```js
import { Nl2SqlAgent, createOpenAiProvider, createStaticSqlProvider } from "nl2sql-agent";
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
```

- [ ] **Step 3: Commit**

```bash
git add examples/node
git commit -m "examples: Node ESM script"
```

---

## Task 19: Quality Tools (knip + publint + attw)

**Files:**
- Modify: `package.json`
- Create: `.knip.json`

- [ ] **Step 1: Install quality tools**

Run:

```bash
npm install -D knip@^5 publint@^0.2 @arethetypeswrong/cli@^0.15
```

- [ ] **Step 2: Create .knip.json**

Create `.knip.json`:

```json
{
  "entry": ["src/index.ts"],
  "project": ["src/**/*", "__tests__/**/*"],
  "ignore": ["examples/**", "dist/**", "coverage/**"]
}
```

- [ ] **Step 3: Add scripts to package.json**

Edit `package.json` scripts to add:

```json
{
  "scripts": {
    "knip": "knip",
    "publint": "publint",
    "attw": "attw --pack"
  }
}
```

- [ ] **Step 4: Verify knip passes**

Run:

```bash
npm run knip
```

Expected: No unused exports/dependencies.

- [ ] **Step 5: Verify publint passes after build**

Run:

```bash
npm run build && npm run publint
```

Expected: No issues.

- [ ] **Step 6: Verify attw passes**

Run:

```bash
npm run attw
```

Expected: No type resolution issues.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: knip + publint + attw quality gates"
```

---

## Task 20: README + Docs

**Files:**
- Create: `README.md`
- Create: `docs/getting-started.md`
- Create: `docs/custom-providers.md`
- Create: `docs/browser-security.md`

- [ ] **Step 1: Create README.md**

Create `README.md`:

````markdown
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
npm install nl2sql-agent openai
```

`openai` is a peer dependency when you use the bundled OpenAI adapter. If you implement your own `LlmProvider`, you don't need it.

## Quickstart

```ts
import { Nl2SqlAgent, createOpenAiProvider, createStaticSqlProvider } from "nl2sql-agent";
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
````

- [ ] **Step 2: Create docs/getting-started.md**

Create `docs/getting-started.md`:

```markdown
# Getting started with nl2sql-agent

## Install

```bash
npm install nl2sql-agent openai
```

## Create your first agent

```ts
import { Nl2SqlAgent, createOpenAiProvider, createStaticSqlProvider } from "nl2sql-agent";
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
```

- [ ] **Step 3: Create docs/custom-providers.md**

Create `docs/custom-providers.md`:

```markdown
# Custom providers

`nl2sql-agent` exposes two seams: `LlmProvider` and `SqlProvider`. Implement either to use any backend.

## Custom LlmProvider

```ts
import type { LlmProvider } from "nl2sql-agent";

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
import type { SqlProvider } from "nl2sql-agent";

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
```

- [ ] **Step 4: Create docs/browser-security.md**

Create `docs/browser-security.md`:

```markdown
# Browser security

The OpenAI SDK will refuse to run in a browser unless you pass
`dangerouslyAllowBrowser: true`. This is intentional — shipping your OpenAI
API key in a client bundle exposes it to anyone who opens devtools.

## When it's OK

- Local development.
- Internal-only tools behind authentication.
- Demos and prototypes.

## When it's NOT OK

- Public-facing apps.
- Any environment where untrusted users can inspect the bundle.

## What to do instead

Proxy requests through your own backend:

1. Backend endpoint that accepts `{ messages, tools }` from the client.
2. Backend injects `OPENAI_API_KEY` from environment and calls OpenAI.
3. Backend returns the response to the client.
4. Client implements `LlmProvider` to call your backend instead of OpenAI directly.

```ts
const proxyProvider: LlmProvider = {
  async chat({ messages, tools }) {
    const res = await fetch("/api/llm", {
      method: "POST",
      body: JSON.stringify({ messages, tools }),
    });
    return res.json();
  },
};
```
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "docs: README + getting-started + custom-providers + browser-security"
```

---

## Task 21: CI Workflows

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create .github/workflows/ci.yml**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - run: npm run knip
      - run: npm run publint
      - run: npm run attw
```

- [ ] **Step 2: Create .github/workflows/release.yml**

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    branches: [main]

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Create Release Pull Request or Publish
        uses: changesets/action@v1
        with:
          publish: npm run release
          version: npm run version
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
          NPM_CONFIG_PROVENANCE: true
```

- [ ] **Step 3: Commit**

```bash
git add .github
git commit -m "ci: github actions workflows"
```

---

## Self-Review Notes

After writing the full plan, cross-check against spec sections:

- **Section 1 (Overview)** — Tasks 1-3 scaffold the project; README/docs in Task 20 covers positioning.
- **Section 2 (Core Principles)** — Provider interfaces in Tasks 4-12; verification in Task 8; minimal-tokenizer in Task 5; official SDK in Task 12.
- **Section 3 (Architecture)** — File structure follows the spec's package layout.
- **Section 4 (Public API)** — `Nl2SqlAgent` in Task 15; types in Task 4; quickstart in Task 20.
- **Section 5 (Provider Interfaces)** — `LlmProvider` in Task 4; `SqlProvider` in Task 4; OpenAI adapter in Task 12; Static + AlaSQL in Tasks 10-11.
- **Section 6 (Pipeline)** — Loop in Task 14; tool definitions in Task 9.
- **Section 7 (Verification)** — Verifier in Task 8 with hard + advisory checks.
- **Section 8 (Prompt System)** — Sections + builder in Task 9.
- **Section 9 (Schema Description)** — Tasks 6 + 7.
- **Section 10 (Error Handling)** — Covered by pipeline tests in Task 14 (`forceFinalAnswer`, hard-failure feedback).
- **Section 11 (Testing)** — Unit tests in each TDD task; integration in Tasks 14-16.
- **Section 12 (Quality Infrastructure)** — TS strict in Task 1; linting in Task 2; CI in Task 21; changesets in Task 3; knip/publint/attw in Task 19; docs in Task 20.
- **Section 13 (Roadmap)** — v1.0.0 covered by Tasks 1-21; later versions explicitly out of scope here.

Note: `chatStream()` mentioned in spec section 5 future-tense; not in v1.0.0.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-06-nl2sql-agent-implementation.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans; batch execution with checkpoints.

**Which approach?**
