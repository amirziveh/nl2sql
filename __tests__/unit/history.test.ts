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
