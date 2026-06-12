// lib/reports/reportQueryBuilder.ts

import { humanizeReportLabel } from "./reportFormatters";
import { getReportDataset } from "./reportRegistry";
import type {
  ReportAggregation,
  ReportCalculatedColumn,
  ReportCalculatedColumnAggregatePart,
  ReportColumn,
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
  index: number
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

  if (fn !== "count" && !column.aggregatable) {
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
    if (!calculatedColumn.aggregate?.column || !calculatedColumn.aggregate?.function) {
      throw new Error(`Calculated column "${label}" is missing its aggregate setup.`);
    }

    const aggregate = buildAggregateExpression({
      part: calculatedColumn.aggregate,
      columnMap,
    });

    return `ROUND((${aggregate.expression})::numeric, ${normalizeDecimals(
      calculatedColumn.decimals
    )})`;
  }

  if (calculatedColumn.formulaType === "ratio") {
    if (
      !calculatedColumn.numerator?.column ||
      !calculatedColumn.numerator?.function ||
      !calculatedColumn.denominator?.column ||
      !calculatedColumn.denominator?.function
    ) {
      throw new Error(`Calculated column "${label}" is missing its ratio setup.`);
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

export function buildReportQuery(request: ReportRunRequest): BuiltReportQuery {
  const dataset = getReportDataset(request.datasetKey);
  if (!dataset) {
    throw new Error("Invalid report dataset.");
  }

  const page = normalizePage(request.page);
  const pageSize = normalizePageSize(request.pageSize);
  const offset = (page - 1) * pageSize;

  const columnMap = getColumnMap(dataset.columns);
  const params: unknown[] = [];
  const where: string[] = [];

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

  const hasGroupingOrAggregations =
    groupingKeys.length > 0 ||
    aggregations.length > 0 ||
    calculatedColumns.length > 0;

  const filters = request.filters ?? {};
  for (const [key, filter] of Object.entries(filters)) {
    const column = columnMap.get(key);
    if (!column || !column.filterable || !filter?.operator) continue;

    const clause = buildFilterClause({ column, filter, params });
    if (clause) where.push(`(${clause})`);
  }

  const selectParts: string[] = [];
  const groupByParts: string[] = [];
  const outputColumns: ReportOutputColumn[] = [];

  if (hasGroupingOrAggregations) {
    for (const key of groupingKeys) {
      const column = getColumnOrThrow(columnMap, key);
      if (!column.groupable) {
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

      if (aggregation.function !== "count" && !column.aggregatable) {
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
          `${aggregation.function.toUpperCase()}(${column.sql}) AS ${quoteIdent(alias)}`
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
  } else {
    for (const key of selectedColumnKeys) {
      const column = getColumnOrThrow(columnMap, key);
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

  const filterLogic = normalizeFilterLogic(request.filterLogic);
  const whereJoiner = filterLogic === "OR" ? " OR " : " AND ";
  const whereSql = where.length ? `WHERE ${where.join(whereJoiner)}` : "";
  const groupBySql = groupByParts.length ? `GROUP BY ${groupByParts.join(", ")}` : "";

  const sort = request.sort ?? dataset.defaultSort;
  let orderBySql = "";

  if (sort?.column) {
    const dir =
      String(sort.direction || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const outputKeys = new Set(outputColumns.map((c) => c.key));

    // Only allow sorting by output aliases that were generated from whitelisted
    // dataset metadata, safe aggregation aliases, or safe calculated aliases.
    if (outputKeys.has(sort.column)) {
      orderBySql = `ORDER BY ${quoteIdent(sort.column)} ${dir}`;
    }
  }

  const baseSql = `
    SELECT
      ${selectParts.join(",\n      ")}
    FROM ${dataset.sourceSql}
    ${whereSql}
    ${groupBySql}
  `;

  params.push(pageSize);
  const limitParam = `$${params.length}`;

  params.push(offset);
  const offsetParam = `$${params.length}`;

  const rowsSql = `
    ${baseSql}
    ${orderBySql}
    LIMIT ${limitParam}
    OFFSET ${offsetParam}
  `;

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM (
      ${baseSql}
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