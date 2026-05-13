"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";
import { getReportTemplate, REPORT_TEMPLATES } from "@/lib/reports/reportTemplates";
import ReportSummaryCards from "./ReportSummaryCards";
import ReportVisualization from "./ReportVisualization";

type SavedReport = {
  id: string;
  reportName: string;
  description: string | null;
  datasetKey: string;
  selectedColumns: string[];
  filters: Record<string, any>;
  filterLogic?: "AND" | "OR";
  sort: { column: string; direction: "asc" | "desc" } | null;
  grouping: string[];
  aggregations: any[];
  visualization: string;
  chartConfig?: Record<string, any> | null;
};

type RunResult = {
  columns: Array<{ key: string; label: string; type: string }>;
  rows: Record<string, any>[];
  total: number;
  page: number;
  pageSize: number;
};

function formatDateOnly(value: unknown) {
  if (value === null || value === undefined || value === "") return "";

  const raw = String(value);

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[2]}/${match[3]}/${match[1]}`;
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function formatDateTime(value: unknown) {
  if (value === null || value === undefined || value === "") return "";

  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function fmtCell(value: unknown, type?: string) {
  if (value === null || value === undefined) return "";

  if (type === "date") return formatDateOnly(value);
  if (type === "datetime") return formatDateTime(value);

  if (typeof value === "number") return formatNumber(value);

  const asNumber = Number(value);
  if (type === "number" && Number.isFinite(asNumber)) {
    return formatNumber(asNumber);
  }

  if (typeof value === "boolean") return value ? "Yes" : "No";

  return String(value);
}

function inferTemplate(report: SavedReport | null) {
  if (!report) return null;

  const templateKey = report.chartConfig?.templateKey;
  const direct = getReportTemplate(typeof templateKey === "string" ? templateKey : null);
  if (direct) return direct;

  return REPORT_TEMPLATES.find((template) => template.datasetKey === report.datasetKey) ?? null;
}

function getReportColumnWidth(column: { key: string; type: string }) {
  if (column.key === "record_url") return 90;
  if (column.type === "date") return 130;
  if (column.type === "datetime") return 180;
  if (column.type === "number") return 140;
  if (column.type === "boolean") return 110;

  if (
    column.key.includes("notes") ||
    column.key.includes("instructions") ||
    column.key.includes("description") ||
    column.key.includes("issue") ||
    column.key.includes("resolution")
  ) {
    return 280;
  }

  if (
    column.key.includes("operator") ||
    column.key.includes("customer") ||
    column.key.includes("designer") ||
    column.key.includes("digitizer")
  ) {
    return 220;
  }

  if (column.key.includes("sales_order")) return 160;

  return 180;
}

export default function ReportRunnerClient({ savedReportId }: { savedReportId: string }) {
  const [report, setReport] = useState<SavedReport | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const template = useMemo(() => inferTemplate(report), [report]);
  const isDetailReport = report?.chartConfig?.advancedOutputMode === "detail";

  async function loadReport() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/reports/saved/${encodeURIComponent(savedReportId)}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load report.");
      }

      setReport(data.report);
      setSortBy(data.report?.sort?.column || "");
      setSortDir(data.report?.sort?.direction || "desc");
    } catch (err: any) {
      setError(err?.message || "Failed to load report.");
    } finally {
      setLoading(false);
    }
  }

  async function run(nextPageIndex = pageIndex, nextPageSize = pageSize) {
    if (!report) return;

    try {
      setRunning(true);
      setError(null);

      const filterLogic =
        report.filterLogic ||
        (report.chartConfig?.filterLogic === "OR" ? "OR" : "AND");

      const res = await fetch("/api/reports/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          savedReportId: report.id,
          datasetKey: report.datasetKey,
          selectedColumns: report.selectedColumns,
          filters: report.filters,
          filterLogic,
          sort: sortBy ? { column: sortBy, direction: sortDir } : report.sort,
          grouping: report.grouping,
          aggregations: report.aggregations,
          visualization: report.visualization,
          page: nextPageIndex + 1,
          pageSize: nextPageSize,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to run report.");
      }

      setResult(data);
    } catch (err: any) {
      setError(err?.message || "Failed to run report.");
    } finally {
      setRunning(false);
    }
  }

  async function exportCsv() {
    if (!report) return;

    const filterLogic =
      report.filterLogic ||
      (report.chartConfig?.filterLogic === "OR" ? "OR" : "AND");

    const res = await fetch("/api/reports/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        savedReportId: report.id,
        datasetKey: report.datasetKey,
        selectedColumns: report.selectedColumns,
        filters: report.filters,
        filterLogic,
        sort: sortBy ? { column: sortBy, direction: sortDir } : report.sort,
        grouping: report.grouping,
        aggregations: report.aggregations,
        visualization: report.visualization,
        pageSize: 10000,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Export failed.");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.reportName || "cap-report"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedReportId]);

  useEffect(() => {
    if (report) run(0, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);

  const tableColumns: Column<Record<string, any>>[] = useMemo(() => {
    return (result?.columns ?? []).map((column) => ({
      key: column.key,
      header: column.label,
      sortable: true,
      width: getReportColumnWidth(column),
      render: (row) => {
        const value = row[column.key];

        if (column.key === "record_url") {
          const href = String(value || "").trim();

          if (!href) return "";

          return (
            <Link href={href} className="btn btn-secondary btn-sm">
              Open
            </Link>
          );
        }

        return (
          <span
            className={
              column.type === "number"
                ? "report-output-cell report-output-number"
                : "report-output-cell"
            }
          >
            {fmtCell(value, column.type)}
          </span>
        );
      },
      getSearchText: (row) => String(row[column.key] ?? ""),
    }));
  }, [result?.columns]);

  function onToggleSort(key: string) {
    if (sortBy !== key) {
      setSortBy(key);
      setSortDir("asc");
      return;
    }

    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  function onPageIndexChange(next: number) {
    setPageIndex(next);
    run(next, pageSize);
  }

  function onPageSizeChange(next: number) {
    setPageSize(next);
    setPageIndex(0);
    run(0, next);
  }

  if (loading) {
    return <div className="card text-muted">Loading report…</div>;
  }

  return (
    <div className="section-stack">
      <style>{`
        .report-output-table .dt-table th,
        .report-output-table .dt-table td {
          text-align: left !important;
          white-space: nowrap;
          vertical-align: middle;
        }

        .report-output-table .dt-table {
          table-layout: auto !important;
          min-width: 100%;
        }

        .report-output-cell {
          display: inline-block;
          max-width: 280px;
          overflow: hidden;
          text-overflow: ellipsis;
          vertical-align: middle;
        }

        .report-output-number {
          font-variant-numeric: tabular-nums;
        }
      `}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">{report?.reportName || "Report"}</h1>
          {report?.description ? (
            <p className="page-subtitle">{report.description}</p>
          ) : null}
        </div>

        <div className="record-actions">
          <button type="button" className="btn btn-secondary" onClick={() => run(0, pageSize)}>
            {running ? "Running…" : "Run"}
          </button>

          <button type="button" className="btn btn-primary" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      {result ? (
        <ReportSummaryCards
          rows={result.rows}
          columns={result.columns}
          cards={isDetailReport ? undefined : template?.summaryCards}
        />
      ) : null}

      {result ? (
        <ReportVisualization
          visualization={report?.visualization || "datatable"}
          columns={result.columns}
          rows={result.rows}
        />
      ) : null}

      {result ? (
        <div className="report-output-table">
          <DataTable
            columns={tableColumns}
            rows={result.rows}
            loading={running}
            error={error}
            sortBy={sortBy}
            sortDir={sortDir}
            onToggleSort={onToggleSort}
            filters={{}}
            onFilterChange={() => {}}
            totalCount={result.total}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPageIndexChange={onPageIndexChange}
            onPageSizeChange={onPageSizeChange}
            rowKey={(row) => JSON.stringify(row)}
            enableCsvExport={false}
            emptyText="No report results found."
          />
        </div>
      ) : null}
    </div>
  );
}