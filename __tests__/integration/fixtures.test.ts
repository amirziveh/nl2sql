/* eslint-disable @typescript-eslint/require-await -- mock stubs return synchronously */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Nl2SqlAgent } from "../../src/agent.js";
import { createStaticSqlProvider } from "../../src/sql/static-provider.js";
import type { LlmProvider, AssistantMessage, ChatOptions } from "../../src/llm/types.js";
import type { TableSchema, QueryResultData } from "../../src/sql/types.js";

interface Fixture {
  description: string;
  schemas: TableSchema[];
  question: string;
  expectedAnswerContains: string;
  sqlResults: QueryResultData[];
  responses: AssistantMessage[];
}

function loadFixture(name: string): Fixture {
  const path = resolve(__dirname, "../fixtures", name);
  return JSON.parse(readFileSync(path, "utf8")) as Fixture;
}

function makeScriptedProvider(responses: AssistantMessage[]): LlmProvider {
  let i = 0;
  return {
    async chat(_opts: ChatOptions): Promise<AssistantMessage> {
      return responses[i++] ?? responses[responses.length - 1]!;
    },
  };
}

describe("fixture: top-customers", () => {
  it("replays the recorded LLM trace", async () => {
    const fx = loadFixture("top-customers.json");

    const provider = makeScriptedProvider(fx.responses);
    let sqlCall = 0;
    const sqlProvider = createStaticSqlProvider({
      schemas: fx.schemas,
      executeSQL: async () =>
        fx.sqlResults[sqlCall++] ?? fx.sqlResults[fx.sqlResults.length - 1]!,
    });

    const agent = new Nl2SqlAgent({ provider, maxSteps: 10 });
    const result = await agent.query(fx.question, { sqlProvider });

    expect(result.answer).toContain(fx.expectedAnswerContains);
    expect(result.steps.length).toBeGreaterThan(0);
  });
});
