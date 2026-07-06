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

export const FINISH_TOOL: ToolDefinition = {
  name: "finish",
  description: "Submit the final answer after running at least one SQL query.",
  parameters: {
    type: "object",
    properties: {
      answer: {
        type: "string",
        description: "Final natural-language answer to the user's question.",
      },
      sql: {
        type: "string",
        description: "The canonical SQL that produced the data you are reporting.",
      },
      explanation: {
        type: "string",
        description: "Brief explanation of why this SQL answers the question.",
      },
    },
    required: ["answer", "sql", "explanation"],
  },
};

export const ALL_TOOLS: ToolDefinition[] = [RUN_SQL_TOOL, FINISH_TOOL];
