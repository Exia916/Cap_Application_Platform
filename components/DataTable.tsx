"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export type SortDir = "asc" | "desc";

export type Column<T> = {
  key: string;
  header: string;
  sortable?: boolean;

  /**
   * If true (default), clicking sortable header calls onToggleSort (server sort).
   * If false, header is shown as sortable-looking but does not call server sorting.
   */
  serverSortable?: boolean;

  filterable?: boolean;
  placeholder?: string;
  filterRender?: React.ReactNode;
  width?: number | string;

  /**
   * Optional text extractor used by global search.
   */
  getSearchText?: (row: T) => string;

  render: (row: T) => React.ReactNode;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];

  loading?: boolean;
  error?: string | null;

  sortBy: string;
  sortDir: SortDir;
  onToggleSort: (key: string) => void;

  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;

  totalCount: number;
  pageIndex: number;
  pageSize: number;
  pageSizes?: number[];
  onPageIndexChange: (next: number) => void;
  onPageSizeChange: (next: number) => void;

  toolbar?: React.ReactNode;

  rowKey: (row: T) => string;
  emptyText?: string;

  enableGlobalSearch?: boolean;
  globalSearchPlaceholder?: string;

  enableCsvExport?: boolean;
  csvFilename?: string;
  rowToCsv?: (row: T) => Record<string, string | number | null | undefined>;

  renderExpandedRow?: (row: T) => React.ReactNode;

  /**
   * Optional row class hook for conditional highlighting/styling.
   */
  rowClassName?: (row: T) => string | undefined;

  /**
   * Optional row click support.
   * This is opt-in so existing pages do not change behavior.
   */
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  rowClickable?: boolean;
};

function defaultFilename() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `export_${yyyy}-${mm}-${dd}.csv`;
}

function toPlainText(node: React.ReactNode): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
    return String(node);
  }

  if (Array.isArray(node)) return node.map(toPlainText).join(" ");

  if (React.isValidElement(node)) {
    const children = (node as any).props?.children;
    return toPlainText(children);
  }

  return "";
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  const needsWrap = /[",\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsWrap ? `"${escaped}"` : escaped;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const lines: string[] = [];
  lines.push(headers.map(csvEscape).join(","));
  for (const r of rows) lines.push(r.map(csvEscape).join(","));

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename || defaultFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

/**
 * Compatibility export:
 * Keep this temporarily so pages importing { btnSecondary } do not break.
 * Remove later after pages are migrated to className="btn btn-secondary".
 */
export const btnSecondary: React.CSSProperties = {
  padding: "8px 14px",
  border: "1px solid var(--btn-secondary-border, #cfc6b6)",
  borderRadius: 10,
  background: "var(--btn-secondary-bg, #ffffff)",
  color: "var(--btn-secondary-text, #111111)",
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontWeight: 700,
  fontSize: 13,
  lineHeight: 1,
};

export default function DataTable<T>({
  columns,
  rows,
  loading = false,
  error = null,

  sortBy,
  sortDir,
  onToggleSort,

  filters,
  onFilterChange,

  totalCount,
  pageIndex,
  pageSize,
  pageSizes = [10, 25, 50, 100],
  onPageIndexChange,
  onPageSizeChange,

  toolbar,

  rowKey,
  emptyText = "No results found.",

  enableGlobalSearch = true,
  globalSearchPlaceholder = "Search current view…",

  enableCsvExport = true,
  csvFilename,
  rowToCsv,

  renderExpandedRow,
  rowClassName,

  onRowClick,
  onRowDoubleClick,
  rowClickable = false,
}: Props<T>) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const offset = pageIndex * pageSize;

  const showingFrom = totalCount === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + rows.length, totalCount);

  const [globalSearch, setGlobalSearch] = useState("");
  const [topSpacerWidth, setTopSpacerWidth] = useState(1);

  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const syncLockRef = useRef<"top" | "bottom" | null>(null);
  const rafRef = useRef<number | null>(null);

  const searchableColumns = useMemo(() => {
    return columns.filter((c) => c.key !== "edit");
  }, [columns]);

  const filteredRows = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!enableGlobalSearch || !q) return rows;

    return rows.filter((row) => {
      const haystack = searchableColumns
        .map((c) => {
          if (c.getSearchText) return c.getSearchText(row) ?? "";
          return toPlainText(c.render(row));
        })
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, globalSearch, enableGlobalSearch, searchableColumns]);

  function sortIndicator(key: string) {
    if (sortBy !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  function handleHeaderClick(c: Column<T>) {
    if (!c.sortable) return;
    if (c.serverSortable === false) return;
    onToggleSort(c.key);
  }

  function onExportCsv() {
    const filename = (csvFilename && csvFilename.trim()) || defaultFilename();

    if (rowToCsv) {
      const mapped = filteredRows.map((r) => rowToCsv(r) || {});
      const headerSet = new Set<string>();

      for (const m of mapped) {
        Object.keys(m).forEach((k) => headerSet.add(k));
      }

      const headers = Array.from(headerSet);
      const outRows = mapped.map((m) => headers.map((h) => (m as any)[h]));
      downloadCsv(filename, headers, outRows as string[][]);
      return;
    }

    const exportCols = columns.filter((c) => c.key !== "edit");
    const headers = exportCols.map((c) => c.header);

    const outRows = filteredRows.map((r) =>
      exportCols.map((c) => {
        if (c.getSearchText) return c.getSearchText(r);
        return toPlainText(c.render(r));
      })
    );

    downloadCsv(filename, headers, outRows);
  }

  function updateTopScrollbar() {
    const top = topScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (!top || !bottom) return;

    const width = Math.max(bottom.scrollWidth, bottom.clientWidth, 1);
    setTopSpacerWidth(width);

    if (syncLockRef.current !== "top") {
      top.scrollLeft = bottom.scrollLeft;
    }
  }

  useLayoutEffect(() => {
    updateTopScrollbar();
  }, [columns, rows, filteredRows.length, loading, pageIndex, pageSize]);

  useEffect(() => {
    const bottom = bottomScrollRef.current;
    if (!bottom) return;

    const run = () => updateTopScrollbar();

    run();

    const timeout1 = window.setTimeout(run, 0);
    const timeout2 = window.setTimeout(run, 50);
    const timeout3 = window.setTimeout(run, 150);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        run();
      });
      ro.observe(bottom);
      if (bottom.firstElementChild instanceof HTMLElement) {
        ro.observe(bottom.firstElementChild);
      }
    }

    window.addEventListener("resize", run);

    return () => {
      window.clearTimeout(timeout1);
      window.clearTimeout(timeout2);
      window.clearTimeout(timeout3);
      window.removeEventListener("resize", run);
      if (ro) ro.disconnect();
    };
  }, [columns, rows]);

  useEffect(() => {
    const top = topScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (!top || !bottom) return;

    const clearLock = () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        syncLockRef.current = null;
      });
    };

    const onTopScroll = () => {
      if (syncLockRef.current === "bottom") return;
      syncLockRef.current = "top";
      bottom.scrollLeft = top.scrollLeft;
      clearLock();
    };

    const onBottomScroll = () => {
      if (syncLockRef.current === "top") return;
      syncLockRef.current = "bottom";
      top.scrollLeft = bottom.scrollLeft;
      clearLock();
    };

    top.addEventListener("scroll", onTopScroll, { passive: true });
    bottom.addEventListener("scroll", onBottomScroll, { passive: true });

    return () => {
      top.removeEventListener("scroll", onTopScroll);
      bottom.removeEventListener("scroll", onBottomScroll);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div className="section-stack" style={{ marginTop: 16 }}>
      <style>{`
        .dt-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .dt-toolbar-left,
        .dt-toolbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .dt-search {
          width: 240px;
        }

        .dt-page-size-wrap {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 600;
        }

        .dt-count {
          font-size: 12px;
          color: var(--text-muted);
        }

        .dt-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          box-shadow: var(--shadow-sm);
          overflow: visible;
          position: relative;
        }

        .dt-top-scroll-wrap {
          overflow-x: auto;
          overflow-y: hidden;
          position: sticky;
          top: var(--app-sticky-offset, 56px);
          z-index: 8;
          height: 24px;
          min-height: 24px;
          max-height: 24px;
          border-top-left-radius: 14px;
          border-top-right-radius: 14px;
          border-bottom: 1px solid var(--border);
          background: var(--surface-muted);
          scrollbar-width: auto;
          scrollbar-color: var(--border-table-strong) var(--surface-subtle);
        }

        .dt-top-scroll-wrap::-webkit-scrollbar {
          height: 16px;
        }

        .dt-top-scroll-wrap::-webkit-scrollbar-track {
          background: var(--surface-subtle);
          border-radius: 999px;
        }

        .dt-top-scroll-wrap::-webkit-scrollbar-thumb {
          background: var(--border-table-strong);
          border-radius: 999px;
          border: 2px solid var(--surface-subtle);
        }

        .dt-top-scroll-wrap::-webkit-scrollbar-thumb:hover {
          background: var(--brand-blue);
        }

        .dt-top-scroll-spacer {
          height: 1px;
        }

        .dt-frame {
          overflow: hidden;
          border-radius: 14px;
        }

        .dt-table-wrap {
          overflow-x: auto;
        }

        .dt-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          table-layout: auto;
          background: var(--surface);
        }

        .dt-table thead tr:first-child th {
          background: var(--surface-muted);
          color: var(--text);
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }

        .dt-table thead tr:nth-child(2) th {
          background: var(--surface-subtle);
          border-bottom: 1px solid var(--border);
        }

        .dt-th,
        .dt-th-btn,
        .dt-th-filter,
        .dt-td {
          padding: 12px 14px;
          vertical-align: middle;
        }

        .dt-th-btn {
          cursor: pointer;
          user-select: none;
          transition: background 120ms ease, color 120ms ease;
        }

        .dt-th-btn:hover {
          background: color-mix(in srgb, var(--surface-muted) 82%, var(--brand-blue) 18%);
        }

        .dt-th-filter {
          padding-top: 8px;
          padding-bottom: 8px;
        }

        .dt-filter-muted {
          font-size: 12px;
          color: var(--text-soft);
        }

        .dt-filter-input {
          width: 100%;
          min-width: 0;
          font-size: 12px;
          padding: 8px 10px;
        }

        .dt-row > td {
          border-bottom: 1px solid var(--border);
          color: var(--text-muted);
          vertical-align: top;
        }

        .dt-row:last-of-type > td {
          border-bottom: 1px solid var(--border);
        }

        .dt-row:hover > td {
          background: rgba(34, 68, 139, 0.035);
        }

        .dt-row-clickable > td {
          cursor: pointer;
        }

        .dt-error {
          color: var(--brand-red);
          font-weight: 700;
        }

        .dt-expanded-cell {
          padding: 0;
          border: 0;
        }

        @media (max-width: 900px) {
          .dt-toolbar {
            align-items: stretch;
          }

          .dt-toolbar-left,
          .dt-toolbar-right {
            width: 100%;
          }

          .dt-search {
            width: 100%;
          }
        }
      `}</style>

      <div className="dt-toolbar">
        <div className="dt-toolbar-left">
          {toolbar}

          {enableGlobalSearch ? (
            <input
              className="input dt-search"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder={globalSearchPlaceholder}
              disabled={loading}
            />
          ) : null}

          {enableCsvExport ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onExportCsv}
              disabled={loading || filteredRows.length === 0}
            >
              Export CSV
            </button>
          ) : null}

          {enableGlobalSearch && globalSearch.trim() ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setGlobalSearch("")}
              disabled={loading}
              title="Clear search"
            >
              Clear Search
            </button>
          ) : null}
        </div>

        <div className="dt-toolbar-right">
          <div className="dt-count">
            {loading ? (
              <>Loading…</>
            ) : enableGlobalSearch && globalSearch.trim() ? (
              <>
                Showing {filteredRows.length} of {rows.length} (filtered) • {showingFrom}–{showingTo} of{" "}
                {totalCount}
              </>
            ) : (
              <>Showing {showingFrom}–{showingTo} of {totalCount}</>
            )}
          </div>

          <label className="dt-page-size-wrap">
            <span>Page Size:</span>
            <select
              className="select"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              disabled={loading}
            >
              {pageSizes.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onPageIndexChange(Math.max(0, pageIndex - 1))}
            disabled={loading || pageIndex <= 0}
          >
            Prev
          </button>

          <div className="dt-count">
            Page {pageIndex + 1} / {totalPages}
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onPageIndexChange(Math.min(totalPages - 1, pageIndex + 1))}
            disabled={loading || pageIndex >= totalPages - 1}
          >
            Next
          </button>
        </div>
      </div>

      <div className="dt-card">
        <div ref={topScrollRef} className="dt-top-scroll-wrap">
          <div className="dt-top-scroll-spacer" style={{ width: topSpacerWidth }} />
        </div>

        <div className="dt-frame">
          <div className="dt-table-wrap" ref={bottomScrollRef}>
            <table className="dt-table table-clean">
              <thead>
                <tr>
                  {columns.map((c) => {
                    const isClickable = !!c.sortable && c.serverSortable !== false;

                    return (
                      <th
                        key={c.key}
                        className={isClickable ? "dt-th-btn" : "dt-th"}
                        style={{
                          width: c.width,
                          opacity: c.sortable && c.serverSortable === false ? 0.65 : 1,
                        }}
                        onClick={isClickable ? () => handleHeaderClick(c) : undefined}
                        role={isClickable ? "button" : undefined}
                        title={
                          c.sortable
                            ? c.serverSortable === false
                              ? "Sorting disabled for this column"
                              : "Sort"
                            : undefined
                        }
                      >
                        {c.header}
                        {c.sortable ? sortIndicator(c.key) : null}
                      </th>
                    );
                  })}
                </tr>

                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className="dt-th-filter">
                      {c.filterRender ? (
                        c.filterRender
                      ) : c.filterable ? (
                        <input
                          className="input dt-filter-input"
                          placeholder={c.placeholder ?? c.header}
                          value={filters[c.key] ?? ""}
                          onChange={(e) => onFilterChange(c.key, e.target.value)}
                        />
                      ) : (
                        <span className="dt-filter-muted">—</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {error ? (
                  <tr className="dt-row">
                    <td className="dt-td" colSpan={columns.length}>
                      <span className="dt-error">{error}</span>
                    </td>
                  </tr>
                ) : loading ? (
                  <tr className="dt-row">
                    <td className="dt-td" colSpan={columns.length}>
                      Loading…
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr className="dt-row">
                    <td className="dt-td" colSpan={columns.length}>
                      {emptyText}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => {
                    const extraRowClass = rowClassName?.(r)?.trim();
                    const combinedRowClass = [
                      "dt-row",
                      rowClickable && (onRowClick || onRowDoubleClick) ? "dt-row-clickable" : "",
                      extraRowClass ?? "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <React.Fragment key={rowKey(r)}>
                        <tr
                          className={combinedRowClass}
                          onClick={onRowClick ? () => onRowClick(r) : undefined}
                          onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(r) : undefined}
                        >
                          {columns.map((c) => (
                            <td key={c.key} className="dt-td">
                              {c.render(r)}
                            </td>
                          ))}
                        </tr>

                        {renderExpandedRow ? (
                          <tr>
                            <td colSpan={columns.length} className="dt-expanded-cell">
                              {renderExpandedRow(r)}
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}