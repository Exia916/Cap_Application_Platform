// app/quick-turn-quote-calculator/saved/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";
import type { SavedQuickTurnQuoteSummary } from "../types";
import { fmtDateOnly, fmtDateTime } from "../format";

type Filters = {
  q: string;
  includeVoided: string;
};

const DEFAULT_FILTERS: Filters = {
  q: "",
  includeVoided: "",
};

function statusBadge(row: SavedQuickTurnQuoteSummary) {
  if (row.isVoided) {
    return <span className="badge badge-danger">Voided</span>;
  }

  const today = new Date().toISOString().slice(0, 10);
  if (row.validUntil && row.validUntil < today) {
    return <span className="badge badge-warning">Expired</span>;
  }

  return <span className="badge badge-success">Active</span>;
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

    if (debouncedFilters.q.trim()) sp.set("q", debouncedFilters.q.trim());
    if (debouncedFilters.includeVoided === "true") sp.set("includeVoided", "true");

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
        header: "Quote #",
        sortable: true,
        render: (row) => row.quoteNumber,
        getSearchText: (row) => row.quoteNumber,
      },
      {
        key: "quoteName",
        header: "Quote Name",
        sortable: true,
        filterRender: (
          <input
            className="input"
            value={filters.q}
            onChange={(e) => onFilterChange("q", e.target.value)}
            placeholder="Quote #, name, program, factory, creator"
          />
        ),
        render: (row) => row.quoteName,
        getSearchText: (row) => row.quoteName,
      },
      {
        key: "status",
        header: "Status",
        filterRender: (
          <select
            className="select"
            value={filters.includeVoided}
            onChange={(e) => onFilterChange("includeVoided", e.target.value)}
          >
            <option value="">Active Only</option>
            <option value="true">Include Voided</option>
          </select>
        ),
        render: (row) => statusBadge(row),
        getSearchText: (row) => (row.isVoided ? "Voided" : "Active"),
      },
      {
        key: "programName",
        header: "Program",
        sortable: true,
        render: (row) => row.programName,
        getSearchText: (row) => row.programName,
      },
      {
        key: "factoryName",
        header: "Factory",
        sortable: true,
        render: (row) => row.factoryName,
        getSearchText: (row) => row.factoryName,
      },
      {
        key: "generatedAt",
        header: "Generated",
        sortable: true,
        render: (row) => fmtDateTime(row.generatedAt),
        getSearchText: (row) => fmtDateTime(row.generatedAt),
      },
      {
        key: "validUntil",
        header: "Valid Through",
        sortable: true,
        render: (row) => fmtDateOnly(row.validUntil),
        getSearchText: (row) => fmtDateOnly(row.validUntil),
      },
      {
        key: "itemCount",
        header: "Items",
        render: (row) => row.itemCount,
        getSearchText: (row) => String(row.itemCount ?? 0),
      },
      {
        key: "createdBy",
        header: "Created By",
        sortable: true,
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
    [filters.includeVoided]
  );

  return (
    <main className="page-shell-wide">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Saved Quick Turn Quotes</h1>
          <p className="page-subtitle">Review saved quote snapshots and print quote output.</p>
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
          "Quote #": row.quoteNumber,
          "Quote Name": row.quoteName,
          Status: row.isVoided ? "Voided" : "Active",
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
