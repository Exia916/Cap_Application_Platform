"use client";

import type {
  ReportAggregateFunction,
  ReportCalculatedColumn,
  ReportCalculatedColumnAggregatePart,
  ReportCalculatedColumnFormat,
  ReportCalculatedColumnFormulaType,
} from "@/lib/reports/reportTypes";

type DatasetColumn = {
  key: string;
  label: string;
  type: string;
  aggregatable?: boolean;
};

type Props = {
  columns: DatasetColumn[];
  calculatedColumns: ReportCalculatedColumn[];
  onCalculatedColumnsChange: (next: ReportCalculatedColumn[]) => void;
  disabled?: boolean;
};

const AGGREGATE_FUNCTIONS: Array<{
  value: ReportAggregateFunction;
  label: string;
}> = [
  { value: "sum", label: "Sum" },
  { value: "avg", label: "Average" },
  { value: "min", label: "Minimum" },
  { value: "max", label: "Maximum" },
  { value: "count", label: "Count Rows" },
];

const FORMULA_TYPES: Array<{
  value: ReportCalculatedColumnFormulaType;
  label: string;
  description: string;
}> = [
  {
    value: "aggregate",
    label: "Aggregate",
    description: "Example: Average Total Stitches, Sum Pieces, Count Rows",
  },
  {
    value: "ratio",
    label: "Ratio",
    description: "Example: Total Stitches / Total Pieces",
  },
];

const FORMATS: Array<{
  value: ReportCalculatedColumnFormat;
  label: string;
}> = [
  { value: "number", label: "Number" },
  { value: "decimal", label: "Decimal" },
  { value: "percent", label: "Percent" },
];

function newId() {
  return `calc_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function defaultAggregatePart(columns: DatasetColumn[]): ReportCalculatedColumnAggregatePart {
  const firstNumeric =
    columns.find((column) => column.aggregatable && column.type === "number") ??
    columns.find((column) => column.type === "number") ??
    columns[0];

  return {
    column: firstNumeric?.key ?? "",
    function: "avg",
  };
}

function defaultCalculatedColumn(columns: DatasetColumn[]): ReportCalculatedColumn {
  const aggregate = defaultAggregatePart(columns);

  return {
    id: newId(),
    label: "Average Value",
    formulaType: "aggregate",
    aggregate,
    format: "number",
    decimals: 2,
  };
}

function selectableColumnsForFunction(
  columns: DatasetColumn[],
  fn: ReportAggregateFunction
) {
  if (fn === "count") {
    return columns;
  }

  return columns.filter((column) => column.aggregatable && column.type === "number");
}

function describeAggregatePart(
  part: ReportCalculatedColumnAggregatePart | undefined,
  columns: DatasetColumn[]
) {
  if (!part) return "Not configured";

  const column = columns.find((item) => item.key === part.column);
  const fn = AGGREGATE_FUNCTIONS.find((item) => item.value === part.function);

  return `${fn?.label ?? part.function} ${column?.label ?? part.column}`;
}

function describeFormula(column: ReportCalculatedColumn, columns: DatasetColumn[]) {
  if (column.formulaType === "ratio") {
    return `${describeAggregatePart(column.numerator, columns)} ÷ ${describeAggregatePart(
      column.denominator,
      columns
    )}${Number(column.scale ?? 1) !== 1 ? ` × ${column.scale}` : ""}`;
  }

  return describeAggregatePart(column.aggregate, columns);
}

function normalizeDecimalValue(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 2;
  return Math.max(0, Math.min(6, Math.trunc(n)));
}

function normalizeScaleValue(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(-1000000, Math.min(1000000, n));
}

function updatePartColumnForFunction(
  part: ReportCalculatedColumnAggregatePart | undefined,
  fn: ReportAggregateFunction,
  columns: DatasetColumn[]
): ReportCalculatedColumnAggregatePart {
  const allowedColumns = selectableColumnsForFunction(columns, fn);
  const currentColumnStillAllowed =
    part?.column && allowedColumns.some((column) => column.key === part.column);

  return {
    function: fn,
    column: currentColumnStillAllowed ? part!.column : allowedColumns[0]?.key ?? "",
  };
}

export default function ReportCalculatedColumnsBuilder({
  columns,
  calculatedColumns,
  onCalculatedColumnsChange,
  disabled = false,
}: Props) {
  const numericColumns = columns.filter(
    (column) => column.aggregatable && column.type === "number"
  );

  function updateCalculatedColumn(
    index: number,
    patch: Partial<ReportCalculatedColumn>
  ) {
    onCalculatedColumnsChange(
      calculatedColumns.map((column, i) =>
        i === index
          ? {
              ...column,
              ...patch,
            }
          : column
      )
    );
  }

  function removeCalculatedColumn(index: number) {
    onCalculatedColumnsChange(calculatedColumns.filter((_, i) => i !== index));
  }

  function addCalculatedColumn() {
    onCalculatedColumnsChange([...calculatedColumns, defaultCalculatedColumn(columns)]);
  }

  function updateAggregatePart(input: {
    index: number;
    partKey: "aggregate" | "numerator" | "denominator";
    patch: Partial<ReportCalculatedColumnAggregatePart>;
  }) {
    const current = calculatedColumns[input.index];
    const currentPart = current?.[input.partKey];

    updateCalculatedColumn(input.index, {
      [input.partKey]: {
        column: currentPart?.column ?? "",
        function: currentPart?.function ?? "sum",
        ...input.patch,
      },
    } as Partial<ReportCalculatedColumn>);
  }

  return (
    <div className="section-stack">
      <style>{`
        .report-calc-row {
          display: grid;
          gap: 12px;
          padding: 14px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
        }

        .report-calc-row-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .report-calc-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(160px, 1fr));
          gap: 12px;
        }

        .report-calc-ratio-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(140px, 1fr));
          gap: 12px;
        }

        .report-calc-preview {
          display: inline-flex;
          width: fit-content;
          max-width: 100%;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface-subtle);
          color: var(--text);
          font-size: 12px;
          font-weight: 700;
        }

        @media (max-width: 1200px) {
          .report-calc-grid,
          .report-calc-ratio-grid {
            grid-template-columns: repeat(2, minmax(160px, 1fr));
          }
        }

        @media (max-width: 700px) {
          .report-calc-grid,
          .report-calc-ratio-grid {
            grid-template-columns: 1fr;
          }

          .report-calc-row-header {
            display: grid;
          }
        }
      `}</style>

      <div className="section-card-header" style={{ marginBottom: 0 }}>
        <div>
          <h3 style={{ marginBottom: 4 }}>Calculated Summary Columns</h3>
          <p className="page-subtitle">
            Add safe formula columns that are calculated server-side from approved report
            fields. These work with grouped summary reports.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={addCalculatedColumn}
          disabled={disabled || !columns.length || !numericColumns.length}
        >
          Add Calculated Column
        </button>
      </div>

      {!numericColumns.length ? (
        <div className="alert alert-warning">
          This dataset does not have numeric fields available for calculated columns.
        </div>
      ) : null}

      {calculatedColumns.length === 0 ? (
        <div className="text-soft">
          No calculated columns added. Use this for values such as Average Stitches,
          Stitches per Piece, or Reject Rate.
        </div>
      ) : null}

      {calculatedColumns.map((calculatedColumn, index) => {
        const formulaType = calculatedColumn.formulaType ?? "aggregate";
        const aggregate = calculatedColumn.aggregate ?? defaultAggregatePart(columns);
        const numerator = calculatedColumn.numerator ?? {
          ...defaultAggregatePart(columns),
          function: "sum" as ReportAggregateFunction,
        };
        const denominator = calculatedColumn.denominator ?? {
          ...defaultAggregatePart(columns),
          function: "sum" as ReportAggregateFunction,
        };

        const aggregateColumnOptions = selectableColumnsForFunction(
          columns,
          aggregate.function
        );
        const numeratorColumnOptions = selectableColumnsForFunction(
          columns,
          numerator.function
        );
        const denominatorColumnOptions = selectableColumnsForFunction(
          columns,
          denominator.function
        );

        return (
          <div key={calculatedColumn.id || index} className="report-calc-row">
            <div className="report-calc-row-header">
              <div>
                <strong>{calculatedColumn.label || `Calculated Column ${index + 1}`}</strong>
                <div className="field-help">{describeFormula(calculatedColumn, columns)}</div>
              </div>

              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => removeCalculatedColumn(index)}
                disabled={disabled}
              >
                Remove
              </button>
            </div>

            <div className="report-calc-grid">
              <div>
                <label className="field-label">Label</label>
                <input
                  className="input"
                  value={calculatedColumn.label ?? ""}
                  onChange={(event) =>
                    updateCalculatedColumn(index, {
                      label: event.target.value,
                    })
                  }
                  placeholder="Average Stitches"
                  disabled={disabled}
                />
              </div>

              <div>
                <label className="field-label">Formula Type</label>
                <select
                  className="select"
                  value={formulaType}
                  onChange={(event) => {
                    const nextType = event.target.value as ReportCalculatedColumnFormulaType;

                    if (nextType === "ratio") {
                      updateCalculatedColumn(index, {
                        formulaType: "ratio",
                        numerator,
                        denominator,
                        scale: calculatedColumn.scale ?? 1,
                        format: calculatedColumn.format ?? "decimal",
                        decimals: calculatedColumn.decimals ?? 2,
                      });
                    } else {
                      updateCalculatedColumn(index, {
                        formulaType: "aggregate",
                        aggregate,
                        format: calculatedColumn.format ?? "number",
                        decimals: calculatedColumn.decimals ?? 2,
                      });
                    }
                  }}
                  disabled={disabled}
                >
                  {FORMULA_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field-label">Format</label>
                <select
                  className="select"
                  value={calculatedColumn.format ?? "number"}
                  onChange={(event) => {
                    const nextFormat = event.target.value as ReportCalculatedColumnFormat;

                    updateCalculatedColumn(index, {
                      format: nextFormat,
                      scale:
                        formulaType === "ratio" && nextFormat === "percent"
                          ? 100
                          : calculatedColumn.scale ?? 1,
                    });
                  }}
                  disabled={disabled}
                >
                  {FORMATS.map((format) => (
                    <option key={format.value} value={format.value}>
                      {format.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field-label">Decimals</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={6}
                  value={calculatedColumn.decimals ?? 2}
                  onChange={(event) =>
                    updateCalculatedColumn(index, {
                      decimals: normalizeDecimalValue(event.target.value),
                    })
                  }
                  disabled={disabled}
                />
              </div>
            </div>

            {formulaType === "aggregate" ? (
              <div className="report-calc-grid">
                <div>
                  <label className="field-label">Function</label>
                  <select
                    className="select"
                    value={aggregate.function}
                    onChange={(event) => {
                      const fn = event.target.value as ReportAggregateFunction;
                      updateCalculatedColumn(index, {
                        aggregate: updatePartColumnForFunction(aggregate, fn, columns),
                      });
                    }}
                    disabled={disabled}
                  >
                    {AGGREGATE_FUNCTIONS.map((fn) => (
                      <option key={fn.value} value={fn.value}>
                        {fn.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label">Column</label>
                  <select
                    className="select"
                    value={aggregate.column}
                    onChange={(event) =>
                      updateAggregatePart({
                        index,
                        partKey: "aggregate",
                        patch: { column: event.target.value },
                      })
                    }
                    disabled={disabled}
                  >
                    {aggregateColumnOptions.map((column) => (
                      <option key={column.key} value={column.key}>
                        {column.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <>
                <div className="report-calc-ratio-grid">
                  <div>
                    <label className="field-label">Numerator Function</label>
                    <select
                      className="select"
                      value={numerator.function}
                      onChange={(event) => {
                        const fn = event.target.value as ReportAggregateFunction;
                        updateCalculatedColumn(index, {
                          numerator: updatePartColumnForFunction(numerator, fn, columns),
                        });
                      }}
                      disabled={disabled}
                    >
                      {AGGREGATE_FUNCTIONS.map((fn) => (
                        <option key={fn.value} value={fn.value}>
                          {fn.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="field-label">Numerator Column</label>
                    <select
                      className="select"
                      value={numerator.column}
                      onChange={(event) =>
                        updateAggregatePart({
                          index,
                          partKey: "numerator",
                          patch: { column: event.target.value },
                        })
                      }
                      disabled={disabled}
                    >
                      {numeratorColumnOptions.map((column) => (
                        <option key={column.key} value={column.key}>
                          {column.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="field-label">Denominator Function</label>
                    <select
                      className="select"
                      value={denominator.function}
                      onChange={(event) => {
                        const fn = event.target.value as ReportAggregateFunction;
                        updateCalculatedColumn(index, {
                          denominator: updatePartColumnForFunction(denominator, fn, columns),
                        });
                      }}
                      disabled={disabled}
                    >
                      {AGGREGATE_FUNCTIONS.map((fn) => (
                        <option key={fn.value} value={fn.value}>
                          {fn.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="field-label">Denominator Column</label>
                    <select
                      className="select"
                      value={denominator.column}
                      onChange={(event) =>
                        updateAggregatePart({
                          index,
                          partKey: "denominator",
                          patch: { column: event.target.value },
                        })
                      }
                      disabled={disabled}
                    >
                      {denominatorColumnOptions.map((column) => (
                        <option key={column.key} value={column.key}>
                          {column.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="field-label">Scale</label>
                    <input
                      className="input"
                      type="number"
                      value={calculatedColumn.scale ?? 1}
                      onChange={(event) =>
                        updateCalculatedColumn(index, {
                          scale: normalizeScaleValue(event.target.value),
                        })
                      }
                      disabled={disabled}
                    />
                    <div className="field-help">Use 100 for percent-style ratios.</div>
                  </div>
                </div>
              </>
            )}

            <div className="report-calc-preview">
              Preview: {calculatedColumn.label || "Calculated Column"} ={" "}
              {describeFormula(calculatedColumn, columns)}
            </div>
          </div>
        );
      })}
    </div>
  );
}