import { describe, it, expectTypeOf } from "vitest";
import type { AgentConfig, QueryContext, QueryResult } from "../../src/types.js";
import type { LlmProvider } from "../../src/llm/types.js";

describe("type contracts", () => {
  it("AgentConfig requires provider", () => {
    expectTypeOf<AgentConfig>().toMatchTypeOf<{ provider: LlmProvider }>();
  });

  it("QueryContext accepts static shape", () => {
    const ctx: QueryContext = {
      schemas: [{ name: "t", columns: [{ name: "id", type: "INTEGER" }] }],
      executeSQL: async () => ({ columns: [], rows: [] }), // eslint-disable-line @typescript-eslint/require-await
    };
    expectTypeOf(ctx).toMatchTypeOf<QueryContext>();
  });

  it("QueryResult has answer/sql/steps", () => {
    expectTypeOf<QueryResult>().toMatchTypeOf<{ answer: string; sql: string; steps: unknown[] }>();
  });
});
