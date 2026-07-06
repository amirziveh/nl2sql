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
type ChatCompletionCreateParams =
  OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;

export function createOpenAiProvider(
  client: OpenAI,
  options: CreateOpenAiProviderOptions
): LlmProvider {
  return {
    async chat(input: ChatOptions): Promise<AssistantMessage> {
      const params: ChatCompletionCreateParams = toCreateParams(input, options);
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

function toCreateParams(
  input: ChatOptions,
  options: CreateOpenAiProviderOptions
): ChatCompletionCreateParams {
  return {
    model: options.model,
    messages: toOpenAiMessages(input.messages) as ChatCompletionCreateParams["messages"],
    tools: input.tools.map(toOpenAiTool) as ChatCompletionCreateParams["tools"],
    temperature: input.temperature ?? options.temperature ?? 0.1,
    signal: input.signal,
  } as unknown as ChatCompletionCreateParams;
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
