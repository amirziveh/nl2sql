import { Nl2SqlAgent, createOpenAiProvider, createAlaSqlProvider } from "nl2sql-agent";
import OpenAI from "openai";

const tables = {
  customers: [
    { id: 1, name: "Acme Corp", region: "North" },
    { id: 2, name: "Globex", region: "South" },
    { id: 3, name: "Initech", region: "North" },
  ],
  orders: [
    { id: 100, customer_id: 1, revenue: 5400 },
    { id: 101, customer_id: 2, revenue: 2300 },
    { id: 102, customer_id: 1, revenue: 1200 },
    { id: 103, customer_id: 3, revenue: 4100 },
  ],
};

const apiKeyInput = document.getElementById("api-key") as HTMLInputElement;
const questionInput = document.getElementById("question") as HTMLTextAreaElement;
const askButton = document.getElementById("ask") as HTMLButtonElement;
const stopButton = document.getElementById("stop") as HTMLButtonElement;
const output = document.getElementById("output") as HTMLDivElement;

let controller: AbortController | null = null;

askButton.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    alert("OpenAI API key required");
    return;
  }

  output.innerHTML = "<p>Thinking...</p>";
  controller = new AbortController();

  const agent = new Nl2SqlAgent({
    provider: createOpenAiProvider(
      new OpenAI({ apiKey, dangerouslyAllowBrowser: true }),
      { model: "gpt-4o-mini", temperature: 0.1 }
    ),
    maxSteps: 10,
  });

  try {
    const result = await agent.query(
      questionInput.value,
      { sqlProvider: createAlaSqlProvider({ tables }) },
      {
        signal: controller.signal,
        onStep: (step) => {
          const el = document.createElement("div");
          el.className = "step";
          el.innerHTML = `<strong>${escapeHtml(step.purpose)}</strong>
            <pre>${escapeHtml(step.sql)}</pre>
            <pre>${escapeHtml(JSON.stringify(step.result.rows, null, 2))}</pre>`;
          output.appendChild(el);
        },
      }
    );

    const answer = document.createElement("p");
    answer.innerHTML = `<strong>Answer:</strong> ${escapeHtml(result.answer)}`;
    output.appendChild(answer);
  } catch (e) {
    output.innerHTML = `<p style="color: red">Error: ${escapeHtml(e instanceof Error ? e.message : String(e))}</p>`;
  } finally {
    controller = null;
  }
});

stopButton.addEventListener("click", () => {
  controller?.abort();
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"
  );
}
