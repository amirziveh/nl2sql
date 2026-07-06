import type {
  AgentConfig,
  QueryContext,
  QueryCallbacks,
  QueryResult,
  SqlProvider,
  StaticSqlProviderInput,
} from "./types.js";
import { runPipeline } from "./pipeline/loop.js";
import { buildSystemPrompt } from "./prompts/system-prompt.js";
import { ALL_TOOLS } from "./prompts/tools.js";
import { createStaticSqlProvider } from "./sql/static-provider.js";

const DEFAULT_MAX_STEPS = 20;
const DEFAULT_MAX_ROWS_WARNING = 500;

export class Nl2SqlAgent {
  private readonly config: Required<
    Pick<AgentConfig, "maxSteps" | "language">
  > &
    Pick<AgentConfig, "provider" | "historyReducer" | "sqlHints">;

  constructor(config: AgentConfig) {
    this.config = {
      provider: config.provider,
      maxSteps: config.maxSteps ?? DEFAULT_MAX_STEPS,
      language: config.language ?? "en",
      historyReducer: config.historyReducer,
      sqlHints: config.sqlHints,
    };
  }

  async query(
    question: string,
    context: QueryContext,
    callbacks?: QueryCallbacks
  ): Promise<QueryResult> {
    const sqlProvider = resolveSqlProvider(context);
    const schemas = await sqlProvider.listSchemas();

    const systemPrompt = buildSystemPrompt({
      schemas,
      samples: context.samples,
      relationships: context.relationships,
      language: this.config.language,
      instructions: context.instructions,
    });

    const mergedCallbacks: QueryCallbacks = {
      onStep: callbacks?.onStep,
      onFinalSQL: callbacks?.onFinalSQL,
      onAnswer: callbacks?.onAnswer,
      signal: callbacks?.signal,
    };

    return runPipeline({
      llm: this.config.provider,
      sqlProvider,
      systemPrompt,
      question,
      maxSteps: this.config.maxSteps,
      tools: ALL_TOOLS,
      maxRowsWarning: this.config.sqlHints?.maxRowsWarning ?? DEFAULT_MAX_ROWS_WARNING,
      allowNonSelect: this.config.sqlHints?.allowNonSelect,
      historyReducer: this.config.historyReducer,
      callbacks: mergedCallbacks,
    });
  }
}

function resolveSqlProvider(context: QueryContext): SqlProvider {
  if (context.sqlProvider) return context.sqlProvider;
  if (context.schemas && context.executeSQL) {
    const input: StaticSqlProviderInput = {
      schemas: context.schemas,
      executeSQL: context.executeSQL,
      samples: context.samples,
      relationships: context.relationships,
    };
    return createStaticSqlProvider(input);
  }
  throw new Error(
    "QueryContext requires either `sqlProvider` or both `schemas` and `executeSQL`."
  );
}
