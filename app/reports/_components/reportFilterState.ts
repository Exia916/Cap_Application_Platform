// app/reports/_components/reportFilterState.ts

import type { ReportDatePresetKey } from "@/lib/reports/reportDatePresets";
import type { ReportFilterValue } from "@/lib/reports/reportTypes";

export type ReportClientColumn = {
  key: string;
  label: string;
  type: string;
  filterable: boolean;
  filterOnly?: boolean;
};

export type RuntimeFilterState = {
  dateColumn: string;
  datePreset: ReportDatePresetKey;
  dateFrom: string;
  dateTo: string;
  fieldFilters: Record<string, ReportFilterValue>;
};

function isDateLikeColumn(column: ReportClientColumn | undefined | null) {
  return !!column && column.filterable && (column.type === "date" || column.type === "datetime");
}

function cloneFilterValue(filter: ReportFilterValue): ReportFilterValue {
  return JSON.parse(JSON.stringify(filter ?? {})) as ReportFilterValue;
}

function hasDateRangeValue(filter: ReportFilterValue | undefined | null) {
  if (!filter || filter.operator !== "dateRange") return false;

  return (
    (filter.from !== null && filter.from !== undefined && String(filter.from).trim() !== "") ||
    (filter.to !== null && filter.to !== undefined && String(filter.to).trim() !== "")
  );
}

function getDateColumnKeys(columns: ReportClientColumn[]) {
  return new Set(columns.filter(isDateLikeColumn).map((column) => column.key));
}

function findFallbackDateColumn(columns: ReportClientColumn[]) {
  return columns.find(isDateLikeColumn)?.key ?? "";
}

function normalizePreferredDateColumn(
  preferredDateColumn: string,
  columns: ReportClientColumn[]
) {
  const preferred = String(preferredDateColumn || "").trim();
  if (!preferred) return "";

  const column = columns.find((item) => item.key === preferred);
  return isDateLikeColumn(column) ? preferred : "";
}

function pickRuntimeDateFilterColumn(input: {
  source: Record<string, ReportFilterValue>;
  columns: ReportClientColumn[];
  preferredDateColumn?: string;
}) {
  const dateColumnKeys = getDateColumnKeys(input.columns);
  const preferred = normalizePreferredDateColumn(
    input.preferredDateColumn || "",
    input.columns
  );

  if (
    preferred &&
    dateColumnKeys.has(preferred) &&
    hasDateRangeValue(input.source[preferred])
  ) {
    return preferred;
  }

  for (const [key, filter] of Object.entries(input.source)) {
    if (dateColumnKeys.has(key) && hasDateRangeValue(filter)) {
      return key;
    }
  }

  return preferred || findFallbackDateColumn(input.columns);
}

export function splitReportFilters(
  filters: Record<string, ReportFilterValue> | null | undefined,
  columns: ReportClientColumn[],
  preferredDateColumn = ""
): RuntimeFilterState {
  const source = filters ?? {};
  const dateColumnKeys = getDateColumnKeys(columns);
  const selectedDateColumn = pickRuntimeDateFilterColumn({
    source,
    columns,
    preferredDateColumn,
  });

  const fieldFilters: Record<string, ReportFilterValue> = {};
  let dateFrom = "";
  let dateTo = "";

  for (const [key, filter] of Object.entries(source)) {
    if (!filter?.operator) continue;

    const isSelectedRuntimeDateFilter =
      key === selectedDateColumn &&
      dateColumnKeys.has(key) &&
      filter.operator === "dateRange";

    if (isSelectedRuntimeDateFilter) {
      dateFrom = filter.from == null ? "" : String(filter.from);
      dateTo = filter.to == null ? "" : String(filter.to);
      continue;
    }

    fieldFilters[key] = cloneFilterValue(filter);
  }

  return {
    dateColumn: selectedDateColumn,
    datePreset: "custom",
    dateFrom,
    dateTo,
    fieldFilters,
  };
}

function shouldKeepFilter(filter: ReportFilterValue | undefined | null) {
  if (!filter?.operator) return false;

  if (filter.operator === "dateRange" || filter.operator === "numberRange") {
    const hasFrom =
      filter.from !== null &&
      filter.from !== undefined &&
      String(filter.from).trim() !== "";

    const hasTo =
      filter.to !== null &&
      filter.to !== undefined &&
      String(filter.to).trim() !== "";

    return hasFrom || hasTo;
  }

  if (filter.operator === "in" || filter.operator === "notIn") {
    return Array.isArray(filter.values) && filter.values.length > 0;
  }

  return (
    filter.value !== null &&
    filter.value !== undefined &&
    String(filter.value).trim() !== ""
  );
}

export function buildReportFilters(input: {
  dateColumn: string;
  dateFrom: string;
  dateTo: string;
  fieldFilters: Record<string, ReportFilterValue>;
}) {
  const filters: Record<string, ReportFilterValue> = {};

  for (const [key, filter] of Object.entries(input.fieldFilters ?? {})) {
    if (shouldKeepFilter(filter)) {
      filters[key] = cloneFilterValue(filter);
    }
  }

  if (input.dateColumn && (input.dateFrom || input.dateTo)) {
    filters[input.dateColumn] = {
      operator: "dateRange",
      from: input.dateFrom || null,
      to: input.dateTo || null,
    };
  }

  return filters;
}

export function cloneReportFilters(filters: Record<string, ReportFilterValue>) {
  return JSON.parse(JSON.stringify(filters ?? {})) as Record<string, ReportFilterValue>;
}