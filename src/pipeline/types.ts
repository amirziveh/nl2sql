import type { QueryResultData, ColumnRef } from "../sql/types.js";

export interface VerificationOutcome {
  status: "passed" | "warning" | "failed";
  hardFailures: string[];
  warnings: string[];
  columnRefs: ColumnRef[];
}

export interface Step {
  sql: string;
  purpose: string;
  explanation: string;
  result: QueryResultData;
  verification: VerificationOutcome;
}
