/* eslint-disable @typescript-eslint/require-await -- mock stubs return synchronously */
import { describe, it, expect, vi } from "vitest";
import { createOpenAiProvider } from "../../src/llm/openai-adapter.js";
import type { ToolDefinition } from "../../src/llm/types.js";

function makeMockOpenAI(responses: unknown[]) {
  let i = 0;
  return {
    chat: {
      completions: {
        // Parameter typed so mock.calls[0]![0] is well-defined under noUncheckedIndexedAccess.
        create: vi.fn(async (_body: any) => responses[i++] ?? responses[responses.length - 1]),
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
