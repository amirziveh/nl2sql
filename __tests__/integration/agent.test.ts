/* eslint-disable @typescript-eslint/require-await -- mock stubs return synchronously */
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

// Deviation from verbatim plan (test 1 only): the verbatim `makeMockProvider`
// returns a STATIC `run_sql` response on every `chat` call. With `maxSteps: 5`
// the pipeline loop (src/pipeline/loop.ts, correct & reviewed in Task 14) would
// execute `run_sql` 5 times and never see a `finish`, yielding
// `result.steps.length === 5` and then falling through to `forceFinalAnswer`.
// The verbatim test asserts `result.steps.length === 1`. The verbatim mock
// forgot to return a `finish` on the second call.
// Per the task brief, the minimal intent-preserving fix is to make ONLY
// test 1's mock scripted (run_sql first, then finish) so both `expect()`
// assertions stay byte-identical. The pipeline implementation is NOT modified.
function makeScriptedProvider(scripts: AssistantMessage[]): LlmProvider {
  let i = 0;
  return {
    async chat(_opts: ChatOptions): Promise<AssistantMessage> {
      const last = scripts[scripts.length - 1];
      if (!last) throw new Error("makeScriptedProvider requires a non-empty scripts array");
      return scripts[i++] ?? last;
    },
  };
}

describe("Nl2SqlAgent", () => {
  it("runs a query end-to-end", async () => {
    const provider: LlmProvider = makeScriptedProvider([
      {
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
      },
      {
        role: "assistant",
        content: null,
        toolCalls: [
          {
            id: "2",
            name: "finish",
            arguments: {
              answer: "The users are Alice and Bob.",
              sql: "SELECT name FROM users",
              explanation: "list users",
            },
          },
        ],
      },
    ]);

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
