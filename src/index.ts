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
  ColumnRef,
} from "./sql/types.js";
export type { Step, VerificationOutcome } from "./pipeline/types.js";
