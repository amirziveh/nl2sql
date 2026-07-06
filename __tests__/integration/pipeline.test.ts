/* eslint-disable @typescript-eslint/require-await -- mock stubs return synchronously */
import { describe, it, expect } from "vitest";
import { runPipeline } from "../../src/pipeline/loop.js";
import { createStaticSqlProvider } from "../../src/sql/static-provider.js";
import { buildSystemPrompt } from "../../src/prompts/system-prompt.js";
import { ALL_TOOLS } from "../../src/prompts/tools.js";
import type { LlmProvider, AssistantMessage, ChatOptions, ToolCall } from "../../src/llm/types.js";
import type { TableSchema } from "../../src/sql/types.js";

function makeMockProvider(scripts: AssistantMessage[]): LlmProvider & { calls: number } {
  let i = 0;
  const last = (): AssistantMessage => {
    const fallback = scripts[scripts.length - 1];
    if (!fallback) throw new Error("makeMockProvider requires a non-empty scripts array");
    return fallback;
  };
  return {
    calls: 0,
    async chat(_opts: ChatOptions): Promise<AssistantMessage> {
      this.calls++;
      return scripts[i++] ?? last();
    },
  };
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
      executeSQL: async (_sql) => sqlResult([{ n: 5 }]),
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
