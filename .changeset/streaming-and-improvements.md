---
"nl2sql": minor
---

Add streaming, configurable SQL requirement, stuck detection, duplicate query cache, and reserved-word sanitization.

- `onToken` callback on `ChatOptions` and `QueryCallbacks` streams answer tokens
- `requireSqlBeforeFinish` config flag (default `true`) — when `false`, model can answer greetings without SQL
- `buildFinishTool(flag)` and `buildTools(flag)` — adaptive tool definitions
- Stuck detection: 3 consecutive failures → model told to change approach
- Duplicate query cache with normalized SQL keys
- `sanitizeReservedAliases` — wraps reserved-word `AS` aliases in brackets
- `try/catch` around `sqlProvider.execute` — errors returned as result, not thrown
- Raised `PREVIEW_LIMIT` to 200, shows "showing N of M (truncated)"
- AlaSQL gotchas in capabilities section (negative numbers in CASE/WHEN, OFFSET)
- Workflow rules: don't re-query truncated rows, don't repeat queries, aim for 2-4 queries
