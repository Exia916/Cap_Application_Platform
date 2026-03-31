"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";

type SessionRow = {
  id: string;
  moduleKey: string;
  areaCode: string;
  areaLabel: string | null;
  workDate: string;
  shiftDate: string | null;
  shift: string | null;
  operatorName: string;
  employeeNumber: number | null;
  timeIn: string;
  timeOut: string | null;
  isOpen: boolean;
  notes: string | null;
  isVoided: boolean;
  submissionCount: number;
  totalQuantity: number;
};

type RelatedSubmissionRow = {
  id: string;
  sessionId: string;
  entryTs: string;
  entryDate: string;
  name: string;
  employeeNumber: number | null;
  shift: string | null;
  stockOrder: boolean;
  salesOrder: string | null;
  knitArea: string | null;
  notes: string | null;
  isVoided: boolean;
  lineCount: number;
  totalQuantity: number;
};

type ApiResponse = {
  rows: SessionRow[];
  relatedBySessionId: Record<string, RelatedSubmissionRow[]>;
  totalCount: number;
  totals: {
    totalSessions: number;
    totalSubmissions: number;
    totalQuantity: number;
  };
};

type SortBy =
  | "workDate"
  | "timeIn"
  | "timeOut"
  | "operatorName"
  | "employeeNumber"
  | "moduleKey"
  | "areaCode"
  | "shift"
  | "isOpen"
  | "submissionCount"
  | "totalQuantity";

type Filters = {
  moduleKey: string;
  areaCode: string;
  operatorName: string;
  employeeNumber: string;
  isOpen: string;
};

const DEFAULT_FILTERS: Filters = {
  moduleKey: "knit_production",
  areaCode: "",
  operatorName: "",
  employeeNumber: "",
  isOpen: "",
};

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function ymdChicago(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mm = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function getRangeLastNDays(n: number): { from: string; to: string } {
  const today = new Date();
  return {
    from: ymdChicago(addDays(today, -(n - 1))),
    to: ymdChicago(today),
  };
}

function fmtDateOnly(v?: string | null): string {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : ymdChicago(d);
}

function fmtDateTime(v?: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function fmtInt(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? nf0.format(n) : "0";
}

function durationText(timeIn?: string | null, timeOut?: string | null) {
  if (!timeIn) return "";
  const start = new Date(timeIn);
  const end = timeOut ? new Date(timeOut) : new Date();

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return "";
  }

  const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

function openBadge(v: boolean) {
  return (
    <span className={v ? "badge badge-success" : "badge badge-neutral"}>
      {v ? "Open" : "Closed"}
    </span>
  );
}

function stockOrderBadge(v: boolean) {
  return (
    <span className={v ? "badge badge-brand-blue" : "badge badge-neutral"}>
      {v ? "Yes" : "No"}
    </span>
  );
}

function qtyPill(v: number) {
  return <span className="record-pill record-pill-info">{fmtInt(v)}</span>;
}

function countPill(v: number) {
  return <span className="record-pill record-pill-neutral">{fmtInt(v)}</span>;
}

export default function WorkSessionsAllTable({
  defaultStart,
  defaultEnd,
}: {
  defaultStart: string;
  defaultEnd: string;
}) {
  const [workDateFrom, setWorkDateFrom] = useState(defaultStart);
  const [workDateTo, setWorkDateTo] = useState(defaultEnd);

  const [rows, setRows] = useState<SessionRow[]>([]);
  const [relatedBySessionId, setRelatedBySessionId] = useState<Record<string, RelatedSubmissionRow[]>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [totals, setTotals] = useState<ApiResponse["totals"]>({
    totalSessions: 0,
    totalSubmissions: 0,
    totalQuantity: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<SortBy>("timeIn");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<Filters>(DEFAULT_FILTERS);

  const [pageSize, setPageSize] = useState<number>(25);
  const [pageIndex, setPageIndex] = useState<number>(0);

  const offset = pageIndex * pageSize;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedFilters(filters), 300);
    return () => window.clearTimeout(t);
  }, [filters]);

  useEffect(() => {
    setPageIndex(0);
  }, [workDateFrom, workDateTo, sortBy, sortDir, debouncedFilters, pageSize]);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();

    sp.set("workDateFrom", workDateFrom);
    sp.set("workDateTo", workDateTo);
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);
    sp.set("limit", String(pageSize));
    sp.set("offset", String(offset));

    if (debouncedFilters.moduleKey.trim()) sp.set("moduleKey", debouncedFilters.moduleKey.trim());
    if (debouncedFilters.areaCode.trim()) sp.set("areaCode", debouncedFilters.areaCode.trim());
    if (debouncedFilters.operatorName.trim()) sp.set("operatorName", debouncedFilters.operatorName.trim());
    if (debouncedFilters.employeeNumber.trim()) sp.set("employeeNumber", debouncedFilters.employeeNumber.trim());
    if (debouncedFilters.isOpen === "true" || debouncedFilters.isOpen === "false") {
      sp.set("isOpen", debouncedFilters.isOpen);
    }

    return sp.toString();
  }, [workDateFrom, workDateTo, sortBy, sortDir, debouncedFilters, pageSize, offset]);

  async function load(qs: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/work-sessions-all?${qs}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = (await res.json().catch(() => ({}))) as Partial<ApiResponse> & {
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load work sessions.");
      }

      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setRelatedBySessionId(
        data?.relatedBySessionId && typeof data.relatedBySessionId === "object"
          ? data.relatedBySessionId
          : {}
      );
      setTotalCount(Number.isFinite(data?.totalCount) ? Number(data.totalCount) : 0);
      setTotals({
        totalSessions: Number(data?.totals?.totalSessions ?? 0),
        totalSubmissions: Number(data?.totals?.totalSubmissions ?? 0),
        totalQuantity: Number(data?.totals?.totalQuantity ?? 0),
      });
    } catch (err: any) {
      setError(err?.message || "Failed to load work sessions.");
      setRows([]);
      setRelatedBySessionId({});
      setTotalCount(0);
      setTotals({
        totalSessions: 0,
        totalSubmissions: 0,
        totalQuantity: 0,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(queryString);
  }, [queryString]);

  function onToggleSort(key: string) {
    const next = key as SortBy;

    if (sortBy !== next) {
      setSortBy(next);
      setSortDir("asc");
      return;
    }

    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  function onFilterChange(key: string, value: string) {
    if (key in DEFAULT_FILTERS) {
      setFilters((f) => ({ ...f, [key]: value }));
    }
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
    setWorkDateFrom(defaultStart);
    setWorkDateTo(defaultEnd);
    setSortBy("timeIn");
    setSortDir("desc");
    setPageIndex(0);
  }

  function applyRange(r: { from: string; to: string }) {
    setWorkDateFrom(r.from);
    setWorkDateTo(r.to);
  }

  const columns: Column<SessionRow>[] = useMemo(
    () => [
      {
        key: "workDate",
        header: "WORK DATE",
        sortable: true,
        filterRender: (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              className="input"
              style={{ minWidth: 0, width: 150 }}
              type="date"
              value={workDateFrom}
              onChange={(e) => setWorkDateFrom(e.target.value)}
              title="From"
            />
            <span style={{ fontSize: 12, opacity: 0.7 }}>–</span>
            <input
              className="input"
              style={{ minWidth: 0, width: 150 }}
              type="date"
              value={workDateTo}
              onChange={(e) => setWorkDateTo(e.target.value)}
              title="To"
            />
          </div>
        ),
        render: (r) => fmtDateOnly(r.workDate),
        getSearchText: (r) => fmtDateOnly(r.workDate),
      },
      {
        key: "timeIn",
        header: "TIME IN",
        sortable: true,
        render: (r) => fmtDateTime(r.timeIn),
        getSearchText: (r) => fmtDateTime(r.timeIn),
      },
      {
        key: "timeOut",
        header: "TIME OUT",
        sortable: true,
        render: (r) => fmtDateTime(r.timeOut),
        getSearchText: (r) => fmtDateTime(r.timeOut),
      },
      {
        key: "operatorName",
        header: "OPERATOR",
        sortable: true,
        filterable: true,
        placeholder: "Operator",
        render: (r) => (
          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontWeight: 700, color: "var(--text)" }}>{r.operatorName ?? ""}</div>
            {r.employeeNumber != null ? (
              <div style={{ fontSize: 12, color: "var(--text-soft)" }}>Emp #{r.employeeNumber}</div>
            ) : null}
          </div>
        ),
        getSearchText: (r) => `${r.operatorName ?? ""} ${r.employeeNumber ?? ""}`.trim(),
      },
      {
        key: "moduleKey",
        header: "MODULE",
        sortable: true,
        filterable: true,
        placeholder: "Module",
        render: (r) => <span className="record-pill record-pill-neutral">{r.moduleKey ?? ""}</span>,
        getSearchText: (r) => r.moduleKey ?? "",
      },
      {
        key: "areaCode",
        header: "AREA",
        sortable: true,
        filterable: true,
        placeholder: "Area",
        render: (r) => (
          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontWeight: 700, color: "var(--text)" }}>{r.areaLabel || r.areaCode || ""}</div>
            {r.shift ? <div style={{ fontSize: 12, color: "var(--text-soft)" }}>{r.shift}</div> : null}
          </div>
        ),
        getSearchText: (r) => `${r.areaLabel ?? ""} ${r.areaCode ?? ""} ${r.shift ?? ""}`.trim(),
      },
      {
        key: "isOpen",
        header: "STATUS",
        sortable: true,
        filterRender: (
          <select
            className="select"
            value={filters.isOpen}
            onChange={(e) => onFilterChange("isOpen", e.target.value)}
          >
            <option value="">All</option>
            <option value="true">Open</option>
            <option value="false">Closed</option>
          </select>
        ),
        render: (r) => openBadge(!!r.isOpen),
        getSearchText: (r) => (r.isOpen ? "Open" : "Closed"),
      },
      {
        key: "submissionCount",
        header: "SUBMISSIONS",
        sortable: true,
        render: (r) => countPill(Number(r.submissionCount ?? 0)),
        getSearchText: (r) => String(r.submissionCount ?? 0),
      },
      {
        key: "totalQuantity",
        header: "TOTAL QTY",
        sortable: true,
        render: (r) => qtyPill(Number(r.totalQuantity ?? 0)),
        getSearchText: (r) => String(r.totalQuantity ?? 0),
      },
      {
        key: "duration",
        header: "DURATION",
        render: (r) => <span style={{ fontWeight: 700 }}>{durationText(r.timeIn, r.timeOut)}</span>,
        getSearchText: (r) => durationText(r.timeIn, r.timeOut),
      },
      {
        key: "notes",
        header: "NOTES",
        render: (r) => (
          <div style={{ maxWidth: 260, whiteSpace: "normal", color: "var(--text-muted)" }}>
            {r.notes ?? ""}
          </div>
        ),
        getSearchText: (r) => r.notes ?? "",
      },
      {
        key: "view",
        header: "",
        render: (r) => (
          <Link
            href={`/platform/work-sessions/${encodeURIComponent(r.id)}`}
            className="btn btn-secondary btn-sm"
          >
            View
          </Link>
        ),
      },
    ],
    [workDateFrom, workDateTo, filters.isOpen]
  );

  const toolbar = (
    <>
      <button
        type="button"
        onClick={clearFilters}
        className="btn btn-secondary"
        disabled={loading}
      >
        Clear Filters
      </button>

      <button
        type="button"
        onClick={() => applyRange(getRangeLastNDays(7))}
        className="btn btn-secondary"
        disabled={loading}
      >
        Last 7
      </button>

      <button
        type="button"
        onClick={() => applyRange(getRangeLastNDays(30))}
        className="btn btn-secondary"
        disabled={loading}
      >
        Last 30
      </button>

      <Link href="/platform/work-sessions" className="btn btn-secondary">
        Open Work Sessions
      </Link>
    </>
  );

  return (
    <div className="section-stack">
      <style jsx global>{`
        .work-sessions-all .table-card {
          overflow: visible;
        }

        .work-sessions-all .dt-table {
          border-collapse: separate !important;
          border-spacing: 0 14px !important;
          background: transparent !important;
        }

        .work-sessions-all .dt-table thead tr:first-child th {
          border-bottom: 1px solid var(--border-table-strong);
        }

        .work-sessions-all .dt-table thead tr:nth-child(2) th {
          border-bottom: 1px solid var(--border-table);
        }

        .work-sessions-all .dt-row > td {
          background: var(--surface);
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          color: var(--text-muted);
          vertical-align: top;
          padding-top: 14px;
          padding-bottom: 14px;
        }

        .work-sessions-all .dt-row > td:first-child {
          border-left: 1px solid var(--border);
          border-top-left-radius: 14px;
          border-bottom-left-radius: 14px;
          position: relative;
          overflow: hidden;
        }

        .work-sessions-all .dt-row > td:last-child {
          border-right: 1px solid var(--border);
          border-top-right-radius: 14px;
          border-bottom-right-radius: 14px;
        }

        .work-sessions-all .dt-row:hover > td {
          background: color-mix(in srgb, var(--surface) 94%, var(--brand-blue) 6%);
        }

        .work-sessions-all .session-open > td:first-child::before,
        .work-sessions-all .session-closed > td:first-child::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 5px;
        }

        .work-sessions-all .session-open > td:first-child::before {
          background: #3bb273;
        }

        .work-sessions-all .session-closed > td:first-child::before {
          background: var(--border-table-strong);
        }

        .work-sessions-all .dt-expanded-cell {
          padding: 0 0 8px 0 !important;
          border: 0 !important;
          background: transparent !important;
        }

        .work-sessions-all .session-expanded-wrap {
          margin: -2px 0 0 22px;
          border: 1px solid var(--border);
          border-radius: 16px;
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--surface-subtle) 88%, white 12%),
            var(--surface)
          );
          box-shadow: var(--shadow-sm);
          padding: 14px;
        }

        .work-sessions-all .session-expanded-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .work-sessions-all .session-expanded-title {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-weight: 800;
          color: var(--text);
        }

        .work-sessions-all .session-expanded-summary {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .work-sessions-all .session-expanded-inner {
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          background: var(--surface);
        }

        .work-sessions-all .session-expanded-inner .table-clean th {
          background: color-mix(in srgb, var(--surface-muted) 88%, white 12%);
          border-bottom: 1px solid var(--border-table-strong);
        }

        .work-sessions-all .session-expanded-empty {
          border: 1px dashed var(--border-strong);
          border-radius: 12px;
          padding: 14px;
          background: color-mix(in srgb, var(--surface-subtle) 88%, white 12%);
          color: var(--text-muted);
        }

        .work-sessions-all .session-meta-stack {
          display: grid;
          gap: 2px;
        }

        .work-sessions-all .session-meta-primary {
          font-weight: 700;
          color: var(--text);
        }

        .work-sessions-all .session-meta-secondary {
          font-size: 12px;
          color: var(--text-soft);
        }
      `}</style>

      <div className="card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 800 }}>
              Sessions: {fmtInt(totals.totalSessions)}
            </div>
            <div style={{ fontWeight: 800 }}>
              Submissions: {fmtInt(totals.totalSubmissions)}
            </div>
            <div style={{ fontWeight: 800 }}>
              Total Quantity: {fmtInt(totals.totalQuantity)}
            </div>
          </div>
        </div>
      </div>

      <div className="work-sessions-all">
        <DataTable<SessionRow>
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          sortBy={sortBy}
          sortDir={sortDir}
          onToggleSort={onToggleSort}
          filters={filters}
          onFilterChange={onFilterChange}
          totalCount={totalCount}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={(next) => {
            setPageSize(next);
            setPageIndex(0);
          }}
          toolbar={toolbar}
          rowKey={(row) => row.id}
          emptyText="No work sessions found."
          csvFilename="work-sessions-all.csv"
          rowClassName={(row) => (row.isOpen ? "session-open" : "session-closed")}
          rowToCsv={(row) => ({
            "Work Date": fmtDateOnly(row.workDate),
            "Time In": fmtDateTime(row.timeIn),
            "Time Out": fmtDateTime(row.timeOut),
            Operator: row.operatorName,
            "Employee #": row.employeeNumber ?? "",
            Module: row.moduleKey,
            Area: row.areaLabel || row.areaCode || "",
            Shift: row.shift ?? "",
            Status: row.isOpen ? "Open" : "Closed",
            Submissions: row.submissionCount ?? 0,
            "Total Quantity": row.totalQuantity ?? 0,
            Duration: durationText(row.timeIn, row.timeOut),
            Notes: row.notes ?? "",
          })}
          renderExpandedRow={(row) => {
            const related = relatedBySessionId[row.id] || [];

            return (
              <div className="session-expanded-wrap">
                <div className="session-expanded-head">
                  <div className="session-expanded-title">
                    <span>Related Knit Submissions</span>
                    <span className="record-count-badge">{related.length}</span>
                  </div>

                  <div className="session-expanded-summary">
                    <span className="record-pill record-pill-neutral">
                      Session Submissions: {fmtInt(row.submissionCount)}
                    </span>
                    <span className="record-pill record-pill-info">
                      Session Qty: {fmtInt(row.totalQuantity)}
                    </span>
                  </div>
                </div>

                {row.moduleKey !== "knit_production" ? (
                  <div className="session-expanded-empty">
                    Related submission expansion is currently enabled for Knit Production sessions only.
                  </div>
                ) : related.length === 0 ? (
                  <div className="session-expanded-empty">
                    No knit submissions found for this session.
                  </div>
                ) : (
                  <div className="session-expanded-inner">
                    <div className="table-scroll">
                      <table className="table-clean">
                        <thead>
                          <tr>
                            <th>Entry Date</th>
                            <th>Entry Time</th>
                            <th>Name</th>
                            <th>Sales Order</th>
                            <th>Area</th>
                            <th>Shift</th>
                            <th>Stock</th>
                            <th>Lines</th>
                            <th>Total Qty</th>
                            <th>Notes</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {related.map((item) => (
                            <tr key={item.id}>
                              <td>{fmtDateOnly(item.entryDate)}</td>
                              <td>{fmtDateTime(item.entryTs)}</td>
                              <td>
                                <div className="session-meta-stack">
                                  <div className="session-meta-primary">{item.name ?? ""}</div>
                                  {item.employeeNumber != null ? (
                                    <div className="session-meta-secondary">Emp #{item.employeeNumber}</div>
                                  ) : null}
                                </div>
                              </td>
                              <td>{item.salesOrder ?? ""}</td>
                              <td>{item.knitArea ?? ""}</td>
                              <td>{item.shift ?? ""}</td>
                              <td>{stockOrderBadge(!!item.stockOrder)}</td>
                              <td>{fmtInt(item.lineCount)}</td>
                              <td>
                                <span className="record-pill record-pill-info">
                                  {fmtInt(item.totalQuantity)}
                                </span>
                              </td>
                              <td style={{ whiteSpace: "pre-wrap", maxWidth: 220 }}>{item.notes ?? ""}</td>
                              <td>
                                <Link
                                  href={`/knit-production/${encodeURIComponent(item.id)}`}
                                  className="btn btn-secondary btn-sm"
                                >
                                  View
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}