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

type ChatCompletion = OpenAI.Chat.Completions.ChatCompletion;

export function createOpenAiProvider(
  client: OpenAI,
  options: CreateOpenAiProviderOptions
): LlmProvider {
  return {
    async chat(input: ChatOptions): Promise<AssistantMessage> {
      if (input.onToken) {
        return chatStreaming(client, input, options);
      }
      return chatNonStreaming(client, input, options);
    },
  };
}

// ---------------------------------------------------------------------------
//  Non-streaming (original path)
// ---------------------------------------------------------------------------

async function chatNonStreaming(
  client: OpenAI,
  input: ChatOptions,
  options: CreateOpenAiProviderOptions
): Promise<AssistantMessage> {
  const params = toCreateParams(input, options);
  const response = (await client.chat.completions.create(
    params as Parameters<OpenAI["chat"]["completions"]["create"]>[0]
  )) as ChatCompletion;
  const choice = response.choices[0];
  if (!choice) {
    throw new Error("OpenAI returned no choices");
  }
  const msg = choice.message;
  const toolCalls: ToolCall[] = (msg.tool_calls ?? []).map((tc) => ({
    id: tc.id,
    name: (tc as any).function.name,
    arguments: safeParseArguments((tc as any).function.arguments),
  }));
  return {
    role: "assistant",
    content: msg.content ?? null,
    toolCalls,
  };
}

// ---------------------------------------------------------------------------
//  Streaming — forwards content tokens AND finish tool answer field tokens
// ---------------------------------------------------------------------------

async function chatStreaming(
  client: OpenAI,
  input: ChatOptions,
  options: CreateOpenAiProviderOptions
): Promise<AssistantMessage> {
  const params = {
    ...toCreateParams(input, options),
    stream: true,
  } as Record<string, unknown>;

  const stream = await (client.chat.completions.create as any)(params);

  let content = "";
  const toolStates = new Map<number, ToolCallState>();

  // Streaming extraction state for the finish tool's answer field
  let answerStreamed = 0; // chars of unescaped answer already forwarded

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;

    // 1. Forward content tokens
    if (delta.content) {
      content += delta.content;
      input.onToken!(delta.content);
    }

    // 2. Accumulate tool call arguments; stream finish answer field
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx: number = tc.index;
        if (!toolStates.has(idx)) {
          toolStates.set(idx, { id: "", name: "", argsStr: "" });
        }
        const state = toolStates.get(idx)!;
        if (tc.id) state.id = tc.id;
        if ((tc as any).function?.name) state.name = (tc as any).function.name;
        if ((tc as any).function?.arguments) {
          state.argsStr += (tc as any).function.arguments;

          if (state.name === "finish") {
            const extracted = extractAnswerField(state.argsStr);
            if (extracted.length > answerStreamed) {
              input.onToken!(extracted.slice(answerStreamed));
              answerStreamed = extracted.length;
            }
          }
        }
      }
    }
  }

  const toolCalls: ToolCall[] = Array.from(toolStates.entries())
    .sort(([a], [b]) => a - b)
    .map(([_, s]) => ({
      id: s.id,
      name: s.name,
      arguments: safeParseArguments(s.argsStr || "{}"),
    }));

  return { role: "assistant", content: content || null, toolCalls };
}

// ---------------------------------------------------------------------------
//  Incremental JSON answer extraction
// ---------------------------------------------------------------------------

/**
 * Extract the value of the "answer" field from a (possibly incomplete) JSON
 * string of tool-call arguments. Returns the unescaped value up to what's
 * available — the rest will arrive in subsequent chunks.
 */
function extractAnswerField(argsJson: string): string {
  // Match "answer": "..." — the (?:[^"\\]|\\.)*  captures everything inside
  // the string value, handling escaped chars, stopping at the closing quote.
  const match = argsJson.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (!match) return "";
  return unescapeJsonString(match[1]!);
}

/**
 * Unescape a JSON string value (the content between quotes). Stops cleanly on
 * incomplete escape sequences at the end (e.g. "\u06" with only 2 hex digits),
 * which will be completed in the next chunk.
 */
function unescapeJsonString(raw: string): string {
  let result = "";
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i]!;
    if (ch !== "\\") {
      result += ch;
      i += 1;
      continue;
    }
    // ch === "\\"
    if (i + 1 >= raw.length) break; // incomplete escape — wait for next chunk
    const next = raw[i + 1]!;
    switch (next) {
      case "n": result += "\n"; i += 2; break;
      case "t": result += "\t"; i += 2; break;
      case "r": result += "\r"; i += 2; break;
      case '"': result += '"'; i += 2; break;
      case "\\": result += "\\"; i += 2; break;
      case "/": result += "/"; i += 2; break;
      case "b": result += "\b"; i += 2; break;
      case "f": result += "\f"; i += 2; break;
      case "u": {
        if (i + 6 > raw.length) {
          // Incomplete \uXXXX — wait for next chunk
          i = raw.length; // break out of loop
        } else {
          const hex = raw.slice(i + 2, i + 6);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            result += String.fromCharCode(parseInt(hex, 16));
            i += 6;
          } else {
            result += next;
            i += 2;
          }
        }
        break;
      }
      default:
        result += next;
        i += 2;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
//  Shared helpers
// ---------------------------------------------------------------------------

interface ToolCallState {
  id: string;
  name: string;
  argsStr: string;
}

function toCreateParams(
  input: ChatOptions,
  options: CreateOpenAiProviderOptions
): Record<string, unknown> {
  return {
    model: options.model,
    messages: toOpenAiMessages(input.messages),
    tools: input.tools.map(toOpenAiTool),
    temperature: input.temperature ?? options.temperature ?? 0.1,
    signal: input.signal,
  };
}

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
