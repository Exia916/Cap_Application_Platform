// lib/reports/operatorRecutRateQueryBuilder.ts

import { humanizeReportLabel } from "./reportFormatters";
import type {
  ReportAggregation,
  ReportCalculatedColumn,
  ReportCalculatedColumnAggregatePart,
  ReportColumn,
  ReportDataset,
  ReportFilterLogic,
  ReportFilterValue,
  ReportOutputColumn,
  ReportRunRequest,
} from "./reportTypes";

type BuiltReportQuery = {
  rowsSql: string;
  countSql: string;
  params: unknown[];
  columns: ReportOutputColumn[];
  page: number;
  pageSize: number;
};

function isSafeIdent(value: string) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
}

function quoteIdent(value: string) {
  if (!isSafeIdent(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }

  return `"${value}"`;
}

function getColumnMap(columns: ReportColumn[]) {
  return new Map(columns.map((c) => [c.key, c]));
}

function getColumnOrThrow(columns: Map<string, ReportColumn>, key: string) {
  const column = columns.get(key);
  if (!column) throw new Error(`Invalid report column: ${key}`);
  return column;
}

function isOutputColumn(column: ReportColumn) {
  return !column.filterOnly;
}

function isGroupableOutputColumn(column: ReportColumn) {
  return isOutputColumn(column) && !!column.groupable;
}

function isAggregatableOutputColumn(column: ReportColumn) {
  return isOutputColumn(column) && !!column.aggregatable;
}

function normalizePage(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 1;
}

function normalizePageSize(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 25;
  return Math.min(Math.trunc(n), 500);
}

function normalizeFilterLogic(value: unknown): ReportFilterLogic {
  return String(value || "").toUpperCase() === "OR" ? "OR" : "AND";
}

function aggregateAlias(aggregation: ReportAggregation) {
  return `${aggregation.function}_${aggregation.column}`;
}

function aggregateLabel(aggregation: ReportAggregation, column: ReportColumn) {
  if (aggregation.label?.trim()) return aggregation.label.trim();

  return humanizeReportLabel(`${aggregation.function}_${column.key}`);
}

function hasNonBlankValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
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

function calculatedColumnAlias(
  calculatedColumn: ReportCalculatedColumn,
  index: number,
) {
  const idPart = calculatedColumn.id
    ? slugForAlias(calculatedColumn.id)
    : slugForAlias(calculatedColumn.label);

  return `calc_${index + 1}_${idPart}`;
}

function normalizeDecimals(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 2;
  return Math.max(0, Math.min(6, Math.trunc(n)));
}

function normalizeScale(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(-1000000, Math.min(1000000, n));
}

function buildAggregateExpression(input: {
  part: ReportCalculatedColumnAggregatePart;
  columnMap: Map<string, ReportColumn>;
}) {
  const { part, columnMap } = input;

  const column = getColumnOrThrow(columnMap, part.column);
  const fn = part.function;

  if (!isOutputColumn(column)) {
    throw new Error(`${column.label} can only be used as a filter.`);
  }

  if (fn !== "count" && !isAggregatableOutputColumn(column)) {
    throw new Error(`${column.label} cannot be used in a calculated column.`);
  }

  switch (fn) {
    case "count":
      return {
        expression: "COUNT(*)",
        column,
      };

    case "sum":
      return {
        expression: `SUM(${column.sql})`,
        column,
      };

    case "avg":
      return {
        expression: `AVG(${column.sql})`,
        column,
      };

    case "min":
      return {
        expression: `MIN(${column.sql})`,
        column,
      };

    case "max":
      return {
        expression: `MAX(${column.sql})`,
        column,
      };

    default:
      throw new Error("Invalid calculated column function.");
  }
}

function buildCalculatedColumnExpression(input: {
  calculatedColumn: ReportCalculatedColumn;
  columnMap: Map<string, ReportColumn>;
}) {
  const { calculatedColumn, columnMap } = input;

  const label = calculatedColumn.label?.trim();
  if (!label) {
    throw new Error("Calculated column label is required.");
  }

  if (calculatedColumn.formulaType === "aggregate") {
    if (
      !calculatedColumn.aggregate?.column ||
      !calculatedColumn.aggregate?.function
    ) {
      throw new Error(
        `Calculated column "${label}" is missing its aggregate setup.`,
      );
    }

    const aggregate = buildAggregateExpression({
      part: calculatedColumn.aggregate,
      columnMap,
    });

    return `ROUND((${aggregate.expression})::numeric, ${normalizeDecimals(
      calculatedColumn.decimals,
    )})`;
  }

  if (calculatedColumn.formulaType === "ratio") {
    if (
      !calculatedColumn.numerator?.column ||
      !calculatedColumn.numerator?.function ||
      !calculatedColumn.denominator?.column ||
      !calculatedColumn.denominator?.function
    ) {
      throw new Error(
        `Calculated column "${label}" is missing its ratio setup.`,
      );
    }

    const numerator = buildAggregateExpression({
      part: calculatedColumn.numerator,
      columnMap,
    });

    const denominator = buildAggregateExpression({
      part: calculatedColumn.denominator,
      columnMap,
    });

    const scale = normalizeScale(calculatedColumn.scale);
    const decimals = normalizeDecimals(calculatedColumn.decimals);

    return `
      ROUND(
        (
          (${numerator.expression})::numeric
          / NULLIF((${denominator.expression})::numeric, 0)
        ) * ${scale},
        ${decimals}
      )
    `;
  }

  throw new Error(`Invalid calculated column formula type for "${label}".`);
}

function buildFilterClause(input: {
  column: ReportColumn;
  filter: ReportFilterValue;
  params: unknown[];
}) {
  const { column, filter, params } = input;
  const colSql = column.sql;
  const operator = filter.operator;

  switch (operator) {
    case "equals": {
      params.push(filter.value ?? null);
      return `${colSql} = $${params.length}`;
    }

    case "notEquals": {
      params.push(filter.value ?? null);
      return `${colSql} IS DISTINCT FROM $${params.length}`;
    }

    case "contains": {
      const value = String(filter.value ?? "").trim();
      if (!value) return null;

      params.push(`%${value}%`);
      return `CAST(${colSql} AS text) ILIKE $${params.length}`;
    }

    case "startsWith": {
      const value = String(filter.value ?? "").trim();
      if (!value) return null;

      params.push(`${value}%`);
      return `CAST(${colSql} AS text) ILIKE $${params.length}`;
    }

    case "dateRange": {
      const clauses: string[] = [];

      if (hasNonBlankValue(filter.from)) {
        params.push(filter.from);
        clauses.push(`${colSql} >= $${params.length}::date`);
      }

      if (hasNonBlankValue(filter.to)) {
        params.push(filter.to);
        clauses.push(`${colSql} <= $${params.length}::date`);
      }

      return clauses.length ? clauses.join(" AND ") : null;
    }

    case "numberRange": {
      const clauses: string[] = [];

      if (hasNonBlankValue(filter.from)) {
        const value = Number(filter.from);
        if (Number.isFinite(value)) {
          params.push(value);
          clauses.push(`${colSql} >= $${params.length}`);
        }
      }

      if (hasNonBlankValue(filter.to)) {
        const value = Number(filter.to);
        if (Number.isFinite(value)) {
          params.push(value);
          clauses.push(`${colSql} <= $${params.length}`);
        }
      }

      return clauses.length ? clauses.join(" AND ") : null;
    }

    case "in": {
      const values = Array.isArray(filter.values)
        ? filter.values.filter((v) => hasNonBlankValue(v))
        : [];

      if (!values.length) return null;

      params.push(values.map((v) => String(v)));
      return `CAST(${colSql} AS text) = ANY($${params.length}::text[])`;
    }

    case "notIn": {
      const values = Array.isArray(filter.values)
        ? filter.values.filter((v) => hasNonBlankValue(v))
        : [];

      if (!values.length) return null;

      params.push(values.map((v) => String(v)));
      return `NOT (CAST(${colSql} AS text) = ANY($${params.length}::text[]))`;
    }

    case "isTrue":
      return `${colSql} IS TRUE`;

    case "isFalse":
      return `${colSql} IS FALSE`;

    default:
      return null;
  }
}

function productionFilterSqlForKey(key: string) {
  switch (key) {
    case "production_shift_date":
    case "shift_date":
      return "p.shift_date";

    case "source_module":
      return "p.source_module";

    case "department":
      return "p.department";

    case "shift":
      return "p.shift";

    case "operator_name":
      return "p.operator_name";

    case "operator_match_key":
      return "public.cap_report_normalize_key(p.operator_name)";

    case "sales_order_base":
      return "p.sales_order_base";

    default:
      return null;
  }
}

function aggregateFilterSqlForGroupedOutput(key: string) {
  switch (key) {
    case "produced_pieces":
      return "SUM(produced_pieces)";

    case "production_entry_count":
      return "SUM(production_entry_count)";

    case "gross_recut_count":
      return "SUM(gross_recut_count)";

    case "gross_recut_pieces":
      return "SUM(gross_recut_pieces)";

    case "excluded_recut_count":
      return "SUM(excluded_recut_count)";

    case "excluded_recut_pieces":
      return "SUM(excluded_recut_pieces)";

    case "accountable_recut_count":
      return "SUM(accountable_recut_count)";

    case "accountable_recut_pieces":
      return "SUM(accountable_recut_pieces)";

    case "gross_recut_piece_rate":
      return `
        ROUND(
          (
            SUM(gross_recut_pieces)::numeric
            / NULLIF(SUM(produced_pieces)::numeric, 0)
          ) * 100,
          4
        )
      `;

    case "accountable_recut_piece_rate":
      return `
        ROUND(
          (
            SUM(accountable_recut_pieces)::numeric
            / NULLIF(SUM(produced_pieces)::numeric, 0)
          ) * 100,
          4
        )
      `;

    case "gross_recuts_per_1000_pieces":
      return `
        ROUND(
          (
            SUM(gross_recut_count)::numeric
            / NULLIF(SUM(produced_pieces)::numeric, 0)
          ) * 1000,
          4
        )
      `;

    case "accountable_recuts_per_1000_pieces":
      return `
        ROUND(
          (
            SUM(accountable_recut_count)::numeric
            / NULLIF(SUM(produced_pieces)::numeric, 0)
          ) * 1000,
          4
        )
      `;

    default:
      return null;
  }
}

function buildOperatorRecutRateBaseRowsSql(productionWhereSql: string) {
  return `
    WITH production_filtered AS (
      SELECT
        p.shift_date::date AS shift_date,
        NULLIF(btrim(p.operator_name), '') AS operator_name,
        public.cap_report_normalize_key(p.operator_name) AS operator_match_key,
        NULLIF(btrim(p.sales_order_base), '') AS sales_order_base,
        COALESCE(p.metric_pieces, 0)::numeric AS metric_pieces
      FROM reporting.v_production_activity p
      WHERE p.shift_date IS NOT NULL
        AND public.cap_report_normalize_key(p.operator_name) IS NOT NULL
        AND NULLIF(btrim(p.sales_order_base), '') IS NOT NULL
        AND COALESCE(p.metric_pieces, 0) > 0
        ${productionWhereSql}
    ),

    production_by_operator_order AS (
      SELECT
        pf.operator_match_key,
        MIN(pf.operator_name) AS operator_name,
        pf.sales_order_base,
        MIN(pf.shift_date) AS production_first_shift_date,
        MAX(pf.shift_date) AS production_last_shift_date,
        SUM(pf.metric_pieces)::numeric AS produced_pieces,
        COUNT(*)::integer AS production_entry_count
      FROM production_filtered pf
      GROUP BY
        pf.operator_match_key,
        pf.sales_order_base
    ),

    recuts_by_operator_order AS (
      SELECT
        r.operator_match_key,
        NULLIF(btrim(r.sales_order_base), '') AS sales_order_base,

        COUNT(*)::integer AS gross_recut_count,
        COALESCE(SUM(COALESCE(r.pieces, 0)), 0)::numeric AS gross_recut_pieces,

        COUNT(*) FILTER (
          WHERE COALESCE(r.is_excluded_from_operator_rate, false) = true
        )::integer AS excluded_recut_count,

        COALESCE(
          SUM(COALESCE(r.pieces, 0)) FILTER (
            WHERE COALESCE(r.is_excluded_from_operator_rate, false) = true
          ),
          0
        )::numeric AS excluded_recut_pieces,

        COUNT(*) FILTER (
          WHERE COALESCE(r.is_excluded_from_operator_rate, false) = false
        )::integer AS accountable_recut_count,

        COALESCE(
          SUM(COALESCE(r.pieces, 0)) FILTER (
            WHERE COALESCE(r.is_excluded_from_operator_rate, false) = false
          ),
          0
        )::numeric AS accountable_recut_pieces,

        string_agg(
          DISTINCT NULLIF(btrim(r.recut_reason), ''),
          ', ' ORDER BY NULLIF(btrim(r.recut_reason), '')
        ) AS recut_reasons,

        string_agg(
          DISTINCT NULLIF(btrim(r.recut_reason), ''),
          ', ' ORDER BY NULLIF(btrim(r.recut_reason), '')
        ) FILTER (
          WHERE COALESCE(r.is_excluded_from_operator_rate, false) = true
        ) AS excluded_recut_reasons,

        MIN(r.requested_date) AS first_recut_requested_date,
        MAX(r.requested_date) AS last_recut_requested_date
      FROM reporting.v_recut_activity_accountability r
      INNER JOIN production_by_operator_order pbo
        ON pbo.operator_match_key = r.operator_match_key
       AND pbo.sales_order_base = NULLIF(btrim(r.sales_order_base), '')
      WHERE COALESCE(r.is_voided, false) = false
        AND r.operator_match_key IS NOT NULL
        AND NULLIF(btrim(r.sales_order_base), '') IS NOT NULL
      GROUP BY
        r.operator_match_key,
        NULLIF(btrim(r.sales_order_base), '')
    )

    SELECT
      pbo.operator_name,
      pbo.operator_match_key,
      pbo.sales_order_base,

      pbo.production_first_shift_date,
      pbo.production_last_shift_date,
      pbo.produced_pieces,
      pbo.production_entry_count,

      COALESCE(rbo.gross_recut_count, 0)::integer AS gross_recut_count,
      COALESCE(rbo.gross_recut_pieces, 0)::numeric AS gross_recut_pieces,

      COALESCE(rbo.excluded_recut_count, 0)::integer AS excluded_recut_count,
      COALESCE(rbo.excluded_recut_pieces, 0)::numeric AS excluded_recut_pieces,

      COALESCE(rbo.accountable_recut_count, 0)::integer AS accountable_recut_count,
      COALESCE(rbo.accountable_recut_pieces, 0)::numeric AS accountable_recut_pieces,

      ROUND(
        (
          COALESCE(rbo.gross_recut_pieces, 0)::numeric
          / NULLIF(pbo.produced_pieces::numeric, 0)
        ) * 100,
        4
      ) AS gross_recut_piece_rate,

      ROUND(
        (
          COALESCE(rbo.accountable_recut_pieces, 0)::numeric
          / NULLIF(pbo.produced_pieces::numeric, 0)
        ) * 100,
        4
      ) AS accountable_recut_piece_rate,

      ROUND(
        (
          COALESCE(rbo.gross_recut_count, 0)::numeric
          / NULLIF(pbo.produced_pieces::numeric, 0)
        ) * 1000,
        4
      ) AS gross_recuts_per_1000_pieces,

      ROUND(
        (
          COALESCE(rbo.accountable_recut_count, 0)::numeric
          / NULLIF(pbo.produced_pieces::numeric, 0)
        ) * 1000,
        4
      ) AS accountable_recuts_per_1000_pieces,

      COALESCE(rbo.recut_reasons, '') AS recut_reasons,
      COALESCE(rbo.excluded_recut_reasons, '') AS excluded_recut_reasons,

      rbo.first_recut_requested_date,
      rbo.last_recut_requested_date
    FROM production_by_operator_order pbo
    LEFT JOIN recuts_by_operator_order rbo
      ON rbo.operator_match_key = pbo.operator_match_key
     AND rbo.sales_order_base = pbo.sales_order_base
  `;
}

function weightedRateSql(
  numerator: string,
  denominator = "produced_pieces",
  multiplier = 100,
) {
  return `
    ROUND(
      (
        SUM(${numerator})::numeric
        / NULLIF(SUM(${denominator})::numeric, 0)
      ) * ${multiplier},
      4
    )
  `;
}

function summarySelectForColumn(key: string) {
  switch (key) {
    case "operator_name":
      return {
        selectSql: `MIN(operator_name) AS ${quoteIdent(key)}`,
        groupBySql: "operator_match_key",
      };

    case "operator_match_key":
      return {
        selectSql: `operator_match_key AS ${quoteIdent(key)}`,
        groupBySql: "operator_match_key",
      };

    case "production_first_shift_date":
      return {
        selectSql: `MIN(production_first_shift_date) AS ${quoteIdent(key)}`,
      };

    case "production_last_shift_date":
      return {
        selectSql: `MAX(production_last_shift_date) AS ${quoteIdent(key)}`,
      };

    case "produced_pieces":
    case "production_entry_count":
    case "gross_recut_count":
    case "gross_recut_pieces":
    case "excluded_recut_count":
    case "excluded_recut_pieces":
    case "accountable_recut_count":
    case "accountable_recut_pieces":
      return {
        selectSql: `SUM(${key}) AS ${quoteIdent(key)}`,
      };

    case "gross_recut_piece_rate":
      return {
        selectSql: `${weightedRateSql("gross_recut_pieces")} AS ${quoteIdent(key)}`,
      };

    case "accountable_recut_piece_rate":
      return {
        selectSql: `${weightedRateSql("accountable_recut_pieces")} AS ${quoteIdent(key)}`,
      };

    case "gross_recuts_per_1000_pieces":
      return {
        selectSql: `${weightedRateSql("gross_recut_count", "produced_pieces", 1000)} AS ${quoteIdent(key)}`,
      };

    case "accountable_recuts_per_1000_pieces":
      return {
        selectSql: `${weightedRateSql("accountable_recut_count", "produced_pieces", 1000)} AS ${quoteIdent(key)}`,
      };

    case "recut_reasons":
    case "excluded_recut_reasons":
      return {
        selectSql: `COALESCE(string_agg(DISTINCT NULLIF(btrim(${key}), ''), ', ' ORDER BY NULLIF(btrim(${key}), '')), '') AS ${quoteIdent(key)}`,
      };

    case "first_recut_requested_date":
      return {
        selectSql: `MIN(first_recut_requested_date) AS ${quoteIdent(key)}`,
      };

    case "last_recut_requested_date":
      return {
        selectSql: `MAX(last_recut_requested_date) AS ${quoteIdent(key)}`,
      };

    default:
      return null;
  }
}

export function buildOperatorRecutRateQuery(input: {
  request: ReportRunRequest;
  dataset: ReportDataset;
}): BuiltReportQuery {
  const { request, dataset } = input;

  if (dataset.key !== "operatorRecutRate") {
    throw new Error("Invalid dataset for operator recut-rate query builder.");
  }

  const page = normalizePage(request.page);
  const pageSize = normalizePageSize(request.pageSize);
  const offset = (page - 1) * pageSize;

  const columnMap = getColumnMap(dataset.columns);
  const params: unknown[] = [];

  const selectedColumnKeys =
    Array.isArray(request.selectedColumns) && request.selectedColumns.length
      ? request.selectedColumns
      : dataset.defaultColumns;

  const groupingKeys = Array.isArray(request.grouping) ? request.grouping : [];
  const aggregations = Array.isArray(request.aggregations)
    ? request.aggregations
    : [];
  const calculatedColumns = Array.isArray(request.calculatedColumns)
    ? request.calculatedColumns.filter((column) => column?.label?.trim())
    : [];

  const hasExplicitGroupingOrAggregations =
    groupingKeys.length > 0 ||
    aggregations.length > 0 ||
    calculatedColumns.length > 0;

  // The base cohort is operator + sales order. If the user is not showing the
  // sales order in a detail report, summarize the base rows by operator so the
  // rate is based on the filtered period totals instead of the per-SO line rate.
  const summarizeDetailByOperator =
    !hasExplicitGroupingOrAggregations &&
    !selectedColumnKeys.includes("sales_order_base");

  const hasAggregateOutput =
    hasExplicitGroupingOrAggregations || summarizeDetailByOperator;

  const filterLogic = normalizeFilterLogic(request.filterLogic);
  const filterJoiner = filterLogic === "OR" ? " OR " : " AND ";

  const productionWhere: string[] = [];
  const outerWhere: string[] = [];
  const having: string[] = [];

  const filters = request.filters ?? {};

  for (const [key, filter] of Object.entries(filters)) {
    const column = columnMap.get(key);
    if (!column || !column.filterable || !filter?.operator) continue;

    const productionSql = productionFilterSqlForKey(key);
    if (productionSql) {
      const clause = buildFilterClause({
        column: {
          ...column,
          sql: productionSql,
        },
        filter,
        params,
      });

      if (clause) productionWhere.push(`(${clause})`);
      continue;
    }

    const aggregateSql = hasAggregateOutput
      ? aggregateFilterSqlForGroupedOutput(key)
      : null;

    if (aggregateSql) {
      const clause = buildFilterClause({
        column: {
          ...column,
          sql: aggregateSql,
        },
        filter,
        params,
      });

      if (clause) having.push(`(${clause})`);
      continue;
    }

    const clause = buildFilterClause({ column, filter, params });
    if (clause) outerWhere.push(`(${clause})`);
  }

  const productionWhereSql = productionWhere.length
    ? `AND (${productionWhere.join(filterJoiner)})`
    : "";

  const baseRowsSql = buildOperatorRecutRateBaseRowsSql(productionWhereSql);

  const selectParts: string[] = [];
  const groupByParts: string[] = [];
  const outputColumns: ReportOutputColumn[] = [];

  if (hasExplicitGroupingOrAggregations) {
    for (const key of groupingKeys) {
      const column = getColumnOrThrow(columnMap, key);

      if (!isGroupableOutputColumn(column)) {
        throw new Error(`${column.label} cannot be used for grouping.`);
      }

      selectParts.push(`${column.sql} AS ${quoteIdent(column.key)}`);
      groupByParts.push(column.sql);
      outputColumns.push({
        key: column.key,
        label: column.label,
        type: column.type,
      });
    }

    for (const aggregation of aggregations) {
      const column = getColumnOrThrow(columnMap, aggregation.column);

      if (!isOutputColumn(column)) {
        throw new Error(`${column.label} can only be used as a filter.`);
      }

      if (
        aggregation.function !== "count" &&
        !isAggregatableOutputColumn(column)
      ) {
        throw new Error(`${column.label} cannot be aggregated.`);
      }

      const alias = aggregateAlias(aggregation);

      if (!isSafeIdent(alias)) {
        throw new Error(`Invalid aggregation alias: ${alias}`);
      }

      if (aggregation.function === "count") {
        selectParts.push(`COUNT(*) AS ${quoteIdent(alias)}`);
      } else {
        selectParts.push(
          `${aggregation.function.toUpperCase()}(${column.sql}) AS ${quoteIdent(alias)}`,
        );
      }

      outputColumns.push({
        key: alias,
        label: aggregateLabel(aggregation, column),
        type: "number",
      });
    }

    calculatedColumns.forEach((calculatedColumn, index) => {
      const alias = calculatedColumnAlias(calculatedColumn, index);

      if (!isSafeIdent(alias)) {
        throw new Error(`Invalid calculated column alias: ${alias}`);
      }

      const expression = buildCalculatedColumnExpression({
        calculatedColumn,
        columnMap,
      });

      selectParts.push(`${expression} AS ${quoteIdent(alias)}`);

      outputColumns.push({
        key: alias,
        label: calculatedColumn.label.trim(),
        type: "number",
        calculated: true,
        format: calculatedColumn.format,
        decimals: calculatedColumn.decimals,
      });
    });
  } else if (summarizeDetailByOperator) {
    const groupBySet = new Set<string>();

    for (const key of selectedColumnKeys) {
      const column = getColumnOrThrow(columnMap, key);

      if (!isOutputColumn(column)) {
        throw new Error(`${column.label} can only be used as a filter.`);
      }

      const summary = summarySelectForColumn(key);

      if (!summary) {
        throw new Error(
          `${column.label} cannot be used in the operator summary view.`,
        );
      }

      selectParts.push(summary.selectSql);
      if (summary.groupBySql) groupBySet.add(summary.groupBySql);

      outputColumns.push({
        key: column.key,
        label: column.label,
        type: column.type,
      });
    }

    if (!groupBySet.size) groupBySet.add("operator_match_key");
    groupByParts.push(...groupBySet);
  } else {
    for (const key of selectedColumnKeys) {
      const column = getColumnOrThrow(columnMap, key);

      if (!isOutputColumn(column)) {
        throw new Error(`${column.label} can only be used as a filter.`);
      }

      selectParts.push(`${column.sql} AS ${quoteIdent(column.key)}`);
      outputColumns.push({
        key: column.key,
        label: column.label,
        type: column.type,
      });
    }
  }

  if (!selectParts.length) {
    throw new Error("At least one column or aggregation is required.");
  }

  const outerWhereSql = outerWhere.length
    ? `WHERE ${outerWhere.join(filterJoiner)}`
    : "";

  const groupBySql = groupByParts.length
    ? `GROUP BY ${groupByParts.join(", ")}`
    : "";

  const havingSql = having.length ? `HAVING ${having.join(filterJoiner)}` : "";

  const sort = request.sort ?? dataset.defaultSort;
  let orderBySql = "";

  if (sort?.column) {
    const dir =
      String(sort.direction || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const outputKeys = new Set(outputColumns.map((c) => c.key));

    if (outputKeys.has(sort.column)) {
      orderBySql = `ORDER BY ${quoteIdent(sort.column)} ${dir}`;
    }
  }

  const reportBaseSql = `
    SELECT
      ${selectParts.join(",\n      ")}
    FROM (
      ${baseRowsSql}
    ) base
    ${outerWhereSql}
    ${groupBySql}
    ${havingSql}
  `;

  params.push(pageSize);
  const limitParam = `$${params.length}`;

  params.push(offset);
  const offsetParam = `$${params.length}`;

  const rowsSql = `
    ${reportBaseSql}
    ${orderBySql}
    LIMIT ${limitParam}
    OFFSET ${offsetParam}
  `;

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM (
      ${reportBaseSql}
    ) q
  `;

  return {
    rowsSql,
    countSql,
    params,
    columns: outputColumns,
    page,
    pageSize,
  };
}
