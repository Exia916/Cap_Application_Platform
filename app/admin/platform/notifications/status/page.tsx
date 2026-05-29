"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type JobRun = {
  id: string;
  jobName: string;
  triggerMode: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  resultJson: Record<string, any>;
  errorMessage: string | null;
};

type NotificationSystemStatus = {
  env: {
    emailEnabled: boolean;
    cronSecretConfigured: boolean;
    capCronSecretConfigured: boolean;
    evaluatorCronExecute: boolean;
    evaluatorLimitPerRule: string | null;
    appBaseUrlConfigured: boolean;
    smtpHostConfigured: boolean;
    smtpPort: string | null;
    fromAddressConfigured: boolean;
  };
  jobs: Record<string, JobRun | undefined>;
  counts: {
    activeRules: number;
    activeEventRules: number;
    activeStatusDurationRules: number;
    activeEventTypes: number;
    pendingEmails: number;
    sentEmails24h: number;
    failedEmails: number;
    skippedEmails: number;
    oldestPendingEmailAt: string | null;
    lastEmailAttemptAt: string | null;
    lastEmailDeliveredAt: string | null;
    latestEmailError: string | null;
    ruleRuns24h: number;
    lastRuleRunAt: string | null;
  };
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function BoolBadge({ value }: { value: boolean }) {
  return (
    <span className={value ? "badge badge-success" : "badge badge-danger"}>
      {value ? "Yes" : "No"}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "success") {
    return <span className="badge badge-success">Success</span>;
  }

  if (normalized === "failed") {
    return <span className="badge badge-danger">Failed</span>;
  }

  if (normalized === "skipped") {
    return <span className="badge badge-neutral">Skipped</span>;
  }

  if (normalized === "running") {
    return <span className="badge badge-warning">Running</span>;
  }

  return <span className="badge badge-neutral">Unknown</span>;
}

function SummaryCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number | React.ReactNode;
  note?: string;
}) {
  return (
    <div className="section-card">
      <div className="text-soft">{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
      {note ? <div className="field-help">{note}</div> : null}
    </div>
  );
}

function JobCard({ title, job }: { title: string; job: JobRun | undefined }) {
  return (
    <div className="section-card section-stack">
      <div className="section-card-header">
        <div>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <div className="text-soft">{job?.jobName || "No run recorded yet"}</div>
        </div>
        <StatusBadge status={job?.status} />
      </div>

      {job ? (
        <>
          <div className="form-grid">
            <div>
              <div className="text-soft">Trigger</div>
              <div>{job.triggerMode}</div>
            </div>

            <div>
              <div className="text-soft">Started</div>
              <div>{formatDateTime(job.startedAt)}</div>
            </div>

            <div>
              <div className="text-soft">Finished</div>
              <div>{formatDateTime(job.finishedAt)}</div>
            </div>

            <div>
              <div className="text-soft">Duration</div>
              <div>{job.durationMs != null ? `${job.durationMs} ms` : "—"}</div>
            </div>
          </div>

          {job.errorMessage ? (
            <div className="alert alert-danger">{job.errorMessage}</div>
          ) : null}

          <details>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>Run Result JSON</summary>
            <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>
              {JSON.stringify(job.resultJson || {}, null, 2)}
            </pre>
          </details>
        </>
      ) : (
        <div className="alert alert-warning">
          No job run has been logged yet. After deployment, wait for the cron interval or run the
          related admin action once.
        </div>
      )}
    </div>
  );
}

export default function NotificationSystemStatusPage() {
  const [status, setStatus] = useState<NotificationSystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadStatus() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/platform/notifications/status", {
        cache: "no-store",
        credentials: "include",
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error((json as any)?.error || "Failed to load notification status.");
      }

      setStatus((json as any).status || null);
    } catch (err: any) {
      setError(err?.message || "Failed to load notification status.");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  const evaluatorJob = status?.jobs?.notification_rule_evaluator;
  const emailJob = status?.jobs?.notification_email_processor;

  return (
    <div className="page-shell-wide section-stack">
      <div className="card">
        <div className="page-header">
          <div className="page-header-title-wrap">
            <h1 className="page-title">Admin – Notification System Status</h1>
            <p className="page-subtitle">
              Monitor cron readiness, rule activity, pending email delivery, and recent job runs.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/admin/notification-rules" className="btn btn-secondary">
              Notification Rules
            </Link>
            <Link href="/admin/platform/notification-rules/evaluate" className="btn btn-secondary">
              Rule Evaluation
            </Link>
            <Link href="/admin/platform/notification-rules/runs" className="btn btn-secondary">
              Rule Run History
            </Link>
            <Link href="/admin" className="btn btn-secondary">
              Back to Admin
            </Link>
          </div>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {loading ? <div className="alert alert-info">Loading notification system status...</div> : null}

      {status ? (
        <>
          <div className="card section-stack">
            <div className="section-card-header">
              <div>
                <h2 style={{ margin: 0 }}>Environment Readiness</h2>
                <div className="text-soft">
                  These values confirm whether the notification scheduler and email processor are
                  configured.
                </div>
              </div>

              <button type="button" className="btn btn-secondary" onClick={loadStatus}>
                Refresh
              </button>
            </div>

            <div className="section-grid">
              <SummaryCard label="Email Enabled" value={<BoolBadge value={status.env.emailEnabled} />} />
              <SummaryCard label="CRON_SECRET Set" value={<BoolBadge value={status.env.cronSecretConfigured} />} />
              <SummaryCard label="CAP_CRON_SECRET Set" value={<BoolBadge value={status.env.capCronSecretConfigured} />} />
              <SummaryCard label="Evaluator Cron Execute" value={<BoolBadge value={status.env.evaluatorCronExecute} />} />
              <SummaryCard label="SMTP Host Set" value={<BoolBadge value={status.env.smtpHostConfigured} />} />
              <SummaryCard label="From Address Set" value={<BoolBadge value={status.env.fromAddressConfigured} />} />
              <SummaryCard label="App Base URL Set" value={<BoolBadge value={status.env.appBaseUrlConfigured} />} />
              <SummaryCard label="SMTP Port" value={status.env.smtpPort || "—"} />
              <SummaryCard label="Evaluator Limit" value={status.env.evaluatorLimitPerRule || "Default"} />
            </div>
          </div>

          <div className="card section-stack">
            <h2 style={{ margin: 0 }}>Notification Counts</h2>

            <div className="section-grid">
              <SummaryCard label="Active Rules" value={status.counts.activeRules} />
              <SummaryCard label="Event Rules" value={status.counts.activeEventRules} />
              <SummaryCard label="Status-Duration Rules" value={status.counts.activeStatusDurationRules} />
              <SummaryCard label="Active Event Types" value={status.counts.activeEventTypes} />
              <SummaryCard label="Pending Emails" value={status.counts.pendingEmails} />
              <SummaryCard label="Sent Emails - 24h" value={status.counts.sentEmails24h} />
              <SummaryCard label="Failed Emails" value={status.counts.failedEmails} />
              <SummaryCard label="Skipped Emails" value={status.counts.skippedEmails} />
              <SummaryCard label="Rule Runs - 24h" value={status.counts.ruleRuns24h} />
            </div>

            <div className="form-grid">
              <div className="section-card">
                <div className="text-soft">Oldest Pending Email</div>
                <div>{formatDateTime(status.counts.oldestPendingEmailAt)}</div>
              </div>

              <div className="section-card">
                <div className="text-soft">Last Email Attempt</div>
                <div>{formatDateTime(status.counts.lastEmailAttemptAt)}</div>
              </div>

              <div className="section-card">
                <div className="text-soft">Last Email Delivered</div>
                <div>{formatDateTime(status.counts.lastEmailDeliveredAt)}</div>
              </div>

              <div className="section-card">
                <div className="text-soft">Last Rule Run</div>
                <div>{formatDateTime(status.counts.lastRuleRunAt)}</div>
              </div>
            </div>

            {status.counts.latestEmailError ? (
              <div className="alert alert-danger">
                Latest email error: {status.counts.latestEmailError}
              </div>
            ) : null}
          </div>

          <div className="card section-stack">
            <h2 style={{ margin: 0 }}>Recent Job Runs</h2>

            <div className="form-grid">
              <JobCard title="Notification Rule Evaluator" job={evaluatorJob} />
              <JobCard title="Pending Email Processor" job={emailJob} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}