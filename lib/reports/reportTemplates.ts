// lib/reports/reportTemplates.ts

import type {
  ReportAggregateFunction,
  ReportAggregation,
  ReportSortConfig,
  ReportVisualization,
} from "./reportTypes";
import type { ReportDatePresetKey } from "./reportDatePresets";

export type ReportSummaryCardConfig = {
  key: string;
  label: string;
  sourceColumn?: string;
  function: "sum" | "avg" | "countRows" | "countDistinct" | "min" | "max";
  format?: "number" | "percent" | "hours";
};

export type ReportTemplate = {
  key: string;
  label: string;
  description: string;
  category:
    | "production"
    | "quality"
    | "recuts"
    | "workflow"
    | "maintenance"
    | "sales_order"
    | "machine";

  datasetKey: string;

  defaultColumns: string[];
  defaultDateColumn: string;
  defaultDatePreset: ReportDatePresetKey;

  defaultSort: ReportSortConfig;
  defaultGrouping: string[];
  defaultAggregations: ReportAggregation[];
  defaultVisualization: ReportVisualization;

  simpleFilters: string[];
  summaryCards: ReportSummaryCardConfig[];
};

function agg(
  column: string,
  fn: ReportAggregateFunction,
  label?: string
): ReportAggregation {
  return {
    column,
    function: fn,
    label,
  };
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    key: "dailyProductionSummary",
    label: "Daily Production Summary",
    description:
      "Production totals by shift date and department. Good for daily supervisor review.",
    category: "production",
    datasetKey: "productionActivity",
    defaultColumns: [
      "shift_date",
      "department",
      "shift",
      "metric_pieces",
      "metric_dozens",
      "metric_total_stitches",
    ],
    defaultDateColumn: "shift_date",
    defaultDatePreset: "last7Days",
    defaultSort: {
      column: "shift_date",
      direction: "desc",
    },
    defaultGrouping: ["shift_date", "department"],
    defaultAggregations: [
      agg("metric_pieces", "sum", "Total Pieces"),
      agg("metric_dozens", "sum", "Total Dozens"),
      agg("metric_total_stitches", "sum", "Total Stitches"),
    ],
    defaultVisualization: "bar",
    simpleFilters: ["department", "shift", "operator_name", "sales_order_display"],
    summaryCards: [
      {
        key: "totalPieces",
        label: "Total Pieces",
        sourceColumn: "sum_metric_pieces",
        function: "sum",
        format: "number",
      },
      {
        key: "totalDozens",
        label: "Total Dozens",
        sourceColumn: "sum_metric_dozens",
        function: "sum",
        format: "number",
      },
      {
        key: "totalStitches",
        label: "Total Stitches",
        sourceColumn: "sum_metric_total_stitches",
        function: "sum",
        format: "number",
      },
      {
        key: "rows",
        label: "Rows",
        function: "countRows",
        format: "number",
      },
    ],
  },

  {
    key: "operatorProduction",
    label: "Operator Production",
    description:
      "Production totals by operator. Good for supervisor review and coaching conversations.",
    category: "production",
    datasetKey: "productionActivity",
    defaultColumns: [
      "department",
      "shift",
      "operator_name",
      "metric_pieces",
      "metric_dozens",
      "metric_total_stitches",
    ],
    defaultDateColumn: "shift_date",
    defaultDatePreset: "last7Days",
    defaultSort: {
      column: "operator_name",
      direction: "asc",
    },
    defaultGrouping: ["department", "shift", "operator_name"],
    defaultAggregations: [
      agg("metric_pieces", "sum", "Total Pieces"),
      agg("metric_dozens", "sum", "Total Dozens"),
      agg("metric_total_stitches", "sum", "Total Stitches"),
    ],
    defaultVisualization: "bar",
    simpleFilters: ["department", "shift", "operator_name", "sales_order_display"],
    summaryCards: [
      {
        key: "totalPieces",
        label: "Total Pieces",
        sourceColumn: "sum_metric_pieces",
        function: "sum",
        format: "number",
      },
      {
        key: "totalDozens",
        label: "Total Dozens",
        sourceColumn: "sum_metric_dozens",
        function: "sum",
        format: "number",
      },
      {
        key: "operators",
        label: "Operators",
        sourceColumn: "operator_name",
        function: "countDistinct",
        format: "number",
      },
    ],
  },

  {
    key: "departmentProduction",
    label: "Department Production",
    description:
      "Production totals by department and shift. Good for cross-department production review.",
    category: "production",
    datasetKey: "productionActivity",
    defaultColumns: ["department", "shift", "metric_pieces", "metric_dozens"],
    defaultDateColumn: "shift_date",
    defaultDatePreset: "last7Days",
    defaultSort: {
      column: "department",
      direction: "asc",
    },
    defaultGrouping: ["department", "shift"],
    defaultAggregations: [
      agg("metric_pieces", "sum", "Total Pieces"),
      agg("metric_dozens", "sum", "Total Dozens"),
      agg("metric_total_stitches", "sum", "Total Stitches"),
    ],
    defaultVisualization: "bar",
    simpleFilters: ["department", "shift"],
    summaryCards: [
      {
        key: "totalPieces",
        label: "Total Pieces",
        sourceColumn: "sum_metric_pieces",
        function: "sum",
        format: "number",
      },
      {
        key: "totalDozens",
        label: "Total Dozens",
        sourceColumn: "sum_metric_dozens",
        function: "sum",
        format: "number",
      },
      {
        key: "departments",
        label: "Departments",
        sourceColumn: "department",
        function: "countDistinct",
        format: "number",
      },
    ],
  },

  {
    key: "qcRejectSummary",
    label: "QC Reject Summary",
    description:
      "Inspection and reject totals by QC area, department, and reject reason.",
    category: "quality",
    datasetKey: "qcRejectAnalysis",
    defaultColumns: [
      "shift_date",
      "source_module",
      "department",
      "operator_name",
      "inspected_quantity",
      "rejected_quantity",
      "reject_rate",
      "reject_reason",
    ],
    defaultDateColumn: "shift_date",
    defaultDatePreset: "last30Days",
    defaultSort: {
      column: "shift_date",
      direction: "desc",
    },
    defaultGrouping: ["source_module", "department", "reject_reason"],
    defaultAggregations: [
      agg("inspected_quantity", "sum", "Total Inspected"),
      agg("rejected_quantity", "sum", "Total Rejected"),
      agg("good_quantity", "sum", "Good Quantity"),
      agg("reject_rate", "avg", "Average Reject Rate"),
    ],
    defaultVisualization: "bar",
    simpleFilters: [
      "source_module",
      "department",
      "shift",
      "operator_name",
      "sales_order_display",
      "reject_reason",
    ],
    summaryCards: [
      {
        key: "inspected",
        label: "Inspected",
        sourceColumn: "sum_inspected_quantity",
        function: "sum",
        format: "number",
      },
      {
        key: "rejected",
        label: "Rejected",
        sourceColumn: "sum_rejected_quantity",
        function: "sum",
        format: "number",
      },
      {
        key: "good",
        label: "Good Qty",
        sourceColumn: "sum_good_quantity",
        function: "sum",
        format: "number",
      },
      {
        key: "rejectRate",
        label: "Avg Reject Rate",
        sourceColumn: "avg_reject_rate",
        function: "avg",
        format: "percent",
      },
    ],
  },

  {
    key: "recutAging",
    label: "Recut Aging",
    description:
      "Recut request aging by department and status. Good for open workload review.",
    category: "recuts",
    datasetKey: "recutActivity",
    defaultColumns: [
      "requested_date",
      "recut_id",
      "requested_department",
      "sales_order_display",
      "recut_reason",
      "pieces",
      "recut_status",
      "hours_open",
      "record_url",
    ],
    defaultDateColumn: "requested_date",
    defaultDatePreset: "last30Days",
    defaultSort: {
      column: "requested_date",
      direction: "desc",
    },
    defaultGrouping: ["requested_department", "recut_status"],
    defaultAggregations: [
      agg("recut_id", "count", "Recut Count"),
      agg("pieces", "sum", "Total Pieces"),
      agg("hours_open", "avg", "Average Hours Open"),
    ],
    defaultVisualization: "bar",
    simpleFilters: [
      "requested_department",
      "recut_status",
      "operator",
      "sales_order_display",
      "recut_reason",
    ],
    summaryCards: [
      {
        key: "recuts",
        label: "Recuts",
        sourceColumn: "count_recut_id",
        function: "sum",
        format: "number",
      },
      {
        key: "pieces",
        label: "Pieces",
        sourceColumn: "sum_pieces",
        function: "sum",
        format: "number",
      },
      {
        key: "avgOpen",
        label: "Avg Hours Open",
        sourceColumn: "avg_hours_open",
        function: "avg",
        format: "hours",
      },
    ],
  },

  {
    key: "salesOrderActivity",
    label: "Sales Order Activity",
    description:
      "Cross-module activity for sales orders across production, QC, workflow, and recuts.",
    category: "sales_order",
    datasetKey: "salesOrderActivity",
    defaultColumns: [
      "sales_order_display",
      "detail_number",
      "activity_date",
      "source_module",
      "activity_type",
      "department",
      "operator_name",
      "quantity",
      "status",
      "record_url",
    ],
    defaultDateColumn: "activity_date",
    defaultDatePreset: "last30Days",
    defaultSort: {
      column: "activity_ts",
      direction: "desc",
    },
    defaultGrouping: [],
    defaultAggregations: [],
    defaultVisualization: "datatable",
    simpleFilters: [
      "sales_order_display",
      "source_module",
      "activity_type",
      "department",
      "operator_name",
      "status",
    ],
    summaryCards: [
      {
        key: "activityRows",
        label: "Activity Rows",
        function: "countRows",
        format: "number",
      },
      {
        key: "salesOrders",
        label: "Sales Orders",
        sourceColumn: "sales_order_display",
        function: "countDistinct",
        format: "number",
      },
      {
        key: "quantity",
        label: "Quantity",
        sourceColumn: "quantity",
        function: "sum",
        format: "number",
      },
    ],
  },

  {
    key: "workflowAging",
    label: "Workflow Aging",
    description:
      "Workflow request aging by status, due date, customer, designer, and digitizer.",
    category: "workflow",
    datasetKey: "workflowActivity",
    defaultColumns: [
      "activity_date",
      "request_number",
      "sales_order_display",
      "customer_name",
      "status_label",
      "due_date",
      "created_by_name",
      "digitizer_name",
      "designer_name",
      "rush",
      "days_open",
      "record_url",
    ],
    defaultDateColumn: "activity_date",
    defaultDatePreset: "last30Days",
    defaultSort: {
      column: "activity_ts",
      direction: "desc",
    },
    defaultGrouping: ["status_label"],
    defaultAggregations: [
      agg("request_number", "count", "Request Count"),
      agg("days_open", "avg", "Average Days Open"),
    ],
    defaultVisualization: "bar",
    simpleFilters: [
      "status_label",
      "customer_name",
      "sales_order_display",
      "created_by_name",
      "digitizer_name",
      "designer_name",
    ],
    summaryCards: [
      {
        key: "requests",
        label: "Requests",
        sourceColumn: "count_request_number",
        function: "sum",
        format: "number",
      },
      {
        key: "avgOpen",
        label: "Avg Days Open",
        sourceColumn: "avg_days_open",
        function: "avg",
        format: "number",
      },
      {
        key: "statuses",
        label: "Statuses",
        sourceColumn: "status_label",
        function: "countDistinct",
        format: "number",
      },
    ],
  },

  {
    key: "maintenanceActivity",
    label: "Maintenance Activity",
    description:
      "Maintenance work orders by department, asset, priority, tech, status, and aging.",
    category: "maintenance",
    datasetKey: "maintenanceActivity",
    defaultColumns: [
      "requested_date",
      "work_order_id",
      "department",
      "asset",
      "priority",
      "tech",
      "common_issue",
      "status",
      "hours_open",
      "record_url",
    ],
    defaultDateColumn: "requested_date",
    defaultDatePreset: "last30Days",
    defaultSort: {
      column: "requested_at",
      direction: "desc",
    },
    defaultGrouping: ["status", "priority", "department"],
    defaultAggregations: [
      agg("work_order_id", "count", "Work Order Count"),
      agg("hours_open", "avg", "Average Hours Open"),
    ],
    defaultVisualization: "bar",
    simpleFilters: ["department", "asset", "priority", "tech", "status", "common_issue"],
    summaryCards: [
      {
        key: "workOrders",
        label: "Work Orders",
        sourceColumn: "count_work_order_id",
        function: "sum",
        format: "number",
      },
      {
        key: "avgOpen",
        label: "Avg Hours Open",
        sourceColumn: "avg_hours_open",
        function: "avg",
        format: "hours",
      },
      {
        key: "statuses",
        label: "Statuses",
        sourceColumn: "status",
        function: "countDistinct",
        format: "number",
      },
    ],
  },

  {
    key: "machineAreaActivity",
    label: "Machine / Area Activity",
    description:
      "Machine and work-area activity using embroidery machine output and production work sessions.",
    category: "machine",
    datasetKey: "machineUtilization",
    defaultColumns: [
      "shift_date",
      "source_module",
      "activity_type",
      "department",
      "machine_or_area",
      "operator_name",
      "total_pieces",
      "total_stitches",
      "session_minutes",
    ],
    defaultDateColumn: "shift_date",
    defaultDatePreset: "last7Days",
    defaultSort: {
      column: "shift_date",
      direction: "desc",
    },
    defaultGrouping: ["source_module", "department", "machine_or_area"],
    defaultAggregations: [
      agg("total_pieces", "sum", "Total Pieces"),
      agg("total_stitches", "sum", "Total Stitches"),
      agg("session_minutes", "sum", "Session Minutes"),
    ],
    defaultVisualization: "bar",
    simpleFilters: ["source_module", "department", "shift", "machine_or_area", "operator_name"],
    summaryCards: [
      {
        key: "pieces",
        label: "Pieces",
        sourceColumn: "sum_total_pieces",
        function: "sum",
        format: "number",
      },
      {
        key: "stitches",
        label: "Stitches",
        sourceColumn: "sum_total_stitches",
        function: "sum",
        format: "number",
      },
      {
        key: "minutes",
        label: "Session Minutes",
        sourceColumn: "sum_session_minutes",
        function: "sum",
        format: "number",
      },
    ],
  },
];

export function getReportTemplate(templateKey: string | null | undefined) {
  if (!templateKey) return null;
  return REPORT_TEMPLATES.find((template) => template.key === templateKey) ?? null;
}

export function getDefaultReportTemplate() {
  return REPORT_TEMPLATES[0] ?? null;
}

export function listReportTemplatesForDataset(datasetKey: string) {
  return REPORT_TEMPLATES.filter((template) => template.datasetKey === datasetKey);
}