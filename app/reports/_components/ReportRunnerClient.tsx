// app/reports/_components/ReportRunnerClient.tsx

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";
import type { ReportDatePresetKey } from "@/lib/reports/reportDatePresets";
import type { ReportCalculatedColumn, ReportFilterLogic } from "@/lib/reports/reportTypes";
import { getReportTemplate, REPORT_TEMPLATES } from "@/lib/reports/reportTemplates";
import {
  formatReportCell,
  humanizeReportLabel,
} from "@/lib/reports/reportFormatters";
import ReportFilterBuilder from "./ReportFilterBuilder";
import ReportSummaryCards from "./ReportSummaryCards";
import ReportVisualization from "./ReportVisualization";
import {
  buildReportFilters,
  cloneReportFilters,
  splitReportFilters,
} from "./reportFilterState";

type DatasetColumn = {
  key: string;
  label: string;
  type: string;
  filterable: boolean;
  sortable: boolean;
  groupable: boolean;
  aggregatable: boolean;
  defaultVisible: boolean;
  filterOnly?: boolean;
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

type FilterValue = {
  operator: string;
  value?: string | number | boolean | null;
  values?: Array<string | number | boolean>;
  from?: string | number | null;
  to?: string | number | null;
};

type SavedReport = {
  id: string;
  reportName: string;
  description: string | null;
  datasetKey: string;
  visibility: string;
  sharedRoles: string[];
  sharedDepartments: string[];
  selectedColumns: string[];
  filters: Record<string, FilterValue>;
  filterLogic?: "AND" | "OR";
  sort: { column: string; direction: "asc" | "desc" } | null;
  grouping: string[];
  aggregations: any[];
  calculatedColumns?: ReportCalculatedColumn[];
  visualization: string;
  chartConfig?: Record<string, any> | null;
  canEdit?: boolean;
};

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

function inferTemplate(report: SavedReport | null) {
  if (!report) return null;

  const templateKey = report.chartConfig?.templateKey;
  const direct = getReportTemplate(typeof templateKey === "string" ? templateKey : null);
  if (direct) return direct;

  return REPORT_TEMPLATES.find((template) => template.datasetKey === report.datasetKey) ?? null;
}

function getColumn(dataset: Dataset | null, key: string) {
  return dataset?.columns.find((column) => column.key === key) ?? null;
}

function isOutputColumn(column: DatasetColumn | undefined | null) {
  return !!column && !column.filterOnly;
}

function isSortableOutputColumn(column: DatasetColumn | undefined | null) {
  return isOutputColumn(column) && !!column?.sortable;
}

function isGroupableOutputColumn(column: DatasetColumn | undefined | null) {
  return isOutputColumn(column) && !!column?.groupable;
}

function isAggregatableOutputColumn(column: DatasetColumn | undefined | null) {
  return isOutputColumn(column) && !!column?.aggregatable;
}

function filterOutputColumnKeys(dataset: Dataset | null, keys: string[] | undefined | null) {
  if (!dataset || !Array.isArray(keys)) return [];

  return keys.filter((key) => isOutputColumn(getColumn(dataset, key)));
}

function filterGroupableKeys(dataset: Dataset | null, keys: string[] | undefined | null) {
  if (!dataset || !Array.isArray(keys)) return [];

  return keys.filter((key) => isGroupableOutputColumn(getColumn(dataset, key)));
}

function filterAggregations(dataset: Dataset | null, aggregations: any[] | undefined | null) {
  if (!dataset || !Array.isArray(aggregations)) return [];

  return aggregations.filter((aggregation) => {
    if (!aggregation?.column) return false;

    const column = getColumn(dataset, aggregation.column);
    return aggregation.function === "count"
      ? isOutputColumn(column)
      : isAggregatableOutputColumn(column);
  });
}

function slugForAlias(value: string) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

  return slug || "value";
}

function calculatedColumnAlias(calculatedColumn: ReportCalculatedColumn, index: number) {
  const idPart = calculatedColumn.id
    ? slugForAlias(calculatedColumn.id)
    : slugForAlias(calculatedColumn.label);

  return `calc_${index + 1}_${idPart}`;
}

function getCalculatedSortColumns(calculatedColumns: ReportCalculatedColumn[]) {
  return calculatedColumns
    .map((column, index) => ({
      key: calculatedColumnAlias(column, index),
      label: String(column.label || "").trim(),
    }))
    .filter((column) => column.label);
}

function isResultOutputColumn(result: RunResult | null, key: string) {
  return !!key && !!result?.columns?.some((column) => column.key === key);
}

function isCalculatedSortColumn(calculatedColumns: ReportCalculatedColumn[], key: string) {
  return getCalculatedSortColumns(calculatedColumns).some((column) => column.key === key);
}

function normalizeSortDirection(direction: unknown): "asc" | "desc" {
  return String(direction || "").toLowerCase() === "asc" ? "asc" : "desc";
}

function safeSortForReportRequest(input: {
  dataset: Dataset | null;
  sort: { column: string; direction: "asc" | "desc" } | null | undefined;
  result?: RunResult | null;
  calculatedColumns?: ReportCalculatedColumn[];
}) {
  const { dataset, sort, result = null, calculatedColumns = [] } = input;

  if (!sort?.column) return null;

  const normalizedSort = {
    column: sort.column,
    direction: normalizeSortDirection(sort.direction),
  } as const;

  if (isSortableOutputColumn(getColumn(dataset, sort.column))) {
    return normalizedSort;
  }

  if (isResultOutputColumn(result, sort.column)) {
    return normalizedSort;
  }

  if (isCalculatedSortColumn(calculatedColumns, sort.column)) {
    return normalizedSort;
  }

  return null;
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

function inlineSvgComputedStyles(source: Element, target: Element) {
  const computed = window.getComputedStyle(source);

  const importantStyles = [
    "fill",
    "stroke",
    "stroke-width",
    "stroke-opacity",
    "fill-opacity",
    "opacity",
    "font-family",
    "font-size",
    "font-weight",
    "text-anchor",
    "dominant-baseline",
  ];

  for (const prop of importantStyles) {
    const value = computed.getPropertyValue(prop);
    if (value && !value.includes("var(")) {
      (target as HTMLElement).style.setProperty(prop, value);
    }
  }

  const sourceChildren = Array.from(source.children);
  const targetChildren = Array.from(target.children);

  sourceChildren.forEach((child, index) => {
    const targetChild = targetChildren[index];
    if (targetChild) {
      inlineSvgComputedStyles(child, targetChild);
    }
  });
}

function isMostlyBlackCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  const width = canvas.width;
  const height = canvas.height;

  if (!width || !height) return false;

  const sampleWidth = Math.min(width, 300);
  const sampleHeight = Math.min(height, 180);
  const imageData = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
  const data = imageData.data;

  let darkPixels = 0;
  let checkedPixels = 0;

  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 20) continue;

    checkedPixels += 1;

    if (r < 20 && g < 20 && b < 20) {
      darkPixels += 1;
    }
  }

  if (!checkedPixels) return false;

  return darkPixels / checkedPixels > 0.75;
}

async function captureChartAsPngDataUrl(root: HTMLDivElement | null) {
  if (!root) return null;

  const svg = root.querySelector("svg");
  if (!svg) return null;

  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width || 900));
  const height = Math.max(1, Math.ceil(rect.height || 360));

  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }

  inlineSvgComputedStyles(svg, clone);

  const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  background.setAttribute("x", "0");
  background.setAttribute("y", "0");
  background.setAttribute("width", String(width));
  background.setAttribute("height", String(height));
  background.setAttribute("fill", "#ffffff");

  clone.insertBefore(background, clone.firstChild);

  const svgText = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    img.decoding = "async";

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to capture chart image."));
      img.src = url;
    });

    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);

    // Avoid embedding the failure mode where the chart image is mostly black.
    if (isMostlyBlackCanvas(canvas)) {
      return null;
    }

    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function normalizeSavedCalculatedColumns(report: SavedReport | null) {
  if (!report) return [];

  if (Array.isArray(report.calculatedColumns)) {
    return report.calculatedColumns.filter((column) => String(column?.label || "").trim());
  }

  if (Array.isArray(report.chartConfig?.calculatedColumns)) {
    return (report.chartConfig.calculatedColumns as ReportCalculatedColumn[]).filter((column) =>
      String(column?.label || "").trim()
    );
  }

  return [];
}

function formatRunnerCell(value: unknown, column: RunResult["columns"][number]) {
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

type ReportRunnerClientProps = {
  savedReportId?: string;
  reportId?: string;
};

export default function ReportRunnerClient({ savedReportId, reportId }: ReportRunnerClientProps) {
  const activeReportId = savedReportId ?? reportId ?? "";

  const router = useRouter();
  const chartRef = useRef<HTMLDivElement | null>(null);

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [report, setReport] = useState<SavedReport | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [savingFilters, setSavingFilters] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [dateColumn, setDateColumn] = useState("");
  const [datePreset, setDatePreset] = useState<ReportDatePresetKey>("custom");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterLogic, setFilterLogic] = useState<ReportFilterLogic>("AND");
  const [fieldFilters, setFieldFilters] = useState<Record<string, FilterValue>>({});
  const [savedFilterSnapshot, setSavedFilterSnapshot] = useState<Record<string, FilterValue>>({});

  const dataset = useMemo(
    () => datasets.find((d) => d.key === report?.datasetKey) ?? null,
    [datasets, report?.datasetKey]
  );

  const template = useMemo(() => inferTemplate(report), [report]);
  const isDetailReport = report?.chartConfig?.advancedOutputMode === "detail";

  const currentFilters = useMemo(
    () =>
      buildReportFilters({
        dateColumn,
        dateFrom,
        dateTo,
        fieldFilters: fieldFilters as any,
      }),
    [dateColumn, dateFrom, dateTo, fieldFilters]
  );

  const calculatedColumns = useMemo(
    () => normalizeSavedCalculatedColumns(report),
    [report]
  );

  const requestSelectedColumns = useMemo(
    () => filterOutputColumnKeys(dataset, report?.selectedColumns ?? []),
    [dataset, report?.selectedColumns]
  );

  const requestGrouping = useMemo(
    () => filterGroupableKeys(dataset, report?.grouping ?? []),
    [dataset, report?.grouping]
  );

  const requestAggregations = useMemo(
    () => filterAggregations(dataset, report?.aggregations ?? []),
    [dataset, report?.aggregations]
  );

  function hydrateRuntimeFilters(nextReport: SavedReport, loadedDatasets: Dataset[]) {
    const targetDataset = loadedDatasets.find((d) => d.key === nextReport.datasetKey);
    const preferredDateColumn = inferTemplate(nextReport)?.defaultDateColumn ?? "";

    if (!targetDataset) return;

    const split = splitReportFilters(nextReport.filters as any, targetDataset.columns, preferredDateColumn);

    setDateColumn(split.dateColumn);
    setDatePreset(split.datePreset);
    setDateFrom(split.dateFrom);
    setDateTo(split.dateTo);
    setFieldFilters(split.fieldFilters as any);
    setSavedFilterSnapshot(cloneReportFilters(nextReport.filters as any) as any);
    setFilterLogic(nextReport.filterLogic || (nextReport.chartConfig?.filterLogic === "OR" ? "OR" : "AND"));
  }

  async function loadReport() {
    if (!activeReportId) {
      setError("Saved report id was not provided.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccessMsg(null);

      const [reportRes, datasetsRes] = await Promise.all([
        fetch(`/api/reports/saved/${encodeURIComponent(activeReportId)}`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch("/api/reports/datasets", {
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      const reportData = await reportRes.json().catch(() => ({}));
      const datasetsData = await datasetsRes.json().catch(() => ({}));

      if (!reportRes.ok) {
        throw new Error(reportData?.error || "Failed to load report.");
      }

      if (!datasetsRes.ok) {
        throw new Error(datasetsData?.error || "Failed to load report datasets.");
      }

      const loadedDatasets = Array.isArray(datasetsData?.datasets) ? datasetsData.datasets : [];
      const loadedReport = reportData.report as SavedReport;
      const loadedDataset =
        loadedDatasets.find((d: Dataset) => d.key === loadedReport?.datasetKey) ?? null;
      const loadedSort = safeSortForReportRequest({
        dataset: loadedDataset,
        sort: loadedReport?.sort,
        calculatedColumns: normalizeSavedCalculatedColumns(loadedReport),
      });

      setDatasets(loadedDatasets);
      setReport(loadedReport);
      setSortBy(loadedSort?.column || "");
      setSortDir(loadedSort?.direction || "desc");
      hydrateRuntimeFilters(loadedReport, loadedDatasets);
    } catch (err: any) {
      setError(err?.message || "Failed to load report.");
    } finally {
      setLoading(false);
    }
  }

  async function run(
    nextPageIndex = pageIndex,
    nextPageSize = pageSize,
    nextSort: { column: string; direction: "asc" | "desc" } | null = sortBy
      ? { column: sortBy, direction: sortDir }
      : report?.sort ?? null
  ) {
    if (!report) return;

    try {
      setRunning(true);
      setError(null);
      setSuccessMsg(null);

      const safeSort = safeSortForReportRequest({
        dataset,
        sort: nextSort,
        result,
        calculatedColumns,
      });

      const res = await fetch("/api/reports/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          savedReportId: report.id,
          datasetKey: report.datasetKey,
          selectedColumns: requestSelectedColumns,
          filters: currentFilters,
          filterLogic,
          sort: safeSort,
          grouping: requestGrouping,
          aggregations: requestAggregations,
          calculatedColumns,
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

  async function saveFilterChanges() {
    if (!report || !report.canEdit) return;

    try {
      setSavingFilters(true);
      setError(null);
      setSuccessMsg(null);

      const safeSort = safeSortForReportRequest({
        dataset,
        sort: report.sort,
        result,
        calculatedColumns,
      });

      const nextChartConfig = {
        ...(report.chartConfig ?? {}),
        filterLogic,
        calculatedColumns,
      };

      const res = await fetch(`/api/reports/saved/${encodeURIComponent(report.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reportName: report.reportName,
          description: report.description,
          datasetKey: report.datasetKey,
          visibility: report.visibility,
          sharedRoles: report.sharedRoles,
          sharedDepartments: report.sharedDepartments,
          selectedColumns: requestSelectedColumns,
          filters: currentFilters,
          filterLogic,
          sort: safeSort,
          grouping: requestGrouping,
          aggregations: requestAggregations,
          calculatedColumns,
          visualization: report.visualization,
          chartConfig: nextChartConfig,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save filter changes.");
      }

      setReport({
        ...report,
        selectedColumns: requestSelectedColumns,
        filters: currentFilters as any,
        filterLogic,
        sort: safeSort,
        grouping: requestGrouping,
        aggregations: requestAggregations,
        calculatedColumns,
        chartConfig: nextChartConfig,
      });
      setSavedFilterSnapshot(cloneReportFilters(currentFilters as any) as any);
      setSuccessMsg("Default report filters updated.");
    } catch (err: any) {
      setError(err?.message || "Failed to save filter changes.");
    } finally {
      setSavingFilters(false);
    }
  }

  function resetFilters() {
    if (!dataset || !report) return;

    const split = splitReportFilters(savedFilterSnapshot as any, dataset.columns, template?.defaultDateColumn ?? "");

    setDateColumn(split.dateColumn);
    setDatePreset(split.datePreset);
    setDateFrom(split.dateFrom);
    setDateTo(split.dateTo);
    setFieldFilters(split.fieldFilters as any);
    setFilterLogic(report.filterLogic || (report.chartConfig?.filterLogic === "OR" ? "OR" : "AND"));
    setPageIndex(0);
  }

  async function duplicateReport() {
    if (!report) return;

    try {
      setDuplicating(true);
      setError(null);
      setSuccessMsg(null);

      const res = await fetch(`/api/reports/saved/${encodeURIComponent(report.id)}/duplicate`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to duplicate report.");
      }

      router.push(`/reports/${data.id}/edit`);
    } catch (err: any) {
      setError(err?.message || "Failed to duplicate report.");
    } finally {
      setDuplicating(false);
    }
  }

  async function exportCsv() {
    if (!report) return;

    const safeSort = safeSortForReportRequest({
      dataset,
      sort: sortBy ? { column: sortBy, direction: sortDir } : report.sort,
      result,
      calculatedColumns,
    });

    const res = await fetch("/api/reports/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        savedReportId: report.id,
        datasetKey: report.datasetKey,
        selectedColumns: requestSelectedColumns,
        filters: currentFilters,
        filterLogic,
        sort: safeSort,
        grouping: requestGrouping,
        aggregations: requestAggregations,
        calculatedColumns,
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

  async function exportPdf() {
    if (!report) return;

    try {
      setExportingPdf(true);
      setError(null);
      setSuccessMsg(null);

      const chartImageDataUrl = await captureChartAsPngDataUrl(chartRef.current);
      const safeSort = safeSortForReportRequest({
        dataset,
        sort: sortBy ? { column: sortBy, direction: sortDir } : report.sort,
        result,
        calculatedColumns,
      });

      const res = await fetch("/api/reports/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reportName: report.reportName,
          reportDescription: report.description,
          chartImageDataUrl,
          tablePreviewLimit: 100,
          request: {
            savedReportId: report.id,
            datasetKey: report.datasetKey,
            selectedColumns: requestSelectedColumns,
            filters: currentFilters,
            filterLogic,
            sort: safeSort,
            grouping: requestGrouping,
            aggregations: requestAggregations,
            calculatedColumns,
            visualization: report.visualization,
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
      a.download = `${report.reportName || "cap-report"}.pdf`;
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

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReportId]);

  useEffect(() => {
    if (report) run(0, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);

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
            {formatRunnerCell(value, column)}
          </span>
        );
      },
      getSearchText: (row) => String(row[column.key] ?? ""),
    }));
  }, [result?.columns]);

  function onToggleSort(key: string) {
    const outputKeys = new Set((result?.columns ?? []).map((column) => column.key));
    if (!outputKeys.has(key)) return;

    const nextSortBy = key;
    const nextSortDir: SortDir = sortBy !== key ? "asc" : sortDir === "asc" ? "desc" : "asc";

    setSortBy(nextSortBy);
    setSortDir(nextSortDir);
    setPageIndex(0);
    run(0, pageSize, { column: nextSortBy, direction: nextSortDir });
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

  function onRuntimeFilterChange(next: Record<string, FilterValue>) {
    setFieldFilters(next);
    setPageIndex(0);
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
          {report?.description ? <p className="page-subtitle">{report.description}</p> : null}
        </div>

        <div className="record-actions">
          <button type="button" className="btn btn-secondary" onClick={() => run(0, pageSize)}>
            {running ? "Running…" : "Run"}
          </button>

          {report?.canEdit ? (
            <Link href={`/reports/${report.id}/edit`} className="btn btn-secondary">
              Edit
            </Link>
          ) : null}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={duplicateReport}
            disabled={duplicating}
          >
            {duplicating ? "Copying…" : "Duplicate"}
          </button>

          <button type="button" className="btn btn-primary" onClick={exportCsv}>
            Export CSV
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={exportPdf}
            disabled={exportingPdf || !result}
          >
            {exportingPdf ? "Exporting PDF…" : "Export PDF"}
          </button>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {successMsg ? <div className="alert alert-success">{successMsg}</div> : null}

      {dataset ? (
        <div className="card section-stack">
          <div className="section-card-header" style={{ marginBottom: 0 }}>
            <div>
              <h2 style={{ marginBottom: 4 }}>Runtime Filters</h2>
              <p className="page-subtitle">
                Adjust these filters for this run. Use Save Filter Changes to update the saved defaults.
              </p>
            </div>

            <div className="record-actions">
              <button type="button" className="btn btn-secondary" onClick={resetFilters}>
                Reset Filters
              </button>

              {report?.canEdit ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={saveFilterChanges}
                  disabled={savingFilters}
                >
                  {savingFilters ? "Saving…" : "Save Filter Changes"}
                </button>
              ) : null}
            </div>
          </div>

          <ReportFilterBuilder
            datasetKey={dataset.key}
            columns={dataset.columns}
            simpleFilterKeys={template?.simpleFilters}
            filterLogic={filterLogic}
            onFilterLogicChange={(next) => {
              setFilterLogic(next);
              setPageIndex(0);
            }}
            dateColumn={dateColumn}
            onDateColumnChange={(next) => {
              setDateColumn(next);
              setPageIndex(0);
            }}
            datePreset={datePreset}
            onDatePresetChange={setDatePreset}
            dateFrom={dateFrom}
            onDateFromChange={(next) => {
              setDateFrom(next);
              setPageIndex(0);
            }}
            dateTo={dateTo}
            onDateToChange={(next) => {
              setDateTo(next);
              setPageIndex(0);
            }}
            fieldFilters={fieldFilters as any}
            onFieldFiltersChange={onRuntimeFilterChange as any}
          />
        </div>
      ) : null}

      {result ? (
        <ReportSummaryCards
          rows={result.rows}
          columns={result.columns}
          cards={isDetailReport ? undefined : template?.summaryCards}
        />
      ) : null}

      {result ? (
        <div ref={chartRef}>
          <ReportVisualization
            visualization={report?.visualization || "datatable"}
            columns={result.columns}
            rows={result.rows}
          />
        </div>
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