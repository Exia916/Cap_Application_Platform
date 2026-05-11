"use client";

import { useEffect, useMemo, useState } from "react";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";
import ReportVisualization from "./ReportVisualization";

type DatasetColumn = {
  key: string;
  label: string;
  type: string;
  filterable: boolean;
  sortable: boolean;
  groupable: boolean;
  aggregatable: boolean;
  defaultVisible: boolean;
};

type Dataset = {
  key: string;
  label: string;
  description: string;
  category: string;
  defaultColumns: string[];
  defaultSort: { column: string; direction: "asc" | "desc" };
  columns: DatasetColumn[];
};

type RunResult = {
  columns: Array<{ key: string; label: string; type: string }>;
  rows: Record<string, any>[];
  total: number;
  page: number;
  pageSize: number;
};

const VISUALIZATIONS = [
  { key: "datatable", label: "DataTable" },
  { key: "table", label: "Table" },
  { key: "kpi", label: "KPI Card" },
  { key: "bar", label: "Bar Chart" },
  { key: "line", label: "Line Chart" },
  { key: "pie", label: "Pie Chart" },
  { key: "donut", label: "Donut Chart" },
  { key: "heatmap", label: "Heatmap" },
];

export default function ReportBuilderClient() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetKey, setDatasetKey] = useState("");

  const dataset = useMemo(
    () => datasets.find((d) => d.key === datasetKey) ?? null,
    [datasets, datasetKey]
  );

  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [dateColumn, setDateColumn] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [textColumn, setTextColumn] = useState("");
  const [textValue, setTextValue] = useState("");
  const [grouping, setGrouping] = useState<string[]>([]);
  const [aggregateColumn, setAggregateColumn] = useState("");
  const [aggregateFunction, setAggregateFunction] = useState("sum");
  const [visualization, setVisualization] = useState("datatable");

  const [reportName, setReportName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [sharedRoles, setSharedRoles] = useState<string[]>([]);
  const [sharedDepartments, setSharedDepartments] = useState("");

  const [result, setResult] = useState<RunResult | null>(null);
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function loadDatasets() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/reports/datasets", {
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load report datasets.");
      }

      const loaded = Array.isArray(data?.datasets) ? data.datasets : [];
      setDatasets(loaded);

      if (loaded[0]) {
        setDatasetKey(loaded[0].key);
        setSelectedColumns(loaded[0].defaultColumns ?? []);
        setSortBy(loaded[0].defaultSort?.column ?? "");
        setSortDir(loaded[0].defaultSort?.direction ?? "desc");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load report datasets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDatasets();
  }, []);

  useEffect(() => {
    if (!dataset) return;

    setSelectedColumns(dataset.defaultColumns ?? []);
    setGrouping([]);
    setAggregateColumn("");
    setDateColumn(dataset.columns.find((c) => c.type === "date")?.key ?? "");
    setTextColumn(dataset.columns.find((c) => c.type === "text" && c.filterable)?.key ?? "");
    setSortBy(dataset.defaultSort?.column ?? "");
    setSortDir(dataset.defaultSort?.direction ?? "desc");
    setResult(null);
  }, [datasetKey]);

  const filters = useMemo(() => {
    const f: Record<string, any> = {};

    if (dateColumn && (dateFrom || dateTo)) {
      f[dateColumn] = {
        operator: "dateRange",
        from: dateFrom || null,
        to: dateTo || null,
      };
    }

    if (textColumn && textValue.trim()) {
      f[textColumn] = {
        operator: "contains",
        value: textValue.trim(),
      };
    }

    return f;
  }, [dateColumn, dateFrom, dateTo, textColumn, textValue]);

  const aggregations = useMemo(() => {
    if (!aggregateColumn) return [];

    return [
      {
        column: aggregateColumn,
        function: aggregateFunction,
      },
    ];
  }, [aggregateColumn, aggregateFunction]);

  async function run(nextPageIndex = pageIndex, nextPageSize = pageSize) {
    if (!dataset) return;

    try {
      setRunning(true);
      setError(null);
      setSuccessMsg(null);

      const res = await fetch("/api/reports/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          datasetKey: dataset.key,
          selectedColumns,
          filters,
          sort: sortBy ? { column: sortBy, direction: sortDir } : null,
          grouping,
          aggregations,
          visualization,
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

  async function saveReport() {
    if (!dataset) return;

    if (!reportName.trim()) {
      setError("Report name is required.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMsg(null);

      const res = await fetch("/api/reports/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reportName: reportName.trim(),
          description: description.trim() || null,
          datasetKey: dataset.key,
          visibility,
          sharedRoles,
          sharedDepartments: sharedDepartments
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          selectedColumns,
          filters,
          sort: sortBy ? { column: sortBy, direction: sortDir } : null,
          grouping,
          aggregations,
          visualization,
          chartConfig: null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save report.");
      }

      setSuccessMsg("Report saved.");
    } catch (err: any) {
      setError(err?.message || "Failed to save report.");
    } finally {
      setSaving(false);
    }
  }

  async function exportCsv() {
    if (!dataset) return;

    const res = await fetch("/api/reports/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        datasetKey: dataset.key,
        selectedColumns,
        filters,
        sort: sortBy ? { column: sortBy, direction: sortDir } : null,
        grouping,
        aggregations,
        visualization,
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
    a.download = `${reportName.trim() || "cap-report"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

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

  function toggleSelectedColumn(key: string) {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  }

  function toggleGrouping(key: string) {
    setGrouping((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  }

  function toggleSharedRole(role: string) {
    setSharedRoles((prev) =>
      prev.includes(role) ? prev.filter((x) => x !== role) : [...prev, role]
    );
  }

  function onToggleSort(key: string) {
    if (sortBy !== key) {
      setSortBy(key);
      setSortDir("asc");
      return;
    }

    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  if (loading) {
    return <div className="card text-muted">Loading report builder…</div>;
  }

  return (
    <div className="section-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Create New Report</h1>
          <p className="page-subtitle">
            Build reports from approved CAP datasets. SQL entry is not allowed.
          </p>
        </div>

        <div className="record-actions">
          <button type="button" className="btn btn-secondary" onClick={() => run(0, pageSize)}>
            {running ? "Running…" : "Run Report"}
          </button>

          <button type="button" className="btn btn-secondary" onClick={exportCsv}>
            Export CSV
          </button>

          <button type="button" className="btn btn-primary" onClick={saveReport} disabled={saving}>
            {saving ? "Saving…" : "Save Report"}
          </button>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {successMsg ? <div className="alert alert-success">{successMsg}</div> : null}

      <div className="card section-stack">
        <h2>Report Setup</h2>

        <div className="form-grid">
          <div>
            <label className="field-label">Dataset</label>
            <select
              className="select"
              value={datasetKey}
              onChange={(e) => setDatasetKey(e.target.value)}
            >
              {datasets.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Visualization</label>
            <select
              className="select"
              value={visualization}
              onChange={(e) => setVisualization(e.target.value)}
            >
              {VISUALIZATIONS.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Sort Column</label>
            <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="">None</option>
              {dataset?.columns
                .filter((c) => c.sortable)
                .map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="field-label">Sort Direction</label>
            <select
              className="select"
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as SortDir)}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card section-stack">
        <h2>Columns</h2>

        <div className="form-grid">
          {dataset?.columns.map((column) => (
            <label key={column.key} className="master-checkbox-row">
              <input
                type="checkbox"
                checked={selectedColumns.includes(column.key)}
                onChange={() => toggleSelectedColumn(column.key)}
              />
              {column.label}
            </label>
          ))}
        </div>
      </div>

      <div className="card section-stack">
        <h2>Filters</h2>

        <div className="form-grid">
          <div>
            <label className="field-label">Date Column</label>
            <select className="select" value={dateColumn} onChange={(e) => setDateColumn(e.target.value)}>
              <option value="">None</option>
              {dataset?.columns
                .filter((c) => c.filterable && (c.type === "date" || c.type === "datetime"))
                .map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="field-label">From</label>
            <input className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          <div>
            <label className="field-label">To</label>
            <input className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          <div>
            <label className="field-label">Text Filter Column</label>
            <select className="select" value={textColumn} onChange={(e) => setTextColumn(e.target.value)}>
              <option value="">None</option>
              {dataset?.columns
                .filter((c) => c.filterable && c.type === "text")
                .map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="field-label">Text Contains</label>
            <input className="input" value={textValue} onChange={(e) => setTextValue(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card section-stack">
        <h2>Grouping & Aggregation</h2>

        <div className="form-grid">
          <div>
            <label className="field-label">Aggregate Column</label>
            <select
              className="select"
              value={aggregateColumn}
              onChange={(e) => setAggregateColumn(e.target.value)}
            >
              <option value="">None</option>
              {dataset?.columns
                .filter((c) => c.aggregatable)
                .map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="field-label">Aggregate Function</label>
            <select
              className="select"
              value={aggregateFunction}
              onChange={(e) => setAggregateFunction(e.target.value)}
            >
              <option value="sum">Sum</option>
              <option value="avg">Average</option>
              <option value="min">Min</option>
              <option value="max">Max</option>
              <option value="count">Count</option>
            </select>
          </div>
        </div>

        <div>
          <label className="field-label">Group By</label>
          <div className="form-grid">
            {dataset?.columns
              .filter((c) => c.groupable)
              .map((column) => (
                <label key={column.key} className="master-checkbox-row">
                  <input
                    type="checkbox"
                    checked={grouping.includes(column.key)}
                    onChange={() => toggleGrouping(column.key)}
                  />
                  {column.label}
                </label>
              ))}
          </div>
        </div>
      </div>

      <div className="card section-stack">
        <h2>Save Settings</h2>

        <div className="form-grid">
          <div>
            <label className="field-label">Report Name</label>
            <input className="input" value={reportName} onChange={(e) => setReportName(e.target.value)} />
          </div>

          <div>
            <label className="field-label">Visibility</label>
            <select className="select" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option value="private">Private</option>
              <option value="role">Shared with Roles</option>
              <option value="department">Shared with Departments</option>
              <option value="public_internal">All Reporting Users</option>
            </select>
          </div>

          <div>
            <label className="field-label">Shared Roles</label>
            <div className="section-stack" style={{ gap: 6 }}>
              {["ADMIN", "MANAGER", "SUPERVISOR"].map((role) => (
                <label key={role} className="master-checkbox-row">
                  <input
                    type="checkbox"
                    checked={sharedRoles.includes(role)}
                    onChange={() => toggleSharedRole(role)}
                  />
                  {role}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="field-label">Shared Departments</label>
            <input
              className="input"
              placeholder="Comma separated"
              value={sharedDepartments}
              onChange={(e) => setSharedDepartments(e.target.value)}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Description</label>
            <textarea
              className="textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
      </div>

      {result ? (
        <ReportVisualization visualization={visualization} columns={result.columns} rows={result.rows} />
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
          onPageIndexChange={(next) => {
            setPageIndex(next);
            run(next, pageSize);
          }}
          onPageSizeChange={(next) => {
            setPageSize(next);
            setPageIndex(0);
            run(0, next);
          }}
          rowKey={(row) => JSON.stringify(row)}
          enableCsvExport={false}
          emptyText="No report results found."
        />
      ) : null}
    </div>
  );
}