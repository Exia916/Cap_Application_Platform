"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getReportDatePresetRange,
  REPORT_DATE_PRESETS,
  type ReportDatePresetKey,
} from "@/lib/reports/reportDatePresets";
import type { ReportFilterLogic } from "@/lib/reports/reportTypes";

type DatasetColumn = {
  key: string;
  label: string;
  type: string;
  filterable: boolean;
};

type FilterValue = {
  operator: string;
  value?: string | number | boolean | null;
  values?: Array<string | number | boolean>;
  from?: string | number | null;
  to?: string | number | null;
};

type Props = {
  datasetKey: string;
  columns: DatasetColumn[];
  simpleFilterKeys?: string[];

  filterLogic: ReportFilterLogic;
  onFilterLogicChange: (value: ReportFilterLogic) => void;

  dateColumn: string;
  onDateColumnChange: (value: string) => void;

  datePreset: ReportDatePresetKey;
  onDatePresetChange: (value: ReportDatePresetKey) => void;

  dateFrom: string;
  onDateFromChange: (value: string) => void;

  dateTo: string;
  onDateToChange: (value: string) => void;

  fieldFilters: Record<string, FilterValue>;
  onFieldFiltersChange: (next: Record<string, FilterValue>) => void;
};

const DROPDOWN_COLUMN_HINTS = [
  "department",
  "shift",
  "source_module",
  "module",
  "status",
  "status_label",
  "status_code",
  "recut_status",
  "operator",
  "operator_name",
  "requested_department",
  "requested_by_name",
  "reject_reason",
  "quality_area",
  "machine",
  "machine_or_area",
  "priority",
  "tech",
  "asset",
  "common_issue",
  "work_order_type",
  "activity_type",
  "customer_name",
  "designer_name",
  "digitizer_name",
  "created_by_name",
];

function shouldUseDropdown(column: DatasetColumn | undefined) {
  if (!column) return false;
  if (column.type === "boolean") return true;
  if (column.type !== "text") return false;

  return DROPDOWN_COLUMN_HINTS.some((hint) => column.key.includes(hint));
}

function filterValueLabel(filter: FilterValue) {
  if (filter.operator === "contains") return `contains "${filter.value ?? ""}"`;
  if (filter.operator === "startsWith") return `starts with "${filter.value ?? ""}"`;
  if (filter.operator === "equals") return `= ${filter.value ?? ""}`;
  if (filter.operator === "isTrue") return "Yes";
  if (filter.operator === "isFalse") return "No";
  if (filter.operator === "in") return `in ${(filter.values ?? []).join(", ")}`;
  return String(filter.value ?? "");
}

export default function ReportFilterBuilder({
  datasetKey,
  columns,
  simpleFilterKeys,
  filterLogic,
  onFilterLogicChange,
  dateColumn,
  onDateColumnChange,
  datePreset,
  onDatePresetChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  fieldFilters,
  onFieldFiltersChange,
}: Props) {
  const [newFilterColumn, setNewFilterColumn] = useState("");
  const [newFilterOperator, setNewFilterOperator] = useState("equals");
  const [newFilterValue, setNewFilterValue] = useState("");

  const [optionValues, setOptionValues] = useState<string[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const dateColumns = useMemo(
    () =>
      columns.filter(
        (column) =>
          column.filterable && (column.type === "date" || column.type === "datetime")
      ),
    [columns]
  );

  const availableFieldColumns = useMemo(() => {
    const allowed = simpleFilterKeys?.length ? new Set(simpleFilterKeys) : null;

    return columns.filter((column) => {
      if (!column.filterable) return false;
      if (column.type === "date" || column.type === "datetime") return false;
      if (allowed && !allowed.has(column.key)) return false;
      return true;
    });
  }, [columns, simpleFilterKeys]);

  const selectedNewFilterColumn = columns.find((column) => column.key === newFilterColumn);
  const useDropdown = shouldUseDropdown(selectedNewFilterColumn);

  const activeFilterRows = Object.entries(fieldFilters)
    .map(([key, filter]) => ({
      key,
      filter,
      column: columns.find((column) => column.key === key),
    }))
    .filter((row) => row.column);

  useEffect(() => {
    let ignore = false;

    async function loadOptions() {
      setOptionValues([]);
      setOptionsError(null);

      if (!datasetKey || !selectedNewFilterColumn || !useDropdown) {
        return;
      }

      if (selectedNewFilterColumn.type === "boolean") {
        setOptionValues(["Yes", "No"]);
        return;
      }

      try {
        setOptionsLoading(true);

        const res = await fetch(
          `/api/reports/filter-options?datasetKey=${encodeURIComponent(
            datasetKey
          )}&columnKey=${encodeURIComponent(selectedNewFilterColumn.key)}`,
          {
            credentials: "include",
            cache: "no-store",
          }
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load filter options.");
        }

        if (!ignore) {
          setOptionValues(Array.isArray(data.values) ? data.values : []);
        }
      } catch (err: any) {
        if (!ignore) {
          setOptionsError(err?.message || "Failed to load filter options.");
        }
      } finally {
        if (!ignore) {
          setOptionsLoading(false);
        }
      }
    }

    loadOptions();

    return () => {
      ignore = true;
    };
  }, [datasetKey, selectedNewFilterColumn?.key, selectedNewFilterColumn?.type, useDropdown]);

  useEffect(() => {
    const column = selectedNewFilterColumn;

    if (!column) {
      setNewFilterOperator("equals");
      setNewFilterValue("");
      return;
    }

    if (column.type === "boolean") {
      setNewFilterOperator("equals");
      setNewFilterValue("Yes");
      return;
    }

    if (shouldUseDropdown(column)) {
      setNewFilterOperator("equals");
      setNewFilterValue("");
      return;
    }

    if (column.type === "number") {
      setNewFilterOperator("equals");
      setNewFilterValue("");
      return;
    }

    setNewFilterOperator("contains");
    setNewFilterValue("");
  }, [newFilterColumn]);

  function handlePresetChange(next: ReportDatePresetKey) {
    onDatePresetChange(next);

    const range = getReportDatePresetRange(next);
    if (range) {
      onDateFromChange(range.from);
      onDateToChange(range.to);
    }
  }

  function addFilter() {
    if (!newFilterColumn) return;

    const column = columns.find((c) => c.key === newFilterColumn);
    if (!column) return;

    const value = newFilterValue.trim();
    const next = { ...fieldFilters };

    if (column.type === "boolean") {
      next[column.key] = {
        operator: value === "No" || value === "false" ? "isFalse" : "isTrue",
      };
    } else if (column.type === "number") {
      if (!value) return;
      next[column.key] = {
        operator: "equals",
        value: Number(value),
      };
    } else {
      if (!value) return;

      next[column.key] = {
        operator: newFilterOperator,
        value,
      };
    }

    onFieldFiltersChange(next);
    setNewFilterValue("");
  }

  function removeFilter(key: string) {
    const next = { ...fieldFilters };
    delete next[key];
    onFieldFiltersChange(next);
  }

  return (
    <div className="report-filter-builder">
      <style>{`
        .report-filter-builder {
          display: grid;
          gap: 14px;
        }

        .report-filter-chip-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .report-filter-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 28px;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface-muted);
          color: var(--text);
          font-size: 12px;
          font-weight: 700;
        }

        .report-filter-chip button {
          appearance: none;
          border: 0;
          background: transparent;
          color: var(--brand-red);
          cursor: pointer;
          font-weight: 900;
          padding: 0;
          line-height: 1;
        }

        .report-filter-add-row {
          display: grid;
          grid-template-columns: minmax(180px, 1fr) minmax(150px, 180px) minmax(180px, 1fr) auto;
          gap: 8px;
          align-items: end;
        }

        @media (max-width: 1100px) {
          .report-filter-add-row {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 700px) {
          .report-filter-add-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="form-grid">
        <div>
          <label className="field-label">Filter Logic</label>
          <select
            className="select"
            value={filterLogic}
            onChange={(e) => onFilterLogicChange(e.target.value === "OR" ? "OR" : "AND")}
          >
            <option value="AND">Match All Filters</option>
            <option value="OR">Match Any Filter</option>
          </select>
          <div className="field-help">
            Match All uses AND. Match Any uses OR across active filters.
          </div>
        </div>

        <div>
          <label className="field-label">Date Column</label>
          <select
            className="select"
            value={dateColumn}
            onChange={(e) => onDateColumnChange(e.target.value)}
          >
            <option value="">None</option>
            {dateColumns.map((column) => (
              <option key={column.key} value={column.key}>
                {column.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">Date Range</label>
          <select
            className="select"
            value={datePreset}
            onChange={(e) => handlePresetChange(e.target.value as ReportDatePresetKey)}
          >
            {REPORT_DATE_PRESETS.map((preset) => (
              <option key={preset.key} value={preset.key}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">From</label>
          <input
            className="input"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              onDatePresetChange("custom");
              onDateFromChange(e.target.value);
            }}
          />
        </div>

        <div>
          <label className="field-label">To</label>
          <input
            className="input"
            type="date"
            value={dateTo}
            onChange={(e) => {
              onDatePresetChange("custom");
              onDateToChange(e.target.value);
            }}
          />
        </div>
      </div>

      <div className="report-filter-add-row">
        <div>
          <label className="field-label">Add Filter</label>
          <select
            className="select"
            value={newFilterColumn}
            onChange={(e) => setNewFilterColumn(e.target.value)}
          >
            <option value="">Select filter field</option>
            {availableFieldColumns.map((column) => (
              <option key={column.key} value={column.key}>
                {column.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">Match</label>
          <select
            className="select"
            value={newFilterOperator}
            disabled={selectedNewFilterColumn?.type === "boolean"}
            onChange={(e) => setNewFilterOperator(e.target.value)}
          >
            <option value="equals">Equals</option>
            <option value="contains">Contains</option>
            <option value="startsWith">Starts With</option>
          </select>
        </div>

        <div>
          <label className="field-label">Value</label>

          {selectedNewFilterColumn?.type === "boolean" ? (
            <select
              className="select"
              value={newFilterValue || "Yes"}
              onChange={(e) => setNewFilterValue(e.target.value)}
            >
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          ) : useDropdown && newFilterOperator === "equals" ? (
            <select
              className="select"
              value={newFilterValue}
              onChange={(e) => setNewFilterValue(e.target.value)}
              disabled={optionsLoading}
            >
              <option value="">
                {optionsLoading ? "Loading options..." : "Select value"}
              </option>
              {optionValues.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              value={newFilterValue}
              onChange={(e) => setNewFilterValue(e.target.value)}
              placeholder={
                selectedNewFilterColumn?.type === "number"
                  ? "Enter number"
                  : "Enter text..."
              }
            />
          )}

          {optionsError ? <div className="field-error">{optionsError}</div> : null}
        </div>

        <button type="button" className="btn btn-secondary" onClick={addFilter}>
          Add Filter
        </button>
      </div>

      <div className="report-filter-chip-row">
        {dateColumn && (dateFrom || dateTo) ? (
          <span className="report-filter-chip">
            {columns.find((column) => column.key === dateColumn)?.label || dateColumn}:{" "}
            {dateFrom || "Any"} to {dateTo || "Any"}
            <button
              type="button"
              onClick={() => {
                onDateFromChange("");
                onDateToChange("");
                onDatePresetChange("custom");
              }}
              aria-label="Remove date filter"
            >
              ×
            </button>
          </span>
        ) : null}

        {activeFilterRows.map((row) => (
          <span key={row.key} className="report-filter-chip">
            {row.column?.label}: {filterValueLabel(row.filter)}
            <button
              type="button"
              onClick={() => removeFilter(row.key)}
              aria-label={`Remove ${row.column?.label} filter`}
            >
              ×
            </button>
          </span>
        ))}

        {!dateFrom && !dateTo && activeFilterRows.length === 0 ? (
          <span className="text-soft" style={{ fontSize: 12 }}>
            No filters applied.
          </span>
        ) : null}
      </div>
    </div>
  );
}