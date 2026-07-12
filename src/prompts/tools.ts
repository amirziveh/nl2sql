import type { ToolDefinition } from "../llm/types.js";

export const RUN_SQL_TOOL: ToolDefinition = {
  name: "run_sql",
  description: "Run a SQL query against the database. Use this to collect data before answering.",
  parameters: {
    type: "object",
    properties: {
      sql: {
        type: "string",
        description: "A single SQL-92 SELECT statement using bracketed identifiers for reserved-word-named columns.",
      },
      purpose: {
        type: "string",
        description: "One sentence: what question does this query answer?",
      },
      explanation: {
        type: "string",
        description: "Why you chose these tables/columns.",
      },
    },
    required: ["sql", "purpose", "explanation"],
  },
};

export function buildFinishTool(requireSqlBeforeFinish: boolean): ToolDefinition {
  return {
    name: "finish",
    description: requireSqlBeforeFinish
      ? "Submit the final answer after running at least one SQL query."
      : "Submit the final answer. For data questions, run SQL first. For greetings or non-data messages, call finish directly with just the answer.",
    parameters: {
      type: "object",
      properties: {
        answer: {
          type: "string",
          description: "Final natural-language answer to the user's question.",
        },
        sql: {
          type: "string",
          description: "The canonical SQL that produced the data you are reporting. Omit if no SQL was needed.",
        },
        explanation: {
          type: "string",
          description: "Brief explanation of why this SQL answers the question. Omit if no SQL was needed.",
        },
      },
      required: requireSqlBeforeFinish
        ? ["answer", "sql", "explanation"]
        : ["answer"],
    },
  };
}

export function buildTools(requireSqlBeforeFinish: boolean): ToolDefinition[] {
  return [RUN_SQL_TOOL, buildFinishTool(requireSqlBeforeFinish)];
}

// ponytail: backwards-compat default for any existing consumer
export const FINISH_TOOL: ToolDefinition = buildFinishTool(true);
export const ALL_TOOLS: ToolDefinition[] = [RUN_SQL_TOOL, FINISH_TOOL];
