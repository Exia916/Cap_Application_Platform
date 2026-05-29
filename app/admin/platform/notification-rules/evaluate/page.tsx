"use client";

import { useState } from "react";
import Link from "next/link";

type EvaluationResult = {
  ok?: boolean;
  dryRun?: boolean;
  mode?: string;
  cronExecuteEnabled?: boolean;
  startedAt?: string;
  finishedAt?: string;
  lockAcquired?: boolean;

  evaluatedRules?: number;
  matchedRecords?: number;
  candidateRecipients?: number;

  createdEvents?: number;
  createdDeliveries?: number;
  createdRuleRuns?: number;

  skippedAlreadyRun?: number;
  skippedNoRecipients?: number;
  skippedInvalidRecipients?: number;
  skippedConditions?: number;
  skippedDryRun?: number;

  errors?: Array<{
    ruleId?: string;
    ruleName?: string;
    entityId?: string;
    recipient?: string;
    message: string;
  }>;

  details?: Array<{
    ruleId: string;
    ruleName: string;
    entityId: string;
    requestNumber: string;
    workflowStatusLabel: string;
    statusEnteredAt: string;
    elapsedMinutes: number;
    recipient: string;
    action: string;
    message?: string;
  }>;

  error?: string;
};

type EmailProcessResult = {
  ok?: boolean;
  mode?: string;
  emailEnabled?: boolean;
  dryRun?: boolean;
  limit?: number;

  selected?: number;
  sent?: number;
  failed?: number;
  skipped?: number;
  wouldSend?: number;

  errors?: Array<{
    deliveryId: string;
    recipientEmail: string | null;
    message: string;
  }>;

  details?: Array<{
    deliveryId: string;
    recipientEmail: string | null;
    subject: string;
    action: string;
    message?: string;
  }>;

  error?: string;
};

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
}) {
  return (
    <div className="section-card">
      <div className="text-soft">{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{String(value ?? 0)}</div>
    </div>
  );
}

function ResultBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card section-stack">
      <h2 style={{ margin: 0 }}>{title}</h2>
      {children}
    </div>
  );
}

export default function AdminNotificationRuleEvaluatePage() {
  const [ruleId, setRuleId] = useState("");
  const [limitPerRule, setLimitPerRule] = useState("25");
  const [emailLimit, setEmailLimit] = useState("25");

  const [runningEval, setRunningEval] = useState(false);
  const [runningEmail, setRunningEmail] = useState(false);

  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);
  const [emailResult, setEmailResult] = useState<EmailProcessResult | null>(null);

  const [error, setError] = useState("");

  async function runEvaluator(execute: boolean) {
    setRunningEval(true);
    setError("");
    setEvalResult(null);

    try {
      const body = {
        dryRun: !execute,
        execute,
        limitPerRule: Number(limitPerRule) || 25,
        ruleId: ruleId.trim() || null,
      };

      const res = await fetch("/api/platform/notification-rules/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));
      setEvalResult(json as EvaluationResult);

      if (!res.ok) {
        setError((json as any)?.error || "Failed to evaluate notification rules.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to evaluate notification rules.");
    } finally {
      setRunningEval(false);
    }
  }

  async function runEmailProcessor(dryRun: boolean) {
    setRunningEmail(true);
    setError("");
    setEmailResult(null);

    try {
      const res = await fetch("/api/platform/notifications/email/process-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          dryRun,
          limit: Number(emailLimit) || 25,
        }),
      });

      const json = await res.json().catch(() => ({}));
      setEmailResult(json as EmailProcessResult);

      if (!res.ok) {
        setError((json as any)?.error || "Failed to process pending emails.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to process pending emails.");
    } finally {
      setRunningEmail(false);
    }
  }

  return (
    <div className="page-shell-wide section-stack">
      <div className="card">
        <div className="page-header">
          <div className="page-header-title-wrap">
            <h1 className="page-title">Admin – Notification Rule Evaluation</h1>
            <p className="page-subtitle">
              Run notification rule checks, review dry-run output, and process queued email
              deliveries.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/admin/notification-rules" className="btn btn-secondary">
              Notification Rules
            </Link>
            <Link href="/admin/platform/notification-rules/runs" className="btn btn-secondary">
              Rule Run History
            </Link>
            <Link href="/admin/platform/email-test" className="btn btn-secondary">
              Email Test
            </Link>
            <Link href="/admin" className="btn btn-secondary">
              Back to Admin
            </Link>
          </div>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="alert alert-info">
        Run a dry run first. Execute only after the dry-run output looks correct. If email
        delivery should be sent, make sure <code>CAP_EMAIL_NOTIFICATIONS_ENABLED=true</code>{" "}
        before executing rules that create email deliveries.
      </div>

      <div className="card section-stack">
        <div>
          <h2 style={{ margin: 0 }}>Status-Duration Evaluator</h2>
          <p className="text-soft" style={{ marginBottom: 0 }}>
            Evaluates active notification rules such as Workflow status-duration exceeded.
          </p>
        </div>

        <div className="form-grid">
          <div>
            <label className="field-label">Limit Per Rule</label>
            <input
              className="input"
              type="number"
              min={1}
              max={500}
              value={limitPerRule}
              onChange={(e) => setLimitPerRule(e.target.value)}
              disabled={runningEval}
            />
          </div>

          <div>
            <label className="field-label">Rule ID</label>
            <input
              className="input"
              value={ruleId}
              onChange={(e) => setRuleId(e.target.value)}
              placeholder="Optional UUID"
              disabled={runningEval}
            />
            <div className="field-help">Leave blank to evaluate all active rules.</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={runningEval}
            onClick={() => runEvaluator(false)}
          >
            {runningEval ? "Running..." : "Dry Run Evaluator"}
          </button>

          <button
            type="button"
            className="btn btn-danger"
            disabled={runningEval}
            onClick={() => {
              if (
                window.confirm(
                  "Execute notification rules now? This may create notification events, deliveries, and rule-run dedupe records."
                )
              ) {
                runEvaluator(true);
              }
            }}
          >
            Execute Evaluator
          </button>
        </div>
      </div>

      {evalResult ? (
        <ResultBlock title="Evaluator Result">
          {evalResult.error ? (
            <div className="alert alert-danger">{evalResult.error}</div>
          ) : null}

          <div className="section-grid">
            <SummaryCard label="Dry Run" value={evalResult.dryRun ? "Yes" : "No"} />
            <SummaryCard label="Lock Acquired" value={evalResult.lockAcquired ? "Yes" : "No"} />
            <SummaryCard label="Rules" value={evalResult.evaluatedRules} />
            <SummaryCard label="Matched Records" value={evalResult.matchedRecords} />
            <SummaryCard label="Recipients" value={evalResult.candidateRecipients} />
            <SummaryCard label="Created Events" value={evalResult.createdEvents} />
            <SummaryCard label="Created Deliveries" value={evalResult.createdDeliveries} />
            <SummaryCard label="Rule Runs" value={evalResult.createdRuleRuns} />
            <SummaryCard label="Dry Run Skips" value={evalResult.skippedDryRun} />
            <SummaryCard label="Duplicate Skips" value={evalResult.skippedAlreadyRun} />
            <SummaryCard label="No Recipient Skips" value={evalResult.skippedNoRecipients} />
            <SummaryCard label="Invalid Recipient Skips" value={evalResult.skippedInvalidRecipients} />
            <SummaryCard label="Condition Skips" value={evalResult.skippedConditions} />
            <SummaryCard label="Errors" value={evalResult.errors?.length || 0} />
          </div>

          {evalResult.details?.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Rule</th>
                    <th>Request</th>
                    <th>Status</th>
                    <th>Elapsed</th>
                    <th>Recipient</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {evalResult.details.slice(0, 100).map((detail, idx) => (
                    <tr key={`${detail.ruleId}-${detail.entityId}-${detail.recipient}-${idx}`}>
                      <td>{detail.action}</td>
                      <td>{detail.ruleName}</td>
                      <td>{detail.requestNumber}</td>
                      <td>{detail.workflowStatusLabel}</td>
                      <td>{detail.elapsedMinutes} min</td>
                      <td>{detail.recipient}</td>
                      <td>{detail.message || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-soft">No evaluator details returned.</div>
          )}
        </ResultBlock>
      ) : null}

      <div className="card section-stack">
        <div>
          <h2 style={{ margin: 0 }}>Pending Email Processor</h2>
          <p className="text-soft" style={{ marginBottom: 0 }}>
            Processes pending email notification deliveries through the shared SMTP service.
          </p>
        </div>

        <div className="form-grid">
          <div>
            <label className="field-label">Email Delivery Limit</label>
            <input
              className="input"
              type="number"
              min={1}
              max={100}
              value={emailLimit}
              onChange={(e) => setEmailLimit(e.target.value)}
              disabled={runningEmail}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={runningEmail}
            onClick={() => runEmailProcessor(true)}
          >
            {runningEmail ? "Running..." : "Dry Run Email Processor"}
          </button>

          <button
            type="button"
            className="btn btn-danger"
            disabled={runningEmail}
            onClick={() => {
              if (
                window.confirm(
                  "Process pending emails now? This may send email through the configured SMTP service."
                )
              ) {
                runEmailProcessor(false);
              }
            }}
          >
            Process Pending Emails
          </button>
        </div>
      </div>

      {emailResult ? (
        <ResultBlock title="Email Processor Result">
          {emailResult.error ? (
            <div className="alert alert-danger">{emailResult.error}</div>
          ) : null}

          <div className="section-grid">
            <SummaryCard label="Email Enabled" value={emailResult.emailEnabled ? "Yes" : "No"} />
            <SummaryCard label="Dry Run" value={emailResult.dryRun ? "Yes" : "No"} />
            <SummaryCard label="Selected" value={emailResult.selected} />
            <SummaryCard label="Would Send" value={emailResult.wouldSend} />
            <SummaryCard label="Sent" value={emailResult.sent} />
            <SummaryCard label="Failed" value={emailResult.failed} />
            <SummaryCard label="Skipped" value={emailResult.skipped} />
            <SummaryCard label="Errors" value={emailResult.errors?.length || 0} />
          </div>

          {emailResult.details?.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Recipient</th>
                    <th>Subject</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {emailResult.details.slice(0, 100).map((detail) => (
                    <tr key={detail.deliveryId}>
                      <td>{detail.action}</td>
                      <td>{detail.recipientEmail || ""}</td>
                      <td>{detail.subject}</td>
                      <td>{detail.message || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-soft">No email processor details returned.</div>
          )}
        </ResultBlock>
      ) : null}
    </div>
  );
}