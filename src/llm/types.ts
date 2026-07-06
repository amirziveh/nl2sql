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
