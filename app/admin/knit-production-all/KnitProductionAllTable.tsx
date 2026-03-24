"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Totals = {
  total_quantity: number | string;
  total_lines: number | string;
  total_rows: number | string;
};

type Row = {
  id: string;
  submissionId: string;
  entryTs: string;
  entryDate: string;
  name: string;
  employeeNumber: number;
  shift: string | null;
  stockOrder: boolean;
  salesOrder: string | null;
  knitArea: string | null;
  detailNumber: number | null;
  itemStyle: string | null;
  logo: string | null;
  quantity: number;
  notes: string | null;
  isVoided: boolean;
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
  | "shift"
  | "stock_order"
  | "sales_order"
  | "knit_area"
  | "detail_number"
  | "item_style"
  | "logo"
  | "quantity"
  | "is_voided";

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

function stockOrderBadge(v: boolean) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 44,
        height: 24,
        padding: "0 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        border: "1px solid #d1d5db",
        background: v ? "#eff6ff" : "#f9fafb",
        color: "#111827",
      }}
    >
      {v ? "Yes" : "No"}
    </span>
  );
}

function statusBadge(v: boolean) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 68,
        height: 24,
        padding: "0 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        border: "1px solid #d1d5db",
        background: v ? "#fef2f2" : "#f0fdf4",
        color: "#111827",
      }}
    >
      {v ? "Voided" : "Active"}
    </span>
  );
}

function knitAreaBadge(v: string | null | undefined) {
  const text = String(v ?? "").trim() || "—";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 72,
        height: 24,
        padding: "0 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        border: "1px solid #d1d5db",
        background: "#f9fafb",
        color: "#111827",
      }}
    >
      {text}
    </span>
  );
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

export default function KnitProductionAllTable({
  defaultStart,
  defaultEnd,
}: {
  defaultStart: string;
  defaultEnd: string;
}) {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);

  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [salesOrder, setSalesOrder] = useState("");
  const [knitArea, setKnitArea] = useState("");
  const [detailNumber, setDetailNumber] = useState("");
  const [itemStyle, setItemStyle] = useState("");
  const [logo, setLogo] = useState("");
  const [notes, setNotes] = useState("");
  const [stockOrder, setStockOrder] = useState("");
  const [status, setStatus] = useState("");

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

    if (q) p.set("q", q);
    if (name) p.set("name", name);
    if (employeeNumber) p.set("employeeNumber", employeeNumber);
    if (salesOrder) p.set("salesOrder", salesOrder);
    if (knitArea) p.set("knitArea", knitArea);
    if (detailNumber) p.set("detailNumber", detailNumber);
    if (itemStyle) p.set("itemStyle", itemStyle);
    if (logo) p.set("logo", logo);
    if (notes) p.set("notes", notes);
    if (stockOrder) p.set("stockOrder", stockOrder);

    if (status === "active") {
      p.set("includeVoided", "false");
      p.set("onlyVoided", "false");
    } else if (status === "voided") {
      p.set("includeVoided", "true");
      p.set("onlyVoided", "true");
    } else if (status === "all") {
      p.set("includeVoided", "true");
      p.set("onlyVoided", "false");
    }

    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    p.set("sort", sort);
    p.set("dir", dir);

    return p.toString();
  }, [
    start,
    end,
    q,
    name,
    employeeNumber,
    salesOrder,
    knitArea,
    detailNumber,
    itemStyle,
    logo,
    notes,
    stockOrder,
    status,
    page,
    pageSize,
    sort,
    dir,
  ]);

  async function load(qs: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/knit-production-all?${qs}`, {
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
  }, [
    start,
    end,
    q,
    name,
    employeeNumber,
    salesOrder,
    knitArea,
    detailNumber,
    itemStyle,
    logo,
    notes,
    stockOrder,
    status,
    pageSize,
  ]);

  function exportCsv() {
    const p = new URLSearchParams(query);
    p.set("format", "csv");
    window.location.href = `/api/admin/knit-production-all?${p.toString()}`;
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
    setQ("");
    setName("");
    setEmployeeNumber("");
    setSalesOrder("");
    setKnitArea("");
    setDetailNumber("");
    setItemStyle("");
    setLogo("");
    setNotes("");
    setStockOrder("");
    setStatus("");
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

        <div style={controlBox}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={label}>Search</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search SO, name, detail, logo, notes..."
              style={{ ...input, width: 280 }}
            />
          </div>
        </div>

        <button type="button" onClick={resetAll} style={btn("ghost")}>
          Reset
        </button>

        <Link
          href="/knit-production"
          style={{
            ...btn("ghost"),
            display: "inline-flex",
            alignItems: "center",
            textDecoration: "none",
          }}
        >
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
        <div style={{ fontWeight: 800 }}>Total Lines: {fmtInt(totals?.total_lines ?? 0)}</div>
        <div style={{ marginLeft: "auto", fontWeight: 800 }}>Rows: {fmtInt(totals?.total_rows ?? data?.totalCount ?? 0)}</div>
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
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 1900 }}>
          <thead>
            <tr>
              <SortHeader label="Date" sortKey="entry_date" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Data Timestamp" sortKey="entry_ts" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Name" sortKey="name" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Employee #" sortKey="employee_number" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Shift" sortKey="shift" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Stock Order" sortKey="stock_order" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Sales Order" sortKey="sales_order" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Knit Area" sortKey="knit_area" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Detail #" sortKey="detail_number" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Item Style" sortKey="item_style" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Logo" sortKey="logo" activeSort={sort} activeDir={dir} onChange={toggleSort} />
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
              <SortHeader label="Status" sortKey="is_voided" activeSort={sort} activeDir={dir} onChange={toggleSort} />
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
                <input disabled placeholder="(shift)" style={{ ...input, width: 90, opacity: 0.55 }} />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <select value={stockOrder} onChange={(e) => setStockOrder(e.target.value)} style={{ ...select, width: 110 }}>
                  <option value="">Any</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input
                  value={salesOrder}
                  onChange={(e) => setSalesOrder(e.target.value)}
                  placeholder="SO"
                  style={{ ...input, width: 130 }}
                />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input
                  value={knitArea}
                  onChange={(e) => setKnitArea(e.target.value)}
                  placeholder="Knit Area"
                  style={{ ...input, width: 120 }}
                />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input
                  value={detailNumber}
                  onChange={(e) => setDetailNumber(e.target.value)}
                  placeholder="Detail #"
                  style={{ ...input, width: 100 }}
                />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input
                  value={itemStyle}
                  onChange={(e) => setItemStyle(e.target.value)}
                  placeholder="Item Style"
                  style={{ ...input, width: 140 }}
                />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="Logo" style={{ ...input, width: 140 }} />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input disabled placeholder="(qty)" style={{ ...input, width: 90, opacity: 0.55 }} />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes contains"
                  style={{ ...input, width: 220 }}
                />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...select, width: 110 }}>
                  <option value="">Active</option>
                  <option value="all">All</option>
                  <option value="voided">Voided</option>
                </select>
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
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtText(r.shift)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{stockOrderBadge(!!r.stockOrder)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtSalesOrderNoCommas(r.salesOrder)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{knitAreaBadge(r.knitArea)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.detailNumber)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtText(r.itemStyle)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtText(r.logo)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.quantity)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee", maxWidth: 500 }}>{fmtText(r.notes)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{statusBadge(!!r.isVoided)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                  <Link
                    href={`/knit-production/${r.submissionId}`}
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
                    href={`/knit-production/${r.submissionId}/edit`}
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
                <td colSpan={16} style={{ padding: 16, color: "#666" }}>
                  No results for the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error ? null : (
        <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
          Tip: Global search and filters auto-refresh after you stop typing. Click column headers to sort.
        </div>
      )}
    </div>
  );
}