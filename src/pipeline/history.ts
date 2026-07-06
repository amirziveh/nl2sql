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
