"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type TaskStage = "" | "none" | "digitizing" | "design";

type DryRunAction =
  | "create"
  | "refresh"
  | "reassign"
  | "cancel"
  | "none";

type ResyncSummary = {
  dryRun: boolean;
  matchedWorkflowCount: number;
  create: number;
  refresh: number;
  reassign: number;
  cancel: number;
  none: number;
  processedCount?: number;
  failureCount?: number;
  filters?: Record<string, unknown>;
};

type ResyncSample = {
  requestId: string;
  requestNumber: string | null;
  salesOrderNumber: string | null;
  salesOrderBase: string | null;
  statusLabel: string | null;
  taskAssignmentStage: "none" | "digitizing" | "design";
  expectedTaskType: string | null;
  expectedUserId: string | null;
  expectedUserName: string | null;
  openTaskCount: number;
  action: DryRunAction;
  note: string;
};

type ResyncResponse = {
  ok?: boolean;
  error?: string;
  summary?: ResyncSummary;
  samples?: ResyncSample[];
  failures?: Array<{ requestId: string; error: string }>;
};

type FormState = {
  requestId: string;
  salesOrderNumber: string;
  statusStage: TaskStage;
  createdFrom: string;
  createdTo: string;
  includeVoided: boolean;
  limit: string;
  confirm: string;
};

const DEFAULT_FORM: FormState = {
  requestId: "",
  salesOrderNumber: "",
  statusStage: "",
  createdFrom: "",
  createdTo: "",
  includeVoided: false,
  limit: "100",
  confirm: "",
};

function actionBadge(action: DryRunAction) {
  const cls =
    action === "create"
      ? "badge badge-brand-blue"
      : action === "refresh"
        ? "badge badge-neutral"
        : action === "reassign"
          ? "badge badge-warning"
          : action === "cancel"
            ? "badge badge-danger"
            : "badge badge-success";

  return <span className={cls}>{action}</span>;
}

function taskTypeLabel(value?: string | null) {
  if (!value) return "";
  if (value === "workflow_design") return "Workflow Design";
  if (value === "workflow_digitizing") return "Workflow Digitizing";
  return value.replaceAll("_", " ");
}

function sourceHref(sample: ResyncSample) {
  return `/design-workflow/${encodeURIComponent(sample.requestId)}`;
}

export default function WorkflowTaskResyncPage() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResyncResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canExecute = useMemo(
    () => form.confirm.trim() === "RESYNC_WORKFLOW_TASKS",
    [form.confirm],
  );

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function payload(dryRun: boolean) {
    return {
      dryRun,
      requestId: form.requestId.trim() || null,
      salesOrderNumber: form.salesOrderNumber.trim() || null,
      statusStage: form.statusStage || null,
      createdFrom: form.createdFrom || null,
      createdTo: form.createdTo || null,
      includeVoided: form.includeVoided,
      limit: Number(form.limit || 100),
      confirm: dryRun ? undefined : form.confirm.trim(),
    };
  }

  async function run(dryRun: boolean) {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/tasks/workflow-resync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload(dryRun)),
      });

      const data = (await res.json().catch(() => ({}))) as ResyncResponse;

      if (!res.ok) {
        throw new Error(data?.error || "Workflow task resync failed.");
      }

      setResult(data);
    } catch (err: any) {
      setError(err?.message || "Workflow task resync failed.");
    } finally {
      setLoading(false);
    }
  }

  const summary = result?.summary;
  const samples = Array.isArray(result?.samples) ? result.samples : [];
  const failures = Array.isArray(result?.failures) ? result.failures : [];

  return (
    <div className="page-shell-wide">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <div className="text-soft" style={{ fontWeight: 800, textTransform: "uppercase" }}>
            Admin Maintenance
          </div>
          <h1 className="page-title">Workflow Task Resync</h1>
          <p className="page-subtitle">
            Dry-run and safely resync CAP Workflow records into platform tasks.
            Use this after task-stage mapping changes or when backfilling existing Workflow records.
          </p>
        </div>

        <div className="page-header-actions">
          <Link href="/admin" className="btn btn-secondary">
            Admin Home
          </Link>
          <Link href="/manager/tasks" className="btn btn-secondary">
            Task Oversight
          </Link>
        </div>
      </div>

      <div className="section-stack">
        <section className="card">
          <div className="section-card-header">
            <div>
              <h2 style={{ marginBottom: 4 }}>Resync Filters</h2>
              <div className="text-soft">
                Start narrow. Dry-run by Sales Order or Request ID first, then broaden once the result looks right.
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <div>
              <label className="field-label">Workflow Request ID</label>
              <input
                className="input"
                value={form.requestId}
                onChange={(e) => updateField("requestId", e.target.value)}
                placeholder="Optional exact request UUID"
              />
            </div>

            <div>
              <label className="field-label">Sales Order / Request #</label>
              <input
                className="input"
                value={form.salesOrderNumber}
                onChange={(e) => updateField("salesOrderNumber", e.target.value)}
                placeholder="Optional SO, base SO, or request #"
              />
            </div>

            <div>
              <label className="field-label">Task Stage</label>
              <select
                className="select"
                value={form.statusStage}
                onChange={(e) => updateField("statusStage", e.target.value as TaskStage)}
              >
                <option value="">All Stages</option>
                <option value="design">Design</option>
                <option value="digitizing">Digitizing</option>
                <option value="none">None</option>
              </select>
            </div>

            <div>
              <label className="field-label">Created From</label>
              <input
                type="date"
                className="input"
                value={form.createdFrom}
                onChange={(e) => updateField("createdFrom", e.target.value)}
              />
            </div>

            <div>
              <label className="field-label">Created To</label>
              <input
                type="date"
                className="input"
                value={form.createdTo}
                onChange={(e) => updateField("createdTo", e.target.value)}
              />
            </div>

            <div>
              <label className="field-label">Limit</label>
              <input
                type="number"
                min={1}
                max={500}
                className="input"
                value={form.limit}
                onChange={(e) => updateField("limit", e.target.value)}
              />
            </div>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 12,
            }}
          >
            <input
              type="checkbox"
              checked={form.includeVoided}
              onChange={(e) => updateField("includeVoided", e.target.checked)}
            />
            <span className="text-muted">Include voided Workflow records</span>
          </label>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 16,
            }}
          >
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => run(true)}
              disabled={loading}
            >
              {loading ? "Running…" : "Run Dry Run"}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setForm(DEFAULT_FORM);
                setResult(null);
                setError(null);
              }}
              disabled={loading}
            >
              Reset
            </button>
          </div>
        </section>

        <section className="card">
          <div className="section-card-header">
            <div>
              <h2 style={{ marginBottom: 4 }}>Execute Resync</h2>
              <div className="text-soft">
                Actual resync will create, refresh, reassign, complete, or cancel tasks based on current Workflow status mapping.
              </div>
            </div>
          </div>

          <div className="alert alert-warning">
            Always run a dry run first. To execute, type{" "}
            <strong>RESYNC_WORKFLOW_TASKS</strong> exactly.
          </div>

          <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
            <input
              className="input"
              value={form.confirm}
              onChange={(e) => updateField("confirm", e.target.value)}
              placeholder="RESYNC_WORKFLOW_TASKS"
            />

            <button
              type="button"
              className="btn btn-danger"
              onClick={() => run(false)}
              disabled={loading || !canExecute}
            >
              {loading ? "Executing…" : "Execute Resync"}
            </button>
          </div>
        </section>

        {error ? <div className="alert alert-danger">{error}</div> : null}

        {summary ? (
          <section className="card">
            <div className="section-card-header">
              <div>
                <h2 style={{ marginBottom: 4 }}>
                  {summary.dryRun ? "Dry Run Summary" : "Execution Summary"}
                </h2>
                <div className="text-soft">
                  Matched {summary.matchedWorkflowCount} Workflow record(s).
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              }}
            >
              <SummaryCard label="Matched" value={summary.matchedWorkflowCount} />
              <SummaryCard label="Create" value={summary.create} />
              <SummaryCard label="Refresh" value={summary.refresh} />
              <SummaryCard label="Reassign" value={summary.reassign} />
              <SummaryCard label="Cancel" value={summary.cancel} />
              <SummaryCard label="No Action" value={summary.none} />
              {!summary.dryRun ? (
                <>
                  <SummaryCard label="Processed" value={summary.processedCount ?? 0} />
                  <SummaryCard label="Failures" value={summary.failureCount ?? 0} />
                </>
              ) : null}
            </div>
          </section>
        ) : null}

        {failures.length > 0 ? (
          <section className="card">
            <div className="section-card-header">
              <div>
                <h2 style={{ marginBottom: 4 }}>Failures</h2>
                <div className="text-soft">
                  These records failed during actual resync.
                </div>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Request ID</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {failures.map((failure) => (
                    <tr key={failure.requestId}>
                      <td>{failure.requestId}</td>
                      <td>{failure.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {samples.length > 0 ? (
          <section className="card">
            <div className="section-card-header">
              <div>
                <h2 style={{ marginBottom: 4 }}>Sample Records</h2>
                <div className="text-soft">
                  Showing up to 250 matching Workflow records from the selected run.
                </div>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Workflow</th>
                    <th>Sales Order</th>
                    <th>Status</th>
                    <th>Stage</th>
                    <th>Expected Task</th>
                    <th>Assigned To</th>
                    <th>Open Tasks</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {samples.map((sample) => (
                    <tr key={`${sample.requestId}-${sample.expectedTaskType ?? "none"}`}>
                      <td>{actionBadge(sample.action)}</td>
                      <td>
                        <Link className="btn-linkish" href={sourceHref(sample)}>
                          {sample.requestNumber || sample.requestId}
                        </Link>
                      </td>
                      <td>{sample.salesOrderNumber || sample.salesOrderBase || ""}</td>
                      <td>{sample.statusLabel || ""}</td>
                      <td>{sample.taskAssignmentStage}</td>
                      <td>{taskTypeLabel(sample.expectedTaskType)}</td>
                      <td>{sample.expectedUserName || sample.expectedUserId || ""}</td>
                      <td>{sample.openTaskCount}</td>
                      <td>{sample.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : result ? (
          <section className="card">
            <div className="text-muted">No sample records returned for this filter.</div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        background: "var(--surface-subtle)",
        borderRadius: 14,
        padding: 14,
        display: "grid",
        gap: 6,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: "var(--text-soft)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 800,
          color: "var(--text)",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}