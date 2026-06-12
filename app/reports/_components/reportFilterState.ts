// app/reports/_components/reportFilterState.ts

import type { ReportDatePresetKey } from "@/lib/reports/reportDatePresets";
import type { ReportFilterValue } from "@/lib/reports/reportTypes";

export type ReportClientColumn = {
  key: string;
  label: string;
  type: string;
  filterable: boolean;
};

export type RuntimeFilterState = {
  dateColumn: string;
  datePreset: ReportDatePresetKey;
  dateFrom: string;
  dateTo: string;
  fieldFilters: Record<string, ReportFilterValue>;
};

export function splitReportFilters(
  filters: Record<string, ReportFilterValue> | null | undefined,
  columns: ReportClientColumn[],
  preferredDateColumn = ""
): RuntimeFilterState {
  const source = filters ?? {};
  const fieldFilters: Record<string, ReportFilterValue> = {};

  let dateColumn = "";
  let dateFrom = "";
  let dateTo = "";

  const dateColumnKeys = new Set(
    columns
      .filter((c) => c.filterable && (c.type === "date" || c.type === "datetime"))
      .map((c) => c.key)
  );

  const preferred = preferredDateColumn && source[preferredDateColumn]?.operator === "dateRange"
    ? preferredDateColumn
    : "";

  for (const [key, filter] of Object.entries(source)) {
    if (!filter?.operator) continue;

    const isDateRange = filter.operator === "dateRange" && dateColumnKeys.has(key);

    if (!dateColumn && isDateRange && (!preferred || key === preferred)) {
      dateColumn = key;
      dateFrom = filter.from == null ? "" : String(filter.from);
      dateTo = filter.to == null ? "" : String(filter.to);
      continue;
    }

    fieldFilters[key] = filter;
  }

  if (!dateColumn) {
    dateColumn = preferredDateColumn || columns.find((c) => c.type === "date" || c.type === "datetime")?.key || "";
  }

  return {
    dateColumn,
    datePreset: "custom",
    dateFrom,
    dateTo,
    fieldFilters,
  };
}

export function buildReportFilters(input: {
  dateColumn: string;
  dateFrom: string;
  dateTo: string;
  fieldFilters: Record<string, ReportFilterValue>;
}) {
  const filters: Record<string, ReportFilterValue> = { ...input.fieldFilters };

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