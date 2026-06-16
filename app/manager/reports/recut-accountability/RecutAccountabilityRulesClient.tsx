// app/manager/reports/recut-accountability/RecutAccountabilityRulesClient.tsx

"use client";

import { useEffect, useMemo, useState } from "react";

type RuleRow = {
  id: string;
  reasonKey: string;
  reasonLabel: string;
  isAccountable: boolean;
  notes: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

type UnclassifiedReasonRow = {
  recutReasonKey: string;
  recutReason: string;
  recutCount: number;
  recutPieces: number;
  firstRequestedDate: string | null;
  lastRequestedDate: string | null;
};

type ApiResponse = {
  rules: RuleRow[];
  unclassifiedReasons: UnclassifiedReasonRow[];
  error?: string;
};

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function fmtInt(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? nf0.format(n) : "0";
}

function fmtDate(value?: string | null) {
  if (!value) return "";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;

  return d.toISOString().slice(0, 10);
}

function accountabilityLabel(value: boolean) {
  return value ? "Accountable" : "Not Accountable";
}

function activeLabel(value: boolean) {
  return value ? "Active" : "Inactive";
}

export default function RecutAccountabilityRulesClient() {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [unclassifiedReasons, setUnclassifiedReasons] = useState<UnclassifiedReasonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const activeRuleCount = useMemo(
    () => rules.filter((rule) => rule.isActive).length,
    [rules]
  );

  const excludedRuleCount = useMemo(
    () => rules.filter((rule) => rule.isActive && !rule.isAccountable).length,
    [rules]
  );

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/reports/recut-accountability-rules", {
        cache: "no-store",
        credentials: "include",
      });

      const data = (await res.json().catch(() => ({}))) as Partial<ApiResponse>;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load recut accountability rules.");
      }

      setRules(Array.isArray(data.rules) ? data.rules : []);
      setUnclassifiedReasons(
        Array.isArray(data.unclassifiedReasons) ? data.unclassifiedReasons : []
      );
    } catch (err: any) {
      setError(err?.message || "Failed to load recut accountability rules.");
      setRules([]);
      setUnclassifiedReasons([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateRuleDraft(id: string, patch: Partial<RuleRow>) {
    setRules((current) =>
      current.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule))
    );
  }

  async function saveRule(rule: RuleRow) {
    const reasonLabel = String(rule.reasonLabel ?? "").trim();

    if (!reasonLabel) {
      setError("Reason label is required.");
      return;
    }

    setSavingId(rule.id);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(
        `/api/reports/recut-accountability-rules/${encodeURIComponent(rule.id)}`,
        {
          method: "PUT",
          cache: "no-store",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reasonLabel,
            isAccountable: !!rule.isAccountable,
            isActive: !!rule.isActive,
            notes: rule.notes ?? "",
            sortOrder: Number(rule.sortOrder ?? 0),
          }),
        }
      );

      const data = (await res.json().catch(() => ({}))) as {
        rule?: RuleRow;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save recut accountability rule.");
      }

      if (data.rule) {
        setRules((current) =>
          current.map((item) => (item.id === data.rule!.id ? data.rule! : item))
        );
      }

      setMessage("Rule saved.");
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to save recut accountability rule.");
    } finally {
      setSavingId(null);
    }
  }

  async function createRule(reason: UnclassifiedReasonRow, isAccountable: boolean) {
    const reasonLabel = String(reason.recutReason ?? "").trim();

    if (!reasonLabel) {
      setError("Reason label is required.");
      return;
    }

    setCreatingKey(reason.recutReasonKey);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/reports/recut-accountability-rules", {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reasonLabel,
          isAccountable,
          isActive: true,
          notes: "",
          sortOrder: 0,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        rule?: RuleRow;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data?.error || "Failed to create recut accountability rule.");
      }

      setMessage(
        `Created ${accountabilityLabel(isAccountable).toLowerCase()} rule for "${reasonLabel}".`
      );
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to create recut accountability rule.");
    } finally {
      setCreatingKey(null);
    }
  }

  return (
    <div className="section-stack">
      <style jsx>{`
        .recut-accountability-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }

        .recut-accountability-summary-card {
          display: grid;
          gap: 4px;
          align-content: center;
          min-height: 82px;
        }

        .recut-accountability-summary-label {
          color: var(--text-soft);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .recut-accountability-summary-value {
          color: var(--text);
          font-size: 26px;
          font-weight: 900;
          line-height: 1;
        }

        .recut-accountability-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .recut-accountability-reason-cell {
          display: grid;
          gap: 6px;
          min-width: 240px;
        }

        .recut-accountability-key {
          color: var(--text-soft);
          font-size: 12px;
          word-break: break-word;
        }

        .recut-accountability-notes {
          min-width: 220px;
        }

        .recut-accountability-muted {
          color: var(--text-soft);
        }
      `}</style>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}

      <div className="recut-accountability-summary">
        <div className="card recut-accountability-summary-card">
          <div className="recut-accountability-summary-label">Configured Rules</div>
          <div className="recut-accountability-summary-value">{fmtInt(rules.length)}</div>
        </div>

        <div className="card recut-accountability-summary-card">
          <div className="recut-accountability-summary-label">Active Rules</div>
          <div className="recut-accountability-summary-value">{fmtInt(activeRuleCount)}</div>
        </div>

        <div className="card recut-accountability-summary-card">
          <div className="recut-accountability-summary-label">Excluded Rules</div>
          <div className="recut-accountability-summary-value">{fmtInt(excludedRuleCount)}</div>
        </div>

        <div className="card recut-accountability-summary-card">
          <div className="recut-accountability-summary-label">Unclassified Reasons</div>
          <div className="recut-accountability-summary-value">
            {fmtInt(unclassifiedReasons.length)}
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="record-section-header">
          <div>
            <h2 className="record-section-title">Configured Rules</h2>
            <p className="page-subtitle">
              Active rules marked as not accountable are excluded from accountable operator recut
              metrics. Inactive rules are ignored.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={load}
            disabled={loading || !!savingId || !!creatingKey}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="recut-accountability-muted">Loading rules…</div>
        ) : rules.length === 0 ? (
          <div className="recut-accountability-muted">No rules have been configured yet.</div>
        ) : (
          <div className="table-scroll">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Reason</th>
                  <th>Accountability</th>
                  <th>Active</th>
                  <th>Sort</th>
                  <th>Notes</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      <div className="recut-accountability-reason-cell">
                        <input
                          className="input"
                          value={rule.reasonLabel ?? ""}
                          onChange={(e) =>
                            updateRuleDraft(rule.id, { reasonLabel: e.target.value })
                          }
                        />
                        <div className="recut-accountability-key">
                          Key: {rule.reasonKey || "Generated on save"}
                        </div>
                      </div>
                    </td>

                    <td>
                      <select
                        className="select"
                        value={rule.isAccountable ? "true" : "false"}
                        onChange={(e) =>
                          updateRuleDraft(rule.id, {
                            isAccountable: e.target.value === "true",
                          })
                        }
                      >
                        <option value="true">Accountable</option>
                        <option value="false">Not Accountable</option>
                      </select>
                    </td>

                    <td>
                      <select
                        className="select"
                        value={rule.isActive ? "true" : "false"}
                        onChange={(e) =>
                          updateRuleDraft(rule.id, {
                            isActive: e.target.value === "true",
                          })
                        }
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </td>

                    <td>
                      <input
                        className="input"
                        type="number"
                        value={Number(rule.sortOrder ?? 0)}
                        onChange={(e) =>
                          updateRuleDraft(rule.id, {
                            sortOrder: Number(e.target.value || 0),
                          })
                        }
                      />
                    </td>

                    <td>
                      <textarea
                        className="textarea recut-accountability-notes"
                        rows={2}
                        value={rule.notes ?? ""}
                        onChange={(e) => updateRuleDraft(rule.id, { notes: e.target.value })}
                      />
                    </td>

                    <td>
                      <div className="recut-accountability-muted">
                        {fmtDate(rule.updatedAt)}
                      </div>
                      {rule.updatedBy ? (
                        <div className="recut-accountability-muted">{rule.updatedBy}</div>
                      ) : null}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => saveRule(rule)}
                        disabled={savingId === rule.id || !!creatingKey}
                      >
                        {savingId === rule.id ? "Saving…" : "Save"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section-card">
        <div className="record-section-header">
          <div>
            <h2 className="record-section-title">Unclassified Reasons</h2>
            <p className="page-subtitle">
              These reasons do not have an active rule. They currently count as accountable by
              default.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="recut-accountability-muted">Loading unclassified reasons…</div>
        ) : unclassifiedReasons.length === 0 ? (
          <div className="recut-accountability-muted">
            No unclassified recut reasons found.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Reason</th>
                  <th>Recuts</th>
                  <th>Pieces</th>
                  <th>First Seen</th>
                  <th>Last Seen</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {unclassifiedReasons.map((reason) => (
                  <tr key={reason.recutReasonKey}>
                    <td>
                      <div className="recut-accountability-reason-cell">
                        <strong>{reason.recutReason}</strong>
                        <span className="recut-accountability-key">
                          Key: {reason.recutReasonKey}
                        </span>
                      </div>
                    </td>
                    <td>{fmtInt(reason.recutCount)}</td>
                    <td>{fmtInt(reason.recutPieces)}</td>
                    <td>{fmtDate(reason.firstRequestedDate)}</td>
                    <td>{fmtDate(reason.lastRequestedDate)}</td>
                    <td>
                      <div className="recut-accountability-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => createRule(reason, true)}
                          disabled={creatingKey === reason.recutReasonKey || !!savingId}
                        >
                          Accountable
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => createRule(reason, false)}
                          disabled={creatingKey === reason.recutReasonKey || !!savingId}
                        >
                          Not Accountable
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <strong>Current rule behavior:</strong>{" "}
        Unconfigured reasons count as accountable. Active rules marked “Not Accountable” are
        excluded from accountable operator recut metrics. Inactive rules are ignored.
      </div>
    </div>
  );
}