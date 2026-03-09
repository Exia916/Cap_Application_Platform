"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";

type Row = {
  id: string;
  recutId: number;
  requestedDate: string;
  requestedTime: string;
  requestedByName: string;
  requestedDepartment: string;
  salesOrder: string;
  designName: string;
  recutReason: string;
  detailNumber: number;
  capStyle: string;
  pieces: number;
  operator: string;
  deliverTo: string;
  supervisorApproved: boolean;
  warehousePrinted: boolean;
};

type ApiResp =
  | {
      rows: Row[];
      total: number;
      page: number;
      pageSize: number;
    }
  | { error: string };

function boolText(v: boolean) {
  return v ? "Yes" : "No";
}

export default function RecutsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState("requestedDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const [filters, setFilters] = useState<Record<string, string>>({
    recutId: "",
    requestedDate: "",
    requestedTime: "",
    requestedByName: "",
    requestedDepartment: "",
    salesOrder: "",
    designName: "",
    recutReason: "",
    detailNumber: "",
    capStyle: "",
    pieces: "",
    operator: "",
    deliverTo: "",
    supervisorApproved: "",
    warehousePrinted: "",
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      try {
        const qs = new URLSearchParams({
          page: String(pageIndex + 1),
          pageSize: String(pageSize),
          sortBy,
          sortDir,
          q: "",
          recutId: filters.recutId || "",
          requestedDate: filters.requestedDate || "",
          requestedTime: filters.requestedTime || "",
          requestedByName: filters.requestedByName || "",
          requestedDepartment: filters.requestedDepartment || "",
          salesOrder: filters.salesOrder || "",
          designName: filters.designName || "",
          recutReason: filters.recutReason || "",
          detailNumber: filters.detailNumber || "",
          capStyle: filters.capStyle || "",
          pieces: filters.pieces || "",
          operator: filters.operator || "",
          deliverTo: filters.deliverTo || "",
          supervisorApproved: filters.supervisorApproved || "",
          warehousePrinted: filters.warehousePrinted || "",
        });

        const res = await fetch(`/api/recuts/list?${qs.toString()}`, {
          cache: "no-store",
          credentials: "include",
        });

        const data = (await res.json()) as ApiResp;

        if (!res.ok || "error" in data) {
          setError("error" in data ? data.error : "Failed to load recuts.");
          setRows([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }

        setRows(data.rows);
        setTotalCount(data.total);
      } catch {
        setError("Failed to load recuts.");
        setRows([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [filters, pageIndex, pageSize, sortBy, sortDir]);

  const columns = useMemo<Column<Row>[]>(() => {
    return [
      {
        key: "recutId",
        header: "Recut ID",
        sortable: true,
        filterable: true,
        placeholder: "Recut ID",
        render: (r) => r.recutId,
      },
      {
        key: "requestedDate",
        header: "Date Requested",
        sortable: true,
        filterable: true,
        placeholder: "Date Requested",
        render: (r) => r.requestedDate,
      },
      {
        key: "requestedTime",
        header: "Time Requested",
        sortable: true,
        filterable: true,
        placeholder: "Time Requested",
        render: (r) => r.requestedTime,
      },
      {
        key: "requestedByName",
        header: "Name",
        sortable: true,
        filterable: true,
        placeholder: "Name",
        render: (r) => r.requestedByName,
      },
      {
        key: "requestedDepartment",
        header: "Requested Department",
        sortable: true,
        filterable: true,
        placeholder: "Requested Department",
        render: (r) => r.requestedDepartment,
      },
      {
        key: "salesOrder",
        header: "Sales Order #",
        sortable: true,
        filterable: true,
        placeholder: "Sales Order #",
        render: (r) => r.salesOrder,
      },
      {
        key: "designName",
        header: "Design Name",
        sortable: true,
        filterable: true,
        placeholder: "Design Name",
        render: (r) => r.designName,
      },
      {
        key: "recutReason",
        header: "Recut Reason",
        sortable: true,
        filterable: true,
        placeholder: "Recut Reason",
        render: (r) => r.recutReason,
      },
      {
        key: "detailNumber",
        header: "Detail #",
        sortable: true,
        filterable: true,
        placeholder: "Detail #",
        render: (r) => r.detailNumber,
      },
      {
        key: "capStyle",
        header: "Cap Style",
        sortable: true,
        filterable: true,
        placeholder: "Cap Style",
        render: (r) => r.capStyle,
      },
      {
        key: "pieces",
        header: "Pieces",
        sortable: true,
        filterable: true,
        placeholder: "Pieces",
        render: (r) => r.pieces,
      },
      {
        key: "operator",
        header: "Operator",
        sortable: true,
        filterable: true,
        placeholder: "Operator",
        render: (r) => r.operator,
      },
      {
        key: "deliverTo",
        header: "Deliver To",
        sortable: true,
        filterable: true,
        placeholder: "Deliver To",
        render: (r) => r.deliverTo,
      },
      {
        key: "supervisorApproved",
        header: "Supervisor Approved",
        sortable: true,
        filterable: false,
        render: (r) => boolText(r.supervisorApproved),
      },
      {
        key: "warehousePrinted",
        header: "Warehouse Printed",
        sortable: true,
        filterable: false,
        render: (r) => boolText(r.warehousePrinted),
      },
      {
        key: "edit",
        header: "Edit",
        sortable: false,
        filterable: false,
        serverSortable: false,
        render: (r) =>
          r.supervisorApproved || r.warehousePrinted ? (
            <span style={{ color: "#6b7280" }}>Locked</span>
          ) : (
            <Link
              href={`/recuts/${r.id}`}
              style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}
            >
              Edit
            </Link>
          ),
      },
    ];
  }, []);

  function onToggleSort(key: string) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
    setPageIndex(0);
  }

  function onFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPageIndex(0);
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Recuts</h1>
          <p style={{ margin: "8px 0 0", color: "#6b7280" }}>
            Your submitted recut requests.
          </p>
        </div>

        <Link href="/recuts/add" style={btnSecondary}>
          + New Recut Request
        </Link>
      </div>

      <DataTable<Row>
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
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPageIndex(0);
        }}
        rowKey={(r) => r.id}
        csvFilename="recuts.csv"
        rowToCsv={(r) => ({
          "Recut ID": r.recutId,
          "Date Requested": r.requestedDate,
          "Time Requested": r.requestedTime,
          Name: r.requestedByName,
          "Requested Department": r.requestedDepartment,
          "Sales Order #": r.salesOrder,
          "Design Name": r.designName,
          "Recut Reason": r.recutReason,
          "Detail #": r.detailNumber,
          "Cap Style": r.capStyle,
          Pieces: r.pieces,
          Operator: r.operator,
          "Deliver To": r.deliverTo,
          "Supervisor Approved": boolText(r.supervisorApproved),
          "Warehouse Printed": boolText(r.warehousePrinted),
        })}
      />
    </div>
  );
}

const btnSecondary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  fontWeight: 600,
};