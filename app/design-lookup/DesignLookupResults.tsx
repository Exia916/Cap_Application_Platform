"use client";

import { useEffect, useMemo, useState } from "react";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";
import type { WilcomDesign } from "./types";
import DesignPreviewImage from "./DesignPreviewImage";

type Props = {
  rows: WilcomDesign[];
  loading: boolean;
  error: string | null;
  hasSearched: boolean;
  onView: (design: WilcomDesign) => void;
};

type SortKey =
  | "name"
  | "description"
  | "customer"
  | "stitches"
  | "colors"
  | "size"
  | "status"
  | "dateModified"
  | "fileExtension";

const MM_PER_INCH = 25.4;

function fmtNumber(value?: number | null) {
  if (value === null || value === undefined) return "";
  return Number(value).toLocaleString();
}

function fmtDate(value?: string | null) {
  if (!value) return "";
  if (String(value).startsWith("1899-12-30")) return "";

  const d = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return String(value);

  return d.toLocaleDateString();
}

function fmtSizeInches(row: WilcomDesign) {
  if (row.width == null && row.height == null) return "";

  const widthMm = Number(row.width);
  const heightMm = Number(row.height);

  const width =
    Number.isFinite(widthMm) && row.width != null
      ? (widthMm / MM_PER_INCH).toFixed(2)
      : "—";

  const height =
    Number.isFinite(heightMm) && row.height != null
      ? (heightMm / MM_PER_INCH).toFixed(2)
      : "—";

  return `${width} × ${height} in`;
}

function toInches(value?: number | null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n / MM_PER_INCH;
}

function stringValue(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function dateValue(value: unknown) {
  if (!value) return 0;
  const d = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function getSortValue(row: WilcomDesign, key: string): string | number {
  switch (key as SortKey) {
    case "name":
      return stringValue(row.name);
    case "description":
      return stringValue(row.description);
    case "customer":
      return stringValue(row.customer);
    case "stitches":
      return numberValue(row.stitches);
    case "colors":
      return numberValue(row.colors);
    case "size":
      return numberValue(row.width) * numberValue(row.height);
    case "status":
      return stringValue(row.status);
    case "dateModified":
      return dateValue(row.dateModified);
    case "fileExtension":
      return stringValue(row.fileExtension);
    default:
      return stringValue(row.name);
  }
}

export default function DesignLookupResults({
  rows,
  loading,
  error,
  hasSearched,
  onView,
}: Props) {
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setPageIndex(0);
  }, [rows.length, sortBy, sortDir, pageSize]);

  function onToggleSort(key: string) {
    const next = key as SortKey;

    if (sortBy !== next) {
      setSortBy(next);
      setSortDir("asc");
      return;
    }

    setSortDir((current) => (current === "asc" ? "desc" : "asc"));
  }

  const sortedRows = useMemo(() => {
    const copy = [...rows];

    copy.sort((a, b) => {
      const av = getSortValue(a, sortBy);
      const bv = getSortValue(b, sortBy);

      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }

      const result = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? result : -result;
    });

    return copy;
  }, [rows, sortBy, sortDir]);

  const pagedRows = useMemo(() => {
    const start = pageIndex * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, pageIndex, pageSize]);

  const columns = useMemo<Column<WilcomDesign>[]>(
    () => [
      {
        key: "preview",
        header: "Preview",
        width: 130,
        sortable: false,
        getSearchText: () => "",
        render: (row) => (
          <DesignPreviewImage
            src={row.thumbnail || row.trueView}
            alt={`Preview for ${row.name}`}
            mode="thumb"
          />
        ),
      },
      {
        key: "name",
        header: "Design",
        sortable: true,
        width: 130,
        getSearchText: (row) => row.name || "",
        render: (row) => <strong>{row.name}</strong>,
      },
      {
        key: "description",
        header: "Description",
        sortable: true,
        width: 260,
        getSearchText: (row) => row.description || "",
        render: (row) => row.description || "",
      },
      {
        key: "customer",
        header: "Customer",
        sortable: true,
        width: 220,
        getSearchText: (row) => row.customer || "",
        render: (row) => row.customer || "",
      },
      {
        key: "stitches",
        header: "Stitches",
        sortable: true,
        width: 110,
        render: (row) => fmtNumber(row.stitches),
      },
      {
        key: "colors",
        header: "Colors",
        sortable: true,
        width: 90,
        render: (row) => fmtNumber(row.colors),
      },
      {
        key: "size",
        header: "Size",
        sortable: true,
        width: 150,
        render: (row) => fmtSizeInches(row),
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        width: 140,
        getSearchText: (row) => row.status || "",
        render: (row) => (
          <span className="badge badge-neutral">{row.status || "Unspecified"}</span>
        ),
      },
      {
        key: "dateModified",
        header: "Modified",
        sortable: true,
        width: 120,
        render: (row) => fmtDate(row.dateModified),
      },
      {
        key: "fileExtension",
        header: "Type",
        sortable: true,
        width: 90,
        getSearchText: (row) => row.fileExtension || row.version || "",
        render: (row) => row.fileExtension || row.version || "",
      },
      {
        key: "view",
        header: "",
        width: 90,
        sortable: false,
        render: (row) => (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onView(row);
            }}
          >
            View
          </button>
        ),
      },
    ],
    [onView]
  );

  return (
    <DataTable
      columns={columns}
      rows={pagedRows}
      loading={loading}
      error={error}
      sortBy={sortBy}
      sortDir={sortDir}
      onToggleSort={onToggleSort}
      filters={{}}
      onFilterChange={() => {}}
      totalCount={sortedRows.length}
      pageIndex={pageIndex}
      pageSize={pageSize}
      pageSizes={[10, 25, 50]}
      onPageIndexChange={setPageIndex}
      onPageSizeChange={setPageSize}
      rowKey={(row) => String(row.id)}
      emptyText={
        hasSearched
          ? "No Wilcom designs found for this search."
          : "Enter a design search above, then search."
      }
      enableGlobalSearch
      globalSearchPlaceholder="Filter current results…"
      enableCsvExport
      csvFilename="wilcom_design_lookup.csv"
      rowToCsv={(row) => ({
        Design: row.name,
        Description: row.description,
        Customer: row.customer,
        Category: row.category,
        Status: row.status,
        Digitizer: row.digitizer,
        Style: row.style,
        Stitches: row.stitches,
        Colors: row.colors,
        WidthIn: toInches(row.width)?.toFixed(2) ?? "",
        HeightIn: toInches(row.height)?.toFixed(2) ?? "",
        WidthMm: row.width,
        HeightMm: row.height,
        Modified: row.dateModified,
        FileType: row.fileExtension,
      })}
      rowClickable
      onRowDoubleClick={onView}
    />
  );
}