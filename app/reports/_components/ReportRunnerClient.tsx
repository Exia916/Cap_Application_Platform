"use client";

import { useEffect, useMemo, useState } from "react";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";
import ReportVisualization from "./ReportVisualization";

type SavedReport = {
  id: string;
  reportName: string;
  description: string | null;
  datasetKey: string;
  selectedColumns: string[];
  filters: Record<string, any>;
  sort: { column: string; direction: "asc" | "desc" } | null;
  grouping: string[];
  aggregations: any[];
  visualization: string;
};

type RunResult = {
  columns: Array<{ key: string; label: string; type: string }>;
  rows: Record<string, any>[];
  total: number;
  page: number;
  pageSize: number;
};

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

      const res = await fetch("/api/reports/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          savedReportId: report.id,
          datasetKey: report.datasetKey,
          selectedColumns: report.selectedColumns,
          filters: report.filters,
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

    const res = await fetch("/api/reports/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        savedReportId: report.id,
        datasetKey: report.datasetKey,
        selectedColumns: report.selectedColumns,
        filters: report.filters,
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
      render: (row) => {
        const value = row[column.key];

        if (value === null || value === undefined) return "";
        if (typeof value === "number") return value.toLocaleString();

        return String(value);
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
        <ReportVisualization
          visualization={report?.visualization || "datatable"}
          columns={result.columns}
          rows={result.rows}
        />
      ) : null}

      {result ? (
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
      ) : null}
    </div>
  );
}