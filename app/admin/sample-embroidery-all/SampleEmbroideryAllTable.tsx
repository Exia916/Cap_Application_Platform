"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Totals = {
  total_quantity: number | string;
  total_detail_count: number | string;
};

type Row = {
  id: string;
  entryTs: string;
  entryDate: string;
  name: string;
  employeeNumber: number | null;
  salesOrder: string | null;
  detailCount: number;
  quantity: number;
  notes: string | null;
};

type ApiResponse = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  rows: Row[];
  totals: Totals;
};

type SortDir = "asc" | "desc";
type SortKey =
  | "entry_date"
  | "entry_ts"
  | "name"
  | "employee_number"
  | "sales_order"
  | "detail_count"
  | "quantity";

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function fmtInt(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return nf0.format(n);
}

function fmtText(v: any) {
  return v == null ? "" : String(v);
}

function fmtSalesOrderNoCommas(v: any) {
  const s = v === null || v === undefined ? "" : String(v);
  return s.replace(/,/g, "");
}

function fmtEmployeeNumberNoCommas(v: any) {
  const s = v === null || v === undefined ? "" : String(v);
  return s.replace(/,/g, "");
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const tsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
});

function fmtDateOnly(value: any) {
  if (!value) return "";
  const s = String(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dt);
  }

  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return s;
  return dateFmt.format(dt);
}

function fmtTimestamp(value: any) {
  if (!value) return "";
  const dt = new Date(String(value));
  if (Number.isNaN(dt.getTime())) return String(value);
  return tsFmt.format(dt);
}

function csvFileDateChicago() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mm = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${yyyy}-${mm}-${dd}`;
}

function SortHeader({
  label,
  sortKey,
  activeSort,
  activeDir,
  onChange,
}: {
  label: string;
  sortKey: SortKey;
  activeSort: SortKey;
  activeDir: SortDir;
  onChange: (k: SortKey) => void;
}) {
  const isActive = activeSort === sortKey;
  const arrow = isActive ? (activeDir === "asc" ? " ▲" : " ▼") : "";

  return (
    <th
      onClick={() => onChange(sortKey)}
      style={{
        textAlign: "left",
        padding: 10,
        borderBottom: "1px solid #ddd",
        background: "#fafafa",
        whiteSpace: "nowrap",
        cursor: "pointer",
        userSelect: "none",
      }}
      title="Click to sort"
    >
      {label}
      <span style={{ color: "#6b7280" }}>{arrow}</span>
    </th>
  );
}

export default function SampleEmbroideryAllTable({
  defaultStart,
  defaultEnd,
}: {
  defaultStart: string;
  defaultEnd: string;
}) {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);

  const [name, setName] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [salesOrder, setSalesOrder] = useState("");
  const [detailCount, setDetailCount] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [sort, setSort] = useState<SortKey>("entry_ts");
  const [dir, setDir] = useState<SortDir>("desc");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();

    if (start) p.set("entryDateFrom", start);
    if (end) p.set("entryDateTo", end);

    if (name) p.set("name", name);
    if (employeeNumber) p.set("employeeNumber", employeeNumber);
    if (salesOrder) p.set("salesOrder", salesOrder);
    if (detailCount) p.set("detailCount", detailCount);
    if (quantity) p.set("quantity", quantity);
    if (notes) p.set("notes", notes);

    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    p.set("sort", sort);
    p.set("dir", dir);

    return p.toString();
  }, [
    start,
    end,
    name,
    employeeNumber,
    salesOrder,
    detailCount,
    quantity,
    notes,
    page,
    pageSize,
    sort,
    dir,
  ]);

  async function load(qs: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/sample-embroidery-all?${qs}`, {
        cache: "no-store",
      });

      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to load");
      setData(j);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      load(query);
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [start, end, name, employeeNumber, salesOrder, detailCount, quantity, notes, pageSize]);

  function exportCsv() {
    const p = new URLSearchParams(query);
    p.set("format", "csv");
    window.location.href = `/api/admin/sample-embroidery-all?${p.toString()}`;
  }

  function toggleSort(next: SortKey) {
    if (sort === next) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(next);
      setDir("asc");
    }
  }

  function resetAll() {
    setStart(defaultStart);
    setEnd(defaultEnd);
    setName("");
    setEmployeeNumber("");
    setSalesOrder("");
    setDetailCount("");
    setQuantity("");
    setNotes("");
    setPage(1);
    setPageSize(25);
    setSort("entry_ts");
    setDir("desc");
  }

  const totals = data?.totals;
  const rows = data?.rows || [];
  const totalPages = data?.totalPages || 1;

  const btn = (variant: "primary" | "ghost" = "primary"): React.CSSProperties => ({
    height: 36,
    padding: "0 14px",
    borderRadius: 10,
    border: variant === "primary" ? "1px solid #111827" : "1px solid #d1d5db",
    background: variant === "primary" ? "#111827" : "#ffffff",
    color: variant === "primary" ? "#ffffff" : "#111827",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    opacity: loading ? 0.85 : 1,
  });

  const controlBox: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
  };

  const label: React.CSSProperties = {
    fontSize: 12,
    color: "#374151",
    fontWeight: 700,
  };

  const input: React.CSSProperties = {
    height: 34,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    padding: "0 10px",
    background: "#fff",
    fontSize: 13,
    outline: "none",
  };

  const select: React.CSSProperties = {
    ...input,
    paddingRight: 8,
    cursor: "pointer",
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 14, padding: 12, width: "100%" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <button onClick={exportCsv} style={btn("primary")}>
          Export CSV
        </button>

        <div style={controlBox}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={label}>Start</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={input} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={label}>End</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={input} />
          </div>
        </div>

        <button type="button" onClick={resetAll} style={btn("ghost")}>
          Reset
        </button>

        <Link href="/production/sample-embroidery" style={{ ...btn("ghost"), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
          Open User List
        </Link>

        <div style={{ ...controlBox, marginLeft: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={label}>Page Size</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPage(1);
                setPageSize(Number(e.target.value));
              }}
              style={select}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <button style={btn("ghost")} disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Prev
          </button>

          <div style={{ fontSize: 12, color: "#374151", fontWeight: 800 }}>
            Page {page} / {totalPages}
          </div>

          <button style={btn("ghost")} disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 18, marginBottom: 10, color: "#111827", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 800 }}>Total Quantity: {fmtInt(totals?.total_quantity ?? 0)}</div>
        <div style={{ fontWeight: 800 }}>Total Detail Count: {fmtInt(totals?.total_detail_count ?? 0)}</div>
        <div style={{ marginLeft: "auto", fontWeight: 800 }}>Rows: {fmtInt(data?.totalCount ?? 0)}</div>
      </div>

      {error && <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>}
      {loading && <div style={{ marginBottom: 10, fontWeight: 700 }}>Loading…</div>}

      <div
        style={{
          overflowX: "auto",
          border: "1px solid #eee",
          borderRadius: 10,
          width: "100%",
          background: "#fff",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 1220 }}>
          <thead>
            <tr>
              <SortHeader label="Date" sortKey="entry_date" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Data Timestamp" sortKey="entry_ts" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Name" sortKey="name" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader
                label="Employee #"
                sortKey="employee_number"
                activeSort={sort}
                activeDir={dir}
                onChange={toggleSort}
              />
              <SortHeader label="Sales Order" sortKey="sales_order" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Detail Count" sortKey="detail_count" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Quantity" sortKey="quantity" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <th
                style={{
                  textAlign: "left",
                  padding: 10,
                  borderBottom: "1px solid #ddd",
                  background: "#fafafa",
                  whiteSpace: "nowrap",
                }}
              >
                Notes
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: 10,
                  borderBottom: "1px solid #ddd",
                  background: "#fafafa",
                  whiteSpace: "nowrap",
                }}
              >
                View
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: 10,
                  borderBottom: "1px solid #ddd",
                  background: "#fafafa",
                  whiteSpace: "nowrap",
                }}
              >
                Edit
              </th>
            </tr>

            <tr>
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff", whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 11, color: "#6b7280" }}>Range</span>
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input disabled placeholder="(timestamp)" style={{ ...input, width: 140, opacity: 0.55 }} />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={{ ...input, width: 150 }} />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input
                  value={employeeNumber}
                  onChange={(e) => setEmployeeNumber(e.target.value)}
                  placeholder="Emp#"
                  style={{ ...input, width: 100 }}
                />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={salesOrder} onChange={(e) => setSalesOrder(e.target.value)} placeholder="SO" style={{ ...input, width: 120 }} />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input
                  value={detailCount}
                  onChange={(e) => setDetailCount(e.target.value)}
                  placeholder="Detail"
                  style={{ ...input, width: 100 }}
                />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Qty" style={{ ...input, width: 90 }} />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes contains" style={{ ...input, width: 220 }} />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input disabled placeholder="(view)" style={{ ...input, width: 72, opacity: 0.55 }} />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input disabled placeholder="(edit)" style={{ ...input, width: 72, opacity: 0.55 }} />
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: 10, borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{fmtDateOnly(r.entryDate)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{fmtTimestamp(r.entryTs)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtText(r.name)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtEmployeeNumberNoCommas(r.employeeNumber)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtSalesOrderNoCommas(r.salesOrder)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.detailCount)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.quantity)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee", maxWidth: 500 }}>{fmtText(r.notes)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                  <Link
                    href={`/production/sample-embroidery/${r.id}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 50,
                      height: 32,
                      padding: "0 12px",
                      borderRadius: 10,
                      border: "1px solid #d1d5db",
                      background: "#fff",
                      color: "#111827",
                      textDecoration: "none",
                      fontWeight: 700,
                    }}
                  >
                    View
                  </Link>
                </td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                  <Link
                    href={`/production/sample-embroidery/${r.id}/edit`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 50,
                      height: 32,
                      padding: "0 12px",
                      borderRadius: 10,
                      border: "1px solid #d1d5db",
                      background: "#fff",
                      color: "#111827",
                      textDecoration: "none",
                      fontWeight: 700,
                    }}
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={10} style={{ padding: 16, color: "#666" }}>
                  No results for the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error ? null : (
        <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
          Tip: Filters auto-refresh after you stop typing. Click column headers to sort.
        </div>
      )}
    </div>
  );
}