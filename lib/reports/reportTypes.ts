// lib/reports/reportTypes.ts

export type ReportRole = "ADMIN" | "MANAGER" | "SUPERVISOR";

export type ReportColumnType =
  | "text"
  | "number"
  | "date"
  | "datetime"
  | "boolean";

export type ReportVisualization =
  | "datatable"
  | "table"
  | "kpi"
  | "bar"
  | "line"
  | "pie"
  | "donut"
  | "heatmap";

export type ReportFilterOperator =
  | "equals"
  | "contains"
  | "startsWith"
  | "dateRange"
  | "numberRange"
  | "in"
  | "isTrue"
  | "isFalse";

export type ReportAggregateFunction =
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "count";

export type ReportColumn = {
  key: string;
  label: string;
  sql: string;
  type: ReportColumnType;
  filterable?: boolean;
  sortable?: boolean;
  groupable?: boolean;
  aggregatable?: boolean;
  defaultVisible?: boolean;
};

export type ReportDatasetCategory =
  | "production"
  | "quality"
  | "recuts"
  | "maintenance"
  | "workflow"
  | "cross_module"
  | "admin";

export type ReportDataset = {
  key: string;
  label: string;
  description: string;
  sourceSql: string;
  category: ReportDatasetCategory;
  allowedRoles: ReportRole[];
  defaultColumns: string[];
  defaultSort: {
    column: string;
    direction: "asc" | "desc";
  };
  columns: ReportColumn[];
};

export type ReportFilterValue = {
  operator: ReportFilterOperator;
  value?: string | number | boolean | null;
  values?: Array<string | number | boolean>;
  from?: string | number | null;
  to?: string | number | null;
};

export type ReportAggregation = {
  column: string;
  function: ReportAggregateFunction;
  label?: string;
};

export type ReportSortConfig = {
  column: string;
  direction: "asc" | "desc";
};

export type ReportRunRequest = {
  savedReportId?: string | null;
  datasetKey: string;
  selectedColumns?: string[];
  filters?: Record<string, ReportFilterValue>;
  sort?: ReportSortConfig | null;
  grouping?: string[];
  aggregations?: ReportAggregation[];
  visualization?: ReportVisualization;
  page?: number;
  pageSize?: number;
};

export type ReportOutputColumn = {
  key: string;
  label: string;
  type: ReportColumnType;
};

export type ReportRunResult = {
  columns: ReportOutputColumn[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
};

export type SavedReportInput = {
  reportName: string;
  description?: string | null;
  datasetKey: string;
  visibility: "private" | "role" | "department" | "public_internal";
  sharedRoles?: string[];
  sharedDepartments?: string[];
  selectedColumns: string[];
  filters: Record<string, ReportFilterValue>;
  sort: ReportSortConfig | null;
  grouping: string[];
  aggregations: ReportAggregation[];
  visualization: ReportVisualization;
  chartConfig?: Record<string, unknown> | null;
};

export type SavedReportRow = {
  id: string;
  reportName: string;
  description: string | null;
  datasetKey: string;
  ownerUserId: string | null;
  ownerUsername: string | null;
  ownerName: string | null;
  ownerEmployeeNumber: number | null;
  visibility: string;
  sharedRoles: string[];
  sharedDepartments: string[];
  selectedColumns: string[];
  filters: Record<string, ReportFilterValue>;
  sort: ReportSortConfig | null;
  grouping: string[];
  aggregations: ReportAggregation[];
  visualization: ReportVisualization;
  chartConfig: Record<string, unknown> | null;
  lastRunAt: string | null;
  lastRunBy: string | null;
  createdAt: string;
  updatedAt: string;
};