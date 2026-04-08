"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Totals = {
  total_inspected_quantity: number | string;
  total_rejected_quantity: number | string;
  total_quantity_shipped: number | string;
};

type DepartmentOption = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  sort_order: number;
};

type DepartmentMode = "only" | "except";

type Row = {
  id: string;
  entry_ts: string;
  entry_date: string;
  name: string;
  employee_number: number;
  department: string | null;
  sales_order: number;
  detail_number: number;
  flat_or_3d: string;
  order_quantity: number;
  inspected_quantity: number;
  rejected_quantity: number;
  quantity_shipped: number;
  notes: string | null;

  total_qty_inspected_by_date: number;
  flat_totals: number;
  three_d_totals: number;
  flat_totals_by_person: number;
  three_d_totals_by_person: number;
  total_qty_inspected_by_person: number;
};

type ApiResponse = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  rows: Row[];
  totals: Totals;
};

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function fmtInt(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return nf0.format(n);
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
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const tsFmt = new Intl.DateTimeFormat("en-US", {
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
    return dateFmt.format(new Date(y, m - 1, d));
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

type SortDir = "asc" | "desc";
type SortKey =
  | "entry_ts"
  | "entry_date"
  | "name"
  | "employee_number"
  | "department"
  | "sales_order"
  | "detail_number"
  | "flat_or_3d"
  | "order_quantity"
  | "inspected_quantity"
  | "rejected_quantity"
  | "quantity_shipped"
  | "total_qty_inspected_by_date"
  | "flat_totals"
  | "three_d_totals"
  | "flat_totals_by_person"
  | "three_d_totals_by_person"
  | "total_qty_inspected_by_person";

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

export default function QCDailyProductionAllTable({
  defaultStart,
  defaultEnd,
}: {
  defaultStart: string;
  defaultEnd: string;
}) {
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const topScrollInnerRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);

  const [showAll, setShowAll] = useState(false);
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);

  const [q, setQ] = useState("");

  const [name, setName] = useState("");
  const [salesOrder, setSalesOrder] = useState("");
  const [detailNumber, setDetailNumber] = useState("");
  const [flatOr3d, setFlatOr3d] = useState("");
  const [orderQty, setOrderQty] = useState("");
  const [inspectedQty, setInspectedQty] = useState("");
  const [rejectedQty, setRejectedQty] = useState("");
  const [shippedQty, setShippedQty] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [department, setDepartment] = useState("");
  const [departmentMode, setDepartmentMode] = useState<DepartmentMode>("only");
  const [notes, setNotes] = useState("");

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [deptLoading, setDeptLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sort, setSort] = useState<SortKey>("entry_ts");
  const [dir, setDir] = useState<SortDir>("desc");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadDepartments() {
      setDeptLoading(true);
      try {
        const res = await fetch("/api/lookups/departments", {
          cache: "no-store",
          credentials: "include",
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "Failed to load departments");

        if (!alive) return;
        setDepartments(Array.isArray(j?.departments) ? j.departments : []);
      } catch {
        if (!alive) return;
        setDepartments([]);
      } finally {
        if (alive) setDeptLoading(false);
      }
    }

    loadDepartments();

    return () => {
      alive = false;
    };
  }, []);

  const query = useMemo(() => {
    const p = new URLSearchParams();

    if (showAll) {
      p.set("all", "1");
    } else {
      if (start) p.set("start", start);
      if (end) p.set("end", end);
    }

    if (q) p.set("q", q);

    if (name) p.set("name", name);
    if (salesOrder) p.set("sales_order", salesOrder);
    if (detailNumber) p.set("detail_number", detailNumber);
    if (flatOr3d) p.set("flat_or_3d", flatOr3d);
    if (orderQty) p.set("order_quantity", orderQty);
    if (inspectedQty) p.set("inspected_quantity", inspectedQty);
    if (rejectedQty) p.set("rejected_quantity", rejectedQty);
    if (shippedQty) p.set("quantity_shipped", shippedQty);
    if (employeeNumber) p.set("employee_number", employeeNumber);
    if (department) {
      p.set("department", department);
      p.set("department_mode", departmentMode);
    }
    if (notes) p.set("notes", notes);

    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    p.set("sort", sort);
    p.set("dir", dir);

    return p.toString();
  }, [
    showAll,
    start,
    end,
    q,
    name,
    salesOrder,
    detailNumber,
    flatOr3d,
    orderQty,
    inspectedQty,
    rejectedQty,
    shippedQty,
    employeeNumber,
    department,
    departmentMode,
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
      const res = await fetch(`/api/admin/qc-daily-production-all?${qs}`, {
        cache: "no-store",
        credentials: "include",
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
    const t = setTimeout(() => load(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [
    showAll,
    start,
    end,
    q,
    name,
    salesOrder,
    detailNumber,
    flatOr3d,
    orderQty,
    inspectedQty,
    rejectedQty,
    shippedQty,
    employeeNumber,
    department,
    departmentMode,
    notes,
    pageSize,
  ]);

  function exportCsv() {
    const p = new URLSearchParams(query);
    p.set("format", "csv");
    window.location.href = `/api/admin/qc-daily-production-all?${p.toString()}`;
  }

  function toggleSort(next: SortKey) {
    if (sort === next) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(next);
      setDir("asc");
    }
  }

  const totals = data?.totals;
  const rows = data?.rows || [];
  const totalPages = data?.totalPages || 1;

  useEffect(() => {
    const top = topScrollRef.current;
    const inner = topScrollInnerRef.current;
    const body = tableScrollRef.current;
    if (!top || !inner || !body) return;

    let raf = 0;

    const setInnerWidth = () => {
      inner.style.width = `${body.scrollWidth}px`;
    };

    const onTopScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (body.scrollLeft !== top.scrollLeft) body.scrollLeft = top.scrollLeft;
      });
    };

    const onBodyScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (top.scrollLeft !== body.scrollLeft) top.scrollLeft = body.scrollLeft;
      });
    };

    top.addEventListener("scroll", onTopScroll, { passive: true });
    body.addEventListener("scroll", onBodyScroll, { passive: true });

    setInnerWidth();

    let ro: ResizeObserver | null = null;
    const canRO = typeof ResizeObserver !== "undefined";
    if (canRO) {
      ro = new ResizeObserver(() => setInnerWidth());
      ro.observe(body);
    } else {
      window.addEventListener("resize", setInnerWidth);
    }

    return () => {
      cancelAnimationFrame(raf);
      top.removeEventListener("scroll", onTopScroll);
      body.removeEventListener("scroll", onBodyScroll);
      if (ro) ro.disconnect();
      if (!canRO) window.removeEventListener("resize", setInnerWidth);
    };
  }, [rows.length, pageSize]);

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
        <div style={controlBox}>
          <button onClick={exportCsv} style={btn("primary")}>
            Export CSV
          </button>

          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            <span style={label}>Show All Entries</span>
          </label>
        </div>

        {!showAll ? (
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
        ) : null}

        <div style={controlBox}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={label}>Search</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search: name, department, SO, detail, emp#, flat/3D, qty, notes…"
              style={{ ...input, width: 360 }}
            />
          </div>

          {q ? (
            <button type="button" style={btn("ghost")} onClick={() => setQ("")} disabled={loading} title="Clear search">
              Clear
            </button>
          ) : null}
        </div>

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
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
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
        <div style={{ fontWeight: 800 }}>Total Inspected: {fmtInt(totals?.total_inspected_quantity ?? 0)}</div>
        <div style={{ fontWeight: 800 }}>Total Rejected: {fmtInt(totals?.total_rejected_quantity ?? 0)}</div>
        <div style={{ fontWeight: 800 }}>Total Shipped: {fmtInt(totals?.total_quantity_shipped ?? 0)}</div>
        <div style={{ marginLeft: "auto", fontWeight: 800 }}>Rows: {fmtInt(data?.totalCount ?? 0)}</div>
      </div>

      {error && <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>}
      {loading && <div style={{ marginBottom: 10, fontWeight: 700 }}>Loading…</div>}

      <div
        ref={topScrollRef}
        style={{
          overflowX: "auto",
          overflowY: "hidden",
          height: 16,
          border: "1px solid #eee",
          borderRadius: 10,
          width: "100%",
          background: "#fff",
          marginBottom: 8,
        }}
        title="Horizontal scroll"
      >
        <div ref={topScrollInnerRef} style={{ height: 1 }} />
      </div>

      <div
        ref={tableScrollRef}
        style={{
          overflowX: "auto",
          border: "1px solid #eee",
          borderRadius: 10,
          width: "100%",
          background: "#fff",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 2240 }}>
          <thead>
            <tr>
              <SortHeader label="Timestamp" sortKey="entry_ts" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Date" sortKey="entry_date" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Name" sortKey="name" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Department" sortKey="department" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Sales Order #" sortKey="sales_order" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Detail #" sortKey="detail_number" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Flat Or 3D" sortKey="flat_or_3d" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Order Qty" sortKey="order_quantity" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Inspected Qty" sortKey="inspected_quantity" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Rejected Qty" sortKey="rejected_quantity" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Qty Shipped" sortKey="quantity_shipped" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd", background: "#fafafa", whiteSpace: "nowrap" }}>
                Notes
              </th>
              <SortHeader
                label="Total Qty Inspected By Date"
                sortKey="total_qty_inspected_by_date"
                activeSort={sort}
                activeDir={dir}
                onChange={toggleSort}
              />
              <SortHeader label="Flat Totals" sortKey="flat_totals" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="3D Totals" sortKey="three_d_totals" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader
                label="Flat Totals By Person"
                sortKey="flat_totals_by_person"
                activeSort={sort}
                activeDir={dir}
                onChange={toggleSort}
              />
              <SortHeader
                label="3D Totals By Person"
                sortKey="three_d_totals_by_person"
                activeSort={sort}
                activeDir={dir}
                onChange={toggleSort}
              />
              <SortHeader
                label="Total Qty Inspected By Person"
                sortKey="total_qty_inspected_by_person"
                activeSort={sort}
                activeDir={dir}
                onChange={toggleSort}
              />
              <SortHeader label="Employee #" sortKey="employee_number" activeSort={sort} activeDir={dir} onChange={toggleSort} />
            </tr>

            <tr>
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input disabled placeholder="(ts)" style={{ ...input, width: 130, opacity: 0.55 }} />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff", whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 11, color: "#6b7280" }}>{showAll ? "All" : "Range"}</span>
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={{ ...input, width: 160 }} />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <select
                    value={departmentMode}
                    onChange={(e) => setDepartmentMode(e.target.value as DepartmentMode)}
                    style={{ ...select, width: 88 }}
                    disabled={deptLoading || !department}
                    title="Department filter mode"
                  >
                    <option value="only">Only</option>
                    <option value="except">Except</option>
                  </select>

                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    style={{ ...select, width: 180 }}
                    disabled={deptLoading}
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.code}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={salesOrder} onChange={(e) => setSalesOrder(e.target.value)} placeholder="SO" style={{ ...input, width: 120 }} />
              </th>
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={detailNumber} onChange={(e) => setDetailNumber(e.target.value)} placeholder="Detail" style={{ ...input, width: 90 }} />
              </th>
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={flatOr3d} onChange={(e) => setFlatOr3d(e.target.value)} placeholder="Flat/3D" style={{ ...input, width: 110 }} />
              </th>
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={orderQty} onChange={(e) => setOrderQty(e.target.value)} placeholder="Order Qty" style={{ ...input, width: 105 }} />
              </th>
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={inspectedQty} onChange={(e) => setInspectedQty(e.target.value)} placeholder="Inspected" style={{ ...input, width: 105 }} />
              </th>
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={rejectedQty} onChange={(e) => setRejectedQty(e.target.value)} placeholder="Rejected" style={{ ...input, width: 105 }} />
              </th>
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={shippedQty} onChange={(e) => setShippedQty(e.target.value)} placeholder="Shipped" style={{ ...input, width: 105 }} />
              </th>
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes contains" style={{ ...input, width: 190 }} />
              </th>

              {Array.from({ length: 6 }).map((_, idx) => (
                <th key={idx} style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                  <input disabled style={{ ...input, width: 160, opacity: 0.55 }} />
                </th>
              ))}

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input
                  value={employeeNumber}
                  onChange={(e) => setEmployeeNumber(e.target.value)}
                  placeholder="Emp#"
                  style={{ ...input, width: 110 }}
                />
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: 10, borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{fmtTimestamp(r.entry_ts)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{fmtDateOnly(r.entry_date)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.name}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.department || ""}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtSalesOrderNoCommas(r.sales_order)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.detail_number)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.flat_or_3d}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.order_quantity)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.inspected_quantity)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.rejected_quantity)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.quantity_shipped)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee", maxWidth: 520 }}>{r.notes || ""}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.total_qty_inspected_by_date)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.flat_totals)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.three_d_totals)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.flat_totals_by_person)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.three_d_totals_by_person)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.total_qty_inspected_by_person)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtEmployeeNumberNoCommas(r.employee_number)}</td>
              </tr>
            ))}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={19} style={{ padding: 16, color: "#666" }}>
                  No results for the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error ? null : (
        <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
          Tip: Select a department, then choose <strong>Only</strong> to see just that department or <strong>Except</strong> to hide it from the results.
        </div>
      )}
    </div>
  );
}