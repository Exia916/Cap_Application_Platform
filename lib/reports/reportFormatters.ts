// lib/reports/reportFormatters.ts

import type { ReportColumnType, ReportFilterValue } from "./reportTypes";

const CHICAGO_TIME_ZONE = "America/Chicago";

export function formatReportDateOnly(value: unknown) {
  if (value === null || value === undefined || value === "") return "";

  const raw = String(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[2]}/${match[3]}/${match[1]}`;

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: CHICAGO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function formatReportDateTime(value: unknown) {
  if (value === null || value === undefined || value === "") return "";

  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-US", {
    timeZone: CHICAGO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatReportNumber(value: unknown, maximumFractionDigits = 2) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(n);
}

export function formatReportPercent(value: unknown) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "";

  const pct = Math.abs(n) <= 1 ? n * 100 : n;
  return `${formatReportNumber(pct, 2)}%`;
}

export function formatReportCell(value: unknown, type?: ReportColumnType | string) {
  if (value === null || value === undefined) return "";

  if (type === "date") return formatReportDateOnly(value);
  if (type === "datetime") return formatReportDateTime(value);
  if (type === "boolean") return value ? "Yes" : "No";

  if (typeof value === "number") return formatReportNumber(value);

  const asNumber = Number(value);
  if (type === "number" && Number.isFinite(asNumber)) return formatReportNumber(asNumber);

  return String(value);
}

export function formatReportAxisLabel(value: unknown, type?: ReportColumnType | string) {
  if (type === "date") return formatReportDateOnly(value);
  if (type === "datetime") return formatReportDateOnly(value);
  if (type === "number") return formatReportNumber(value);
  return value === null || value === undefined ? "" : String(value);
}

export function humanizeReportLabel(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const known: Record<string, string> = {
    sum_metric_pieces: "Total Pieces",
    sum_metric_dozens: "Total Dozens",
    sum_metric_total_stitches: "Total Stitches",
    sum_total_stitches: "Total Stitches",
    sum_total_pieces: "Total Pieces",
    avg_days_open: "Average Days Open",
    avg_hours_open: "Average Hours Open",
    count_request_number: "Request Count",
    count_inbound_shipment_number: "Shipment Count",
  };

  if (known[raw]) return known[raw];

  return raw
    .replace(/^(sum|avg|min|max|count)_/, (m) => {
      const clean = m.replace("_", "");
      if (clean === "sum") return "Total ";
      if (clean === "avg") return "Average ";
      if (clean === "min") return "Minimum ";
      if (clean === "max") return "Maximum ";
      if (clean === "count") return "Count ";
      return "";
    })
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bEta\b/g, "ETA")
    .replace(/\bEtd\b/g, "ETD")
    .replace(/\bPo\b/g, "PO")
    .replace(/\bMbl\b/g, "MBL")
    .replace(/\bHbl\b/g, "HBL")
    .replace(/\bUrl\b/g, "URL")
    .replace(/\bId\b/g, "ID");
}

export function formatReportFilterValue(filter: ReportFilterValue) {
  if (filter.operator === "contains") return `contains "${filter.value ?? ""}"`;
  if (filter.operator === "startsWith") return `starts with "${filter.value ?? ""}"`;
  if (filter.operator === "equals") return `= ${filter.value ?? ""}`;
  if (filter.operator === "notEquals") return `is not ${filter.value ?? ""}`;
  if (filter.operator === "isTrue") return "Yes";
  if (filter.operator === "isFalse") return "No";
  if (filter.operator === "in") return `in ${(filter.values ?? []).join(", ")}`;
  if (filter.operator === "notIn") return `not in ${(filter.values ?? []).join(", ")}`;
  if (filter.operator === "dateRange") return `${filter.from || "Any"} to ${filter.to || "Any"}`;
  if (filter.operator === "numberRange") return `${filter.from ?? "Any"} to ${filter.to ?? "Any"}`;

  return String(filter.value ?? "");
}

export function formatReportValueForCsv(value: unknown, type?: ReportColumnType | string) {
  if (type === "date") return formatReportDateOnly(value);
  if (type === "datetime") return formatReportDateTime(value);
  if (type === "boolean") return value ? "Yes" : "No";
  if (type === "number") return value === null || value === undefined ? "" : String(value);
  return value === null || value === undefined ? "" : String(value);
}