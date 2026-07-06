import type { QueryResultData } from "../sql/types.js";

export interface ColumnRef {
  table?: string;
  column: string;
}

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
