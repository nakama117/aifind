export class NotFound extends Error { statusCode = 404; }
export class InvalidInput extends Error { statusCode = 400; }
export class PublishValidation extends Error {
  statusCode = 422;
  issues: PublishIssue[];
  constructor(issues: PublishIssue[]) {
    super(issues.map(i => `${i.field}: ${i.problem === "evidence" ? "根拠が必要です" : i.problem === "billingPeriod" ? "課金周期が必要です" : "確認日時が必要です"}`).join("; "));
    this.issues = issues;
  }
}
import type { PublishIssue } from "./contracts.ts";

