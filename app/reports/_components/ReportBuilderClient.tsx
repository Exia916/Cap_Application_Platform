"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";
import type { ReportDatePresetKey } from "@/lib/reports/reportDatePresets";
import { getReportDatePresetRange } from "@/lib/reports/reportDatePresets";
import type {
  ReportCalculatedColumn,
  ReportFilterLogic,
  ReportFilterValue,
} from "@/lib/reports/reportTypes";
import {
  formatReportCell,
  humanizeReportLabel,
} from "@/lib/reports/reportFormatters";
import {
  getDefaultReportTemplate,
  getReportTemplate,
  REPORT_TEMPLATES,
  type ReportTemplate,
} from "@/lib/reports/reportTemplates";
import ReportCalculatedColumnsBuilder from "./ReportCalculatedColumnsBuilder";
import ReportFilterBuilder from "./ReportFilterBuilder";
import {
  buildReportFilters,
  splitReportFilters,
} from "./reportFilterState";
import ReportSummaryCards from "./ReportSummaryCards";
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

type FilterValue = ReportFilterValue;

type RunResult = {
  columns: Array<{
    key: string;
    label: string;
    type: string;
    calculated?: boolean;
    format?: string;
    decimals?: number;
  }>;
  rows: Record<string, any>[];
  total: number;
  page: number;
  pageSize: number;
};

type SavedReportForEdit = {
  id: string;
  reportName: string;
  description: string | null;
  datasetKey: string;
  visibility: string;
  sharedRoles: string[];
  sharedDepartments: string[];
  selectedColumns: string[];
  filters: Record<string, FilterValue>;
  filterLogic?: ReportFilterLogic;
  sort: { column: string; direction: "asc" | "desc" } | null;
  grouping: string[];
  aggregations: any[];
  calculatedColumns?: ReportCalculatedColumn[];
  visualization: string;
  chartConfig?: Record<string, any> | null;
  canEdit?: boolean;
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

function buildTemplateDateRange(template: ReportTemplate | null) {
  if (!template) return { from: "", to: "" };
  return getReportDatePresetRange(template.defaultDatePreset) ?? { from: "", to: "" };
}

function moveArrayItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;

  const copy = [...items];
  const current = copy[index];
  copy[index] = copy[nextIndex];
  copy[nextIndex] = current;
  return copy;
}

function getReportColumnWidth(column: { key: string; type: string }) {
  if (column.key === "record_url") return 120;
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

function formatCalculatedCell(value: unknown, column: RunResult["columns"][number]) {
  if (value === null || value === undefined || value === "") return "";

  const numeric = Number(value);

  if (column.type === "number" && Number.isFinite(numeric)) {
    const decimals =
      typeof column.decimals === "number" && Number.isFinite(column.decimals)
        ? Math.max(0, Math.min(6, Math.trunc(column.decimals)))
        : undefined;

    if (column.format === "percent") {
      return `${numeric.toLocaleString(undefined, {
        minimumFractionDigits: decimals ?? 2,
        maximumFractionDigits: decimals ?? 2,
      })}%`;
    }

    if (column.format === "decimal") {
      return numeric.toLocaleString(undefined, {
        minimumFractionDigits: decimals ?? 2,
        maximumFractionDigits: decimals ?? 2,
      });
    }

    return numeric.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  return formatReportCell(value, column.type);
}

export default function ReportBuilderClient({
  savedReportId,
}: {
  savedReportId?: string;
}) {
  const router = useRouter();
  const isEditMode = !!savedReportId;

  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [advancedOutputMode, setAdvancedOutputMode] = useState<"detail" | "summary">(
    "summary"
  );

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [templateKey, setTemplateKey] = useState(getDefaultReportTemplate()?.key ?? "");

  const template = useMemo(() => getReportTemplate(templateKey), [templateKey]);

  const [datasetKey, setDatasetKey] = useState("");
  const dataset = useMemo(
    () => datasets.find((d) => d.key === datasetKey) ?? null,
    [datasets, datasetKey]
  );

  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [dateColumn, setDateColumn] = useState("");
  const [datePreset, setDatePreset] = useState<ReportDatePresetKey>("last7Days");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [filterLogic, setFilterLogic] = useState<ReportFilterLogic>("AND");
  const [fieldFilters, setFieldFilters] = useState<Record<string, FilterValue>>({});

  const [grouping, setGrouping] = useState<string[]>([]);
  const [aggregateColumn, setAggregateColumn] = useState("");
  const [aggregateFunction, setAggregateFunction] = useState("sum");
  const [aggregations, setAggregations] = useState<any[]>([]);
  const [calculatedColumns, setCalculatedColumns] = useState<ReportCalculatedColumn[]>(
    []
  );

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
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const requestFilters = useMemo(
    () =>
      buildReportFilters({
        dateColumn,
        dateFrom,
        dateTo,
        fieldFilters,
      }),
    [dateColumn, dateFrom, dateTo, fieldFilters]
  );

  function applyTemplate(nextTemplate: ReportTemplate, loadedDatasets = datasets) {
    const targetDataset = loadedDatasets.find((d) => d.key === nextTemplate.datasetKey);

    if (!targetDataset) {
      setError(`Dataset is not available: ${nextTemplate.datasetKey}`);
      return;
    }

    const range = buildTemplateDateRange(nextTemplate);

    setTemplateKey(nextTemplate.key);
    setDatasetKey(nextTemplate.datasetKey);
    setSelectedColumns(nextTemplate.defaultColumns);
    setDateColumn(nextTemplate.defaultDateColumn);
    setDatePreset(nextTemplate.defaultDatePreset);
    setDateFrom(range.from);
    setDateTo(range.to);
    setFilterLogic(nextTemplate.defaultFilterLogic ?? "AND");
    setFieldFilters({ ...((nextTemplate.defaultFilters ?? {}) as Record<string, FilterValue>) });
    setGrouping(nextTemplate.defaultGrouping);
    setAggregations(nextTemplate.defaultAggregations);
    setCalculatedColumns([]);
    setAggregateColumn(nextTemplate.defaultAggregations[0]?.column ?? "");
    setAggregateFunction(nextTemplate.defaultAggregations[0]?.function ?? "sum");
    setVisualization(nextTemplate.defaultVisualization);
    setSortBy(nextTemplate.defaultSort.column);
    setSortDir(nextTemplate.defaultSort.direction);
    setReportName(nextTemplate.label);
    setDescription(nextTemplate.description);
    setAdvancedOutputMode("summary");
    setResult(null);
    setPageIndex(0);
  }

  function applyDatasetDefaults(nextDataset: Dataset) {
    setDatasetKey(nextDataset.key);
    setSelectedColumns(nextDataset.defaultColumns ?? []);
    setDateColumn(
      nextDataset.columns.find((c) => c.type === "date" || c.type === "datetime")?.key ?? ""
    );
    setDatePreset("last7Days");

    const range = getReportDatePresetRange("last7Days");
    setDateFrom(range?.from ?? "");
    setDateTo(range?.to ?? "");

    setFilterLogic("AND");
    setFieldFilters({});
    setGrouping([]);
    setAggregations([]);
    setCalculatedColumns([]);
    setAggregateColumn("");
    setAggregateFunction("sum");
    setVisualization("datatable");
    setSortBy(nextDataset.defaultSort?.column ?? "");
    setSortDir(nextDataset.defaultSort?.direction ?? "desc");
    setAdvancedOutputMode("detail");
    setResult(null);
    setPageIndex(0);
  }

  function hydrateSavedReport(report: SavedReportForEdit, loadedDatasets: Dataset[]) {
    const targetDataset = loadedDatasets.find((d) => d.key === report.datasetKey);

    if (!targetDataset) {
      setError(`Dataset is not available: ${report.datasetKey}`);
      return;
    }

    const chartConfig = report.chartConfig ?? {};
    const nextTemplateKey =
      typeof chartConfig.templateKey === "string" ? chartConfig.templateKey : "";
    const nextTemplate = getReportTemplate(nextTemplateKey);
    const preferredDateColumn = nextTemplate?.defaultDateColumn ?? "";

    const split = splitReportFilters(
      report.filters,
      targetDataset.columns,
      preferredDateColumn
    );

    const savedCalculatedColumns = Array.isArray(report.calculatedColumns)
      ? report.calculatedColumns
      : Array.isArray(chartConfig.calculatedColumns)
        ? (chartConfig.calculatedColumns as ReportCalculatedColumn[])
        : [];

    setDatasetKey(report.datasetKey);
    setSelectedColumns(
      report.selectedColumns?.length ? report.selectedColumns : targetDataset.defaultColumns
    );
    setDateColumn(split.dateColumn);
    setDatePreset(split.datePreset);
    setDateFrom(split.dateFrom);
    setDateTo(split.dateTo);
    setFieldFilters(split.fieldFilters as Record<string, FilterValue>);
    setFilterLogic(report.filterLogic || (chartConfig.filterLogic === "OR" ? "OR" : "AND"));

    setGrouping(report.grouping ?? []);
    setAggregations(report.aggregations ?? []);
    setCalculatedColumns(savedCalculatedColumns);
    setAggregateColumn(report.aggregations?.[0]?.column ?? "");
    setAggregateFunction(report.aggregations?.[0]?.function ?? "sum");

    setVisualization(report.visualization || "datatable");
    setSortBy(report.sort?.column || targetDataset.defaultSort?.column || "");
    setSortDir(report.sort?.direction || targetDataset.defaultSort?.direction || "desc");

    setReportName(report.reportName || "");
    setDescription(report.description || "");
    setVisibility(report.visibility || "private");
    setSharedRoles(report.sharedRoles ?? []);
    setSharedDepartments((report.sharedDepartments ?? []).join(", "));

    setTemplateKey(nextTemplate?.key ?? "");
    setMode(chartConfig.mode === "advanced" ? "advanced" : nextTemplate ? "simple" : "advanced");
    setAdvancedOutputMode(chartConfig.advancedOutputMode === "detail" ? "detail" : "summary");

    setResult(null);
    setPageIndex(0);
  }

  async function loadDatasets() {
    try {
      setLoading(true);
      setError(null);

      const datasetsRes = await fetch("/api/reports/datasets", {
        credentials: "include",
        cache: "no-store",
      });

      const datasetsData = await datasetsRes.json().catch(() => ({}));

      if (!datasetsRes.ok) {
        throw new Error(datasetsData?.error || "Failed to load report datasets.");
      }

      const loaded = Array.isArray(datasetsData?.datasets) ? datasetsData.datasets : [];
      setDatasets(loaded);

      if (isEditMode) {
        const reportRes = await fetch(
          `/api/reports/saved/${encodeURIComponent(savedReportId!)}`,
          {
            credentials: "include",
            cache: "no-store",
          }
        );

        const reportData = await reportRes.json().catch(() => ({}));

        if (!reportRes.ok) {
          throw new Error(reportData?.error || "Failed to load saved report.");
        }

        const report = reportData.report as SavedReportForEdit;

        if (!report?.canEdit) {
          throw new Error("You do not have permission to edit this report.");
        }

        hydrateSavedReport(report, loaded);
        return;
      }

      const defaultTemplate = getDefaultReportTemplate();
      if (defaultTemplate) {
        applyTemplate(defaultTemplate, loaded);
      } else if (loaded[0]) {
        applyDatasetDefaults(loaded[0]);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load report datasets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDatasets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedReportId]);

  function activeAggregations() {
    if (aggregations.length) return aggregations;

    if (aggregateColumn) {
      return [
        {
          column: aggregateColumn,
          function: aggregateFunction,
        },
      ];
    }

    return [];
  }

  function effectiveGrouping() {
    if (mode === "advanced" && advancedOutputMode === "detail") {
      return [];
    }

    return grouping;
  }

  function effectiveAggregations() {
    if (mode === "advanced" && advancedOutputMode === "detail") {
      return [];
    }

    return activeAggregations();
  }

  function effectiveCalculatedColumns() {
    if (mode === "advanced" && advancedOutputMode === "detail") {
      return [];
    }

    return calculatedColumns.filter((column) => String(column.label || "").trim());
  }

  async function run(
    nextPageIndex = pageIndex,
    nextPageSize = pageSize,
    nextSort: { column: string; direction: "asc" | "desc" } | null = sortBy
      ? { column: sortBy, direction: sortDir }
      : null
  ) {
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
          filters: requestFilters,
          filterLogic,
          sort: nextSort,
          grouping: effectiveGrouping(),
          aggregations: effectiveAggregations(),
          calculatedColumns: effectiveCalculatedColumns(),
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

      const payload = {
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
        filters: requestFilters,
        filterLogic,
        sort: sortBy ? { column: sortBy, direction: sortDir } : null,
        grouping: effectiveGrouping(),
        aggregations: effectiveAggregations(),
        calculatedColumns: effectiveCalculatedColumns(),
        visualization,
        chartConfig: {
          templateKey: template?.key ?? null,
          mode,
          advancedOutputMode,
          filterLogic,
          calculatedColumns: effectiveCalculatedColumns(),
        },
      };

      const res = await fetch(
        isEditMode
          ? `/api/reports/saved/${encodeURIComponent(savedReportId!)}`
          : "/api/reports/saved",
        {
          method: isEditMode ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save report.");
      }

      setSuccessMsg(isEditMode ? "Report updated." : "Report saved.");

      if (!isEditMode && data?.id) {
        router.push(`/reports/${data.id}/edit`);
      }
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
        filters: requestFilters,
        filterLogic,
        sort: sortBy ? { column: sortBy, direction: sortDir } : null,
        grouping: effectiveGrouping(),
        aggregations: effectiveAggregations(),
        calculatedColumns: effectiveCalculatedColumns(),
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


  async function exportPdf() {
    if (!dataset) return;

    try {
      setExportingPdf(true);
      setError(null);
      setSuccessMsg(null);

      const res = await fetch("/api/reports/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reportName: reportName.trim() || dataset.label || "CAP Report",
          reportDescription: description.trim() || dataset.description || null,
          tablePreviewLimit: 100,
          request: {
            savedReportId: savedReportId ?? null,
            datasetKey: dataset.key,
            selectedColumns,
            filters: requestFilters,
            filterLogic,
            sort: sortBy ? { column: sortBy, direction: sortDir } : null,
            grouping: effectiveGrouping(),
            aggregations: effectiveAggregations(),
            calculatedColumns: effectiveCalculatedColumns(),
            visualization,
            page: 1,
            pageSize: 100,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "PDF export failed.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportName.trim() || "cap-report"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || "PDF export failed.");
    } finally {
      setExportingPdf(false);
    }
  }

  const tableColumns: Column<Record<string, any>>[] = useMemo(() => {
    return (result?.columns ?? []).map((column) => ({
      key: column.key,
      header: column.key === "record_url" ? "Open Record" : humanizeReportLabel(column.label),
      sortable: true,
      width: getReportColumnWidth(column),
      render: (row) => {
        const value = row[column.key];

        if (column.key === "record_url") {
          const href = String(value || "").trim();

          if (!href) return "";

          return (
            <Link href={href} className="btn btn-secondary btn-sm">
              Open Record
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
            {formatCalculatedCell(value, column)}
          </span>
        );
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

  function moveSelectedColumn(index: number, direction: -1 | 1) {
    setSelectedColumns((prev) => moveArrayItem(prev, index, direction));
  }

  function moveGrouping(index: number, direction: -1 | 1) {
    setGrouping((prev) => moveArrayItem(prev, index, direction));
  }

  function onToggleSort(key: string) {
    const outputKeys = new Set((result?.columns ?? []).map((column) => column.key));
    if (result && !outputKeys.has(key)) return;

    const nextSortBy = key;
    const nextSortDir: SortDir =
      sortBy !== key ? "asc" : sortDir === "asc" ? "desc" : "asc";

    setSortBy(nextSortBy);
    setSortDir(nextSortDir);
    setPageIndex(0);

    run(0, pageSize, { column: nextSortBy, direction: nextSortDir });
  }

  const selectedColumnDetails = selectedColumns
    .map((key) => dataset?.columns.find((c) => c.key === key))
    .filter(Boolean) as DatasetColumn[];

  const groupingDetails = grouping
    .map((key) => dataset?.columns.find((c) => c.key === key))
    .filter(Boolean) as DatasetColumn[];

  const summaryCards =
    mode === "advanced" && advancedOutputMode === "detail"
      ? undefined
      : template?.summaryCards;

  if (loading) {
    return <div className="card text-muted">Loading report builder…</div>;
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

        .report-order-list {
          display: grid;
          gap: 6px;
        }

        .report-order-row {
          display: grid;
          grid-template-columns: auto auto 1fr;
          align-items: center;
          gap: 6px;
          padding: 6px 8px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface-subtle);
        }

        .report-order-row-label {
          font-size: 13px;
          font-weight: 700;
          color: var(--text);
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isEditMode ? "Edit Saved Report" : "Create New Report"}
          </h1>
          <p className="page-subtitle">
            {isEditMode
              ? "Update the saved report definition, default filters, columns, grouping, formulas, and visualization."
              : "Start from a guided template or switch to Advanced Mode for full report setup."}
          </p>
        </div>

        <div className="record-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setPageIndex(0);
              run(0, pageSize);
            }}
          >
            {running ? "Running…" : "Run Report"}
          </button>

          <button type="button" className="btn btn-secondary" onClick={exportCsv}>
            Export CSV
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={exportPdf}
            disabled={exportingPdf || !dataset}
          >
            {exportingPdf ? "Exporting PDF…" : "Export PDF"}
          </button>

          <button type="button" className="btn btn-primary" onClick={saveReport} disabled={saving}>
            {saving ? "Saving…" : isEditMode ? "Save Changes" : "Save Report"}
          </button>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {successMsg ? <div className="alert alert-success">{successMsg}</div> : null}

      <div className="card section-stack">
        <div className="section-card-header" style={{ marginBottom: 0 }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Report Mode</h2>
            <p className="page-subtitle">
              Simple Mode is template-based. Advanced Mode exposes dataset, columns, grouping,
              and aggregation.
            </p>
          </div>

          <div className="record-actions">
            <button
              type="button"
              className={mode === "simple" ? "btn btn-primary" : "btn btn-secondary"}
              onClick={() => {
                setMode("simple");
                setAdvancedOutputMode("summary");
              }}
            >
              Simple Mode
            </button>

            <button
              type="button"
              className={mode === "advanced" ? "btn btn-primary" : "btn btn-secondary"}
              onClick={() => {
                setMode("advanced");
                setAdvancedOutputMode("detail");
              }}
            >
              Advanced Mode
            </button>
          </div>
        </div>
      </div>

      <div className="card section-stack">
        <h2>Report Setup</h2>

        {mode === "simple" ? (
          <div className="form-grid">
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="field-label">Report Template</label>
              <select
                className="select"
                value={templateKey}
                onChange={(e) => {
                  const next = getReportTemplate(e.target.value);
                  if (next) applyTemplate(next);
                }}
              >
                {REPORT_TEMPLATES.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
              {template ? <div className="field-help">{template.description}</div> : null}
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
        ) : (
          <div className="form-grid">
            <div>
              <label className="field-label">Dataset</label>
              <select
                className="select"
                value={datasetKey}
                onChange={(e) => {
                  const next = datasets.find((d) => d.key === e.target.value);
                  if (next) applyDatasetDefaults(next);
                }}
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
              <select
                className="select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
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

            <div style={{ gridColumn: "1 / -1" }}>
              <label className="field-label">Output Type</label>

              <div className="record-actions" style={{ justifyContent: "flex-start" }}>
                <button
                  type="button"
                  className={
                    advancedOutputMode === "detail" ? "btn btn-primary" : "btn btn-secondary"
                  }
                  onClick={() => setAdvancedOutputMode("detail")}
                >
                  Detail Rows
                </button>

                <button
                  type="button"
                  className={
                    advancedOutputMode === "summary" ? "btn btn-primary" : "btn btn-secondary"
                  }
                  onClick={() => setAdvancedOutputMode("summary")}
                >
                  Grouped Summary
                </button>
              </div>

              <div className="field-help">
                Detail Rows shows selected columns exactly as checked. Grouped Summary uses Group
                By and Aggregation fields.
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card section-stack">
        <h2>Filters</h2>

        <ReportFilterBuilder
          datasetKey={datasetKey}
          columns={dataset?.columns ?? []}
          simpleFilterKeys={mode === "simple" ? template?.simpleFilters : undefined}
          filterLogic={filterLogic}
          onFilterLogicChange={setFilterLogic}
          dateColumn={dateColumn}
          onDateColumnChange={setDateColumn}
          datePreset={datePreset}
          onDatePresetChange={setDatePreset}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
          fieldFilters={fieldFilters}
          onFieldFiltersChange={setFieldFilters}
        />
      </div>

      {mode === "advanced" ? (
        <>
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

            <div className="section-stack">
              <h3>Selected Column Order</h3>
              <div className="field-help">
                This controls the left-to-right order in Detail Rows output.
              </div>

              {selectedColumnDetails.length ? (
                <div className="report-order-list">
                  {selectedColumnDetails.map((column, index) => (
                    <div key={column.key} className="report-order-row">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={index === 0}
                        onClick={() => moveSelectedColumn(index, -1)}
                      >
                        ↑
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={index === selectedColumnDetails.length - 1}
                        onClick={() => moveSelectedColumn(index, 1)}
                      >
                        ↓
                      </button>

                      <div className="report-order-row-label">{column.label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-soft">No selected columns.</div>
              )}
            </div>
          </div>

          <div className="card section-stack">
            <h2>Grouping, Aggregation & Calculated Columns</h2>

            {advancedOutputMode === "detail" ? (
              <div className="alert alert-info">
                Detail Rows mode ignores Group By, Aggregation, and Calculated Summary Columns.
                Switch to Grouped Summary to use these options.
              </div>
            ) : null}

            <div className="form-grid">
              <div>
                <label className="field-label">Aggregate Column</label>
                <select
                  className="select"
                  value={aggregateColumn}
                  disabled={advancedOutputMode === "detail"}
                  onChange={(e) => {
                    setAggregateColumn(e.target.value);
                    setAggregations(
                      e.target.value
                        ? [{ column: e.target.value, function: aggregateFunction }]
                        : []
                    );
                  }}
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
                  disabled={advancedOutputMode === "detail"}
                  onChange={(e) => {
                    setAggregateFunction(e.target.value);
                    setAggregations(
                      aggregateColumn
                        ? [{ column: aggregateColumn, function: e.target.value }]
                        : []
                    );
                  }}
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
                        disabled={advancedOutputMode === "detail"}
                        onChange={() => toggleGrouping(column.key)}
                      />
                      {column.label}
                    </label>
                  ))}
              </div>
            </div>

            <div className="section-stack">
              <h3>Group By Order</h3>
              <div className="field-help">
                This controls the left-to-right order of grouped summary columns.
              </div>

              {groupingDetails.length ? (
                <div className="report-order-list">
                  {groupingDetails.map((column, index) => (
                    <div key={column.key} className="report-order-row">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={index === 0 || advancedOutputMode === "detail"}
                        onClick={() => moveGrouping(index, -1)}
                      >
                        ↑
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={
                          index === groupingDetails.length - 1 ||
                          advancedOutputMode === "detail"
                        }
                        onClick={() => moveGrouping(index, 1)}
                      >
                        ↓
                      </button>

                      <div className="report-order-row-label">{column.label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-soft">No group-by columns selected.</div>
              )}
            </div>

            <ReportCalculatedColumnsBuilder
              columns={dataset?.columns ?? []}
              calculatedColumns={calculatedColumns}
              onCalculatedColumnsChange={setCalculatedColumns}
              disabled={advancedOutputMode === "detail"}
            />
          </div>
        </>
      ) : null}

      <div className="card section-stack">
        <h2>Save Settings</h2>

        <div className="form-grid">
          <div>
            <label className="field-label">Report Name</label>
            <input
              className="input"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
            />
          </div>

          <div>
            <label className="field-label">Visibility</label>
            <select
              className="select"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
            >
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
        <ReportSummaryCards rows={result.rows} columns={result.columns} cards={summaryCards} />
      ) : null}

      {result ? (
        <ReportVisualization
          visualization={visualization}
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
        </div>
      ) : null}
    </div>
  );
}