// app/quick-turn-quote-calculator/saved/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";
import type { SavedQuickTurnQuoteSummary } from "../types";
import { fmtDateOnly, fmtDateTime } from "../format";

type Filters = {
  quoteNumber: string;
  quoteName: string;
  quoteStatus: string;
  includeVoided: string;
  workflowSalesOrderNumber: string;
  revision: string;
  preparedForCustomer: string;
  overseasCustomerService: string;
  programName: string;
  factoryName: string;
  generatedFrom: string;
  generatedTo: string;
  validUntilFrom: string;
  validUntilTo: string;
  itemCount: string;
  createdBy: string;
};

const DEFAULT_FILTERS: Filters = {
  quoteNumber: "",
  quoteName: "",
  quoteStatus: "",
  includeVoided: "",
  workflowSalesOrderNumber: "",
  revision: "",
  preparedForCustomer: "",
  overseasCustomerService: "",
  programName: "",
  factoryName: "",
  generatedFrom: "",
  generatedTo: "",
  validUntilFrom: "",
  validUntilTo: "",
  itemCount: "",
  createdBy: "",
};

function statusBadge(row: SavedQuickTurnQuoteSummary) {
  if (row.isVoided) {
    return <span className="badge badge-danger">Voided</span>;
  }

  if (row.quoteStatus === "DRAFT") {
    return <span className="badge badge-warning">Draft</span>;
  }

  const today = new Date().toISOString().slice(0, 10);
  if (row.validUntil && row.validUntil < today) {
    return <span className="badge badge-warning">Published / Expired</span>;
  }

  return <span className="badge badge-success">Published</span>;
}

function displayDash(value: string | null | undefined) {
  const s = String(value ?? "").trim();
  return s ? s : "—";
}

function customerDisplay(row: SavedQuickTurnQuoteSummary) {
  const main =
    row.quotePreparedForDisplay || row.preparedForCustomerNameSnapshot || row.preparedForCustomerCodeSnapshot || "";
  const code = row.preparedForCustomerCodeSnapshot || "";
  const name = row.preparedForCustomerNameSnapshot || "";
  const meta = code && name && main !== `${code} - ${name}` && main !== name ? `${code} - ${name}` : "";

  if (!main && !meta) return "—";

  return (
    <div style={{ display: "grid", gap: 2 }}>
      <span>{main || meta}</span>
      {meta ? <span style={{ fontSize: 11, opacity: 0.75 }}>{meta}</span> : null}
    </div>
  );
}

function textFilter(value: string, onChange: (value: string) => void, placeholder: string) {
  return (
    <input
      className="input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function dateRangeFilter(args: {
  fromValue: string;
  toValue: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 6, minWidth: 145 }}>
      <input
        className="input"
        type="date"
        value={args.fromValue}
        onChange={(e) => args.onFromChange(e.target.value)}
        aria-label="From date"
      />
      <input
        className="input"
        type="date"
        value={args.toValue}
        onChange={(e) => args.onToChange(e.target.value)}
        aria-label="To date"
      />
    </div>
  );
}

export default function SavedQuickTurnQuotesPage() {
  const router = useRouter();

  const [rows, setRows] = useState<SavedQuickTurnQuoteSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageSize, setPageSize] = useState(25);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const offset = pageIndex * pageSize;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedFilters(filters), 300);
    return () => window.clearTimeout(t);
  }, [filters]);

  useEffect(() => {
    setPageIndex(0);
  }, [debouncedFilters, sortBy, sortDir, pageSize]);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("limit", String(pageSize));
    sp.set("offset", String(offset));
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);

    for (const [key, value] of Object.entries(debouncedFilters)) {
      const trimmed = String(value ?? "").trim();
      if (!trimmed) continue;
      if (key === "includeVoided") {
        if (trimmed === "true") sp.set("includeVoided", "true");
        continue;
      }
      sp.set(key, trimmed);
    }

    return sp.toString();
  }, [debouncedFilters, pageSize, offset, sortBy, sortDir]);

  async function loadRows(qs: string) {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/quick-turn-quote-calculator/quotes?${qs}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load saved Quick Turn quotes.");
      }

      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotalCount(Number.isFinite(data?.total) ? Number(data.total) : 0);
    } catch (err: any) {
      setError(err?.message || "Failed to load saved Quick Turn quotes.");
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows(queryString);
  }, [queryString]);

  function onToggleSort(key: string) {
    if (sortBy !== key) {
      setSortBy(key);
      setSortDir("asc");
      return;
    }

    setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
  }

  function onFilterChange(key: string, value: string) {
    if (key in DEFAULT_FILTERS) {
      setFilters((prev) => ({ ...prev, [key]: value }));
    }
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
    setSortBy("createdAt");
    setSortDir("desc");
    setPageIndex(0);
  }

  const columns: Column<SavedQuickTurnQuoteSummary>[] = useMemo(
    () => [
      {
        key: "quoteNumber",
        header: "CAP Quote #",
        sortable: true,
        filterRender: textFilter(filters.quoteNumber, (value) => onFilterChange("quoteNumber", value), "CAP quote #"),
        render: (row) => row.quoteNumber,
        getSearchText: (row) => row.quoteNumber,
      },
      {
        key: "quoteName",
        header: "Customer Quote # / Quote Name",
        sortable: true,
        filterRender: textFilter(filters.quoteName, (value) => onFilterChange("quoteName", value), "Customer quote # / name"),
        render: (row) => row.quoteName,
        getSearchText: (row) => row.quoteName,
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        filterRender: (
          <div style={{ display: "grid", gap: 6 }}>
            <select
              className="select"
              value={filters.quoteStatus}
              onChange={(e) => onFilterChange("quoteStatus", e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
            <select
              className="select"
              value={filters.includeVoided}
              onChange={(e) => onFilterChange("includeVoided", e.target.value)}
            >
              <option value="">Active Only</option>
              <option value="true">Include Voided</option>
            </select>
          </div>
        ),
        render: (row) => statusBadge(row),
        getSearchText: (row) => (row.isVoided ? "Voided" : row.quoteStatus),
      },
      {
        key: "workflowSalesOrderNumber",
        header: "SO / Ref #",
        sortable: true,
        filterRender: textFilter(filters.workflowSalesOrderNumber, (value) => onFilterChange("workflowSalesOrderNumber", value), "SO / ref"),
        render: (row) => row.workflowSalesOrderNumber || "—",
        getSearchText: (row) => row.workflowSalesOrderNumber || "",
      },
      {
        key: "revisionNumber",
        header: "Revision",
        sortable: true,
        filterRender: textFilter(filters.revision, (value) => onFilterChange("revision", value), "Original or Rev #"),
        render: (row) => (row.revisionNumber ? `Rev ${row.revisionNumber}` : "Original"),
        getSearchText: (row) => (row.revisionNumber ? `Rev ${row.revisionNumber}` : "Original"),
      },
      {
        key: "preparedForCustomer",
        header: "Customer",
        sortable: true,
        filterRender: textFilter(filters.preparedForCustomer, (value) => onFilterChange("preparedForCustomer", value), "Customer/code/display"),
        render: (row) => customerDisplay(row),
        getSearchText: (row) => [row.quotePreparedForDisplay, row.preparedForCustomerCodeSnapshot, row.preparedForCustomerNameSnapshot].filter(Boolean).join(" "),
      },
      {
        key: "overseasCustomerService",
        header: "OS Customer Service",
        sortable: true,
        filterRender: textFilter(filters.overseasCustomerService, (value) => onFilterChange("overseasCustomerService", value), "OS CS"),
        render: (row) => displayDash(row.overseasCustomerServiceNameSnapshot),
        getSearchText: (row) => [row.overseasCustomerServiceNameSnapshot, row.overseasCustomerServiceEmailSnapshot].filter(Boolean).join(" "),
      },
      {
        key: "programName",
        header: "Program",
        sortable: true,
        filterRender: textFilter(filters.programName, (value) => onFilterChange("programName", value), "Program"),
        render: (row) => row.programName,
        getSearchText: (row) => row.programName,
      },
      {
        key: "factoryName",
        header: "Factory",
        sortable: true,
        filterRender: textFilter(filters.factoryName, (value) => onFilterChange("factoryName", value), "Factory"),
        render: (row) => row.factoryName,
        getSearchText: (row) => row.factoryName,
      },
      {
        key: "generatedAt",
        header: "Generated",
        sortable: true,
        filterRender: dateRangeFilter({
          fromValue: filters.generatedFrom,
          toValue: filters.generatedTo,
          onFromChange: (value) => onFilterChange("generatedFrom", value),
          onToChange: (value) => onFilterChange("generatedTo", value),
        }),
        render: (row) => fmtDateTime(row.generatedAt),
        getSearchText: (row) => fmtDateTime(row.generatedAt),
      },
      {
        key: "validUntil",
        header: "Valid Through",
        sortable: true,
        filterRender: dateRangeFilter({
          fromValue: filters.validUntilFrom,
          toValue: filters.validUntilTo,
          onFromChange: (value) => onFilterChange("validUntilFrom", value),
          onToChange: (value) => onFilterChange("validUntilTo", value),
        }),
        render: (row) => fmtDateOnly(row.validUntil),
        getSearchText: (row) => fmtDateOnly(row.validUntil),
      },
      {
        key: "itemCount",
        header: "Items",
        sortable: true,
        filterRender: textFilter(filters.itemCount, (value) => onFilterChange("itemCount", value), "#"),
        render: (row) => row.itemCount,
        getSearchText: (row) => String(row.itemCount ?? 0),
      },
      {
        key: "createdBy",
        header: "Created By",
        sortable: true,
        filterRender: textFilter(filters.createdBy, (value) => onFilterChange("createdBy", value), "Created by"),
        render: (row) => row.createdBy || "—",
        getSearchText: (row) => row.createdBy || "",
      },
      {
        key: "actions",
        header: "Actions",
        render: (row) => (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={`/quick-turn-quote-calculator/saved/${encodeURIComponent(row.id)}`} className="btn btn-secondary btn-sm">
              View
            </Link>
            {row.quoteStatus === "DRAFT" && !row.isVoided ? (
              <Link href={`/quick-turn-quote-calculator?edit=${encodeURIComponent(row.id)}`} className="btn btn-primary btn-sm">
                Edit
              </Link>
            ) : null}
            <Link
              href={`/quick-turn-quote-calculator/saved/${encodeURIComponent(row.id)}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              Print
            </Link>
          </div>
        ),
      },
    ],
    [filters]
  );

  return (
    <main className="page-shell-wide">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Saved Quick Turn Quotes</h1>
          <p className="page-subtitle">Review saved drafts, published quote snapshots, and print quote output.</p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary" onClick={clearFilters}>
            Clear Filters
          </button>
          <Link href="/quick-turn-quote-calculator" className="btn btn-primary">
            New Quote
          </Link>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        sortBy={sortBy}
        sortDir={sortDir}
        onToggleSort={onToggleSort}
        filters={filters}
        onFilterChange={onFilterChange}
        totalCount={totalCount}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageIndexChange={setPageIndex}
        onPageSizeChange={setPageSize}
        rowKey={(row) => row.id}
        emptyText="No saved Quick Turn quotes found."
        enableGlobalSearch
        globalSearchPlaceholder="Search current page…"
        enableCsvExport
        csvFilename="quick_turn_saved_quotes.csv"
        rowToCsv={(row) => ({
          "CAP Quote #": row.quoteNumber,
          "Customer Quote # / Quote Name": row.quoteName,
          Status: row.isVoided ? "Voided" : row.quoteStatus,
          "SO / Ref #": row.workflowSalesOrderNumber || "",
          Revision: row.revisionNumber ? `Rev ${row.revisionNumber}` : "Original",
          Customer: row.quotePreparedForDisplay || row.preparedForCustomerNameSnapshot || "",
          "Customer Code": row.preparedForCustomerCodeSnapshot || "",
          "OS Customer Service": row.overseasCustomerServiceNameSnapshot || "",
          "OS Customer Service Email": row.overseasCustomerServiceEmailSnapshot || "",
          "Source Quote": row.sourceQuoteNumber || "",
          Program: row.programName,
          Factory: row.factoryName,
          Generated: fmtDateTime(row.generatedAt),
          "Valid Through": fmtDateOnly(row.validUntil),
          Items: row.itemCount,
          "Created By": row.createdBy,
          Created: fmtDateTime(row.createdAt),
        })}
        rowClickable
        onRowDoubleClick={(row) => {
          router.push(`/quick-turn-quote-calculator/saved/${encodeURIComponent(row.id)}`);
        }}
      />
    </main>
  );
}
