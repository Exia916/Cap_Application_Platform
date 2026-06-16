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
  | "notEquals"
  | "contains"
  | "startsWith"
  | "dateRange"
  | "numberRange"
  | "in"
  | "notIn"
  | "isTrue"
  | "isFalse";

export type ReportFilterLogic = "AND" | "OR";

export type ReportAggregateFunction =
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "count";

export type ReportCalculatedColumnFormulaType =
  | "aggregate"
  | "ratio";

export type ReportCalculatedColumnFormat =
  | "number"
  | "percent"
  | "decimal";

export type ReportCalculatedColumnAggregatePart = {
  column: string;
  function: ReportAggregateFunction;
};

export type ReportCalculatedColumn = {
  /**
   * Stable client-side id for editing/removing rows in the builder.
   * It is not used directly as a SQL alias.
   */
  id?: string;

  /**
   * User-facing label shown in report results, CSV, PDF, and chart labels.
   */
  label: string;

  /**
   * aggregate:
   *   Examples:
   *   - Average Stitches = AVG(metric_total_stitches)
   *   - Total Pieces = SUM(metric_pieces)
   *
   * ratio:
   *   Examples:
   *   - Stitches per Piece = SUM(metric_total_stitches) / SUM(metric_pieces)
   *   - Reject Rate = SUM(rejected_quantity) / SUM(inspected_quantity) * 100
   */
  formulaType: ReportCalculatedColumnFormulaType;

  /**
   * Used when formulaType = aggregate.
   */
  aggregate?: ReportCalculatedColumnAggregatePart;

  /**
   * Used when formulaType = ratio.
   */
  numerator?: ReportCalculatedColumnAggregatePart;
  denominator?: ReportCalculatedColumnAggregatePart;

  /**
   * Optional multiplier for ratio formulas.
   * Example:
   * - Reject Rate % can use scale 100.
   */
  scale?: number;

  /**
   * Optional display hint. Query output remains numeric.
   */
  format?: ReportCalculatedColumnFormat;

  /**
   * Optional decimal-place hint for future display/export formatting.
   */
  decimals?: number;
};

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

  /**
   * Allows a column to be used for filters/date presets while hiding it from
   * output-column, grouping, aggregation, sorting, chart, CSV, and PDF selection.
   *
   * Example:
   * - operatorRecutRate.production_shift_date is used to filter the production
   *   cohort before recuts are joined, but it is not a real output column on the
   *   final operator/order result grain.
   */
  filterOnly?: boolean;
};

export type ReportDatasetCategory =
  | "production"
  | "quality"
  | "recuts"
  | "maintenance"
  | "workflow"
  | "logistics"
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
  filterLogic?: ReportFilterLogic;
  sort?: ReportSortConfig | null;
  grouping?: string[];
  aggregations?: ReportAggregation[];

  /**
   * User-created calculated summary columns.
   * These are evaluated server-side from whitelisted dataset columns.
   */
  calculatedColumns?: ReportCalculatedColumn[];

  visualization?: ReportVisualization;
  page?: number;
  pageSize?: number;
};

export type ReportOutputColumn = {
  key: string;
  label: string;
  type: ReportColumnType;

  /**
   * Marks output columns generated from calculatedColumns.
   */
  calculated?: boolean;

  /**
   * Optional display/export hint.
   */
  format?: ReportCalculatedColumnFormat;

  /**
   * Optional decimal-place hint.
   */
  decimals?: number;
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
  filterLogic?: ReportFilterLogic;
  sort: ReportSortConfig | null;
  grouping: string[];
  aggregations: ReportAggregation[];

  /**
   * Saved calculated summary columns.
   * Stored in chart_config to avoid changing the saved_reports table.
   */
  calculatedColumns?: ReportCalculatedColumn[];

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
  filterLogic?: ReportFilterLogic;
  sort: ReportSortConfig | null;
  grouping: string[];
  aggregations: ReportAggregation[];

  /**
   * Saved calculated summary columns.
   */
  calculatedColumns?: ReportCalculatedColumn[];

  visualization: ReportVisualization;
  chartConfig: Record<string, unknown> | null;
  lastRunAt: string | null;
  lastRunBy: string | null;
  createdAt: string;
  updatedAt: string;
  canEdit?: boolean;
};