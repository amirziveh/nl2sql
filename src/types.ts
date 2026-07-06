import type { ChatMessage, LlmProvider } from "./llm/types.js";
import type {
  QueryResultData,
  SqlProvider,
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
