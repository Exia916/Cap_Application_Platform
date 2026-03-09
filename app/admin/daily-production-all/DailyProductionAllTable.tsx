"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Totals = {
  total_stitches: number | string;
  total_pieces: number | string;
  total_dozens: number | string;
};

type Row = {
  id: string;
  shift_date: string;
  entry_ts: string;
  name: string;
  machine_number: number;
  sales_order: number;
  detail_number: number;
  embroidery_location: string;
  stitches: number;
  pieces: number;

  // ✅ NEW
  annex: boolean;
  jobber_samples_ran: number | null;

  is_3d: boolean;
  is_knit: boolean;
  detail_complete: boolean;
  notes: string | null;
  total_stitches: number;
  shift_stitches: number;
  shift_pieces: number;
  shift_stitches_by_person: number;
  shift_pieces_by_person: number;
  dozens: string | number;
  employee_number: number;
  shift: string;
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
const nf2 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function fmtInt(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return nf0.format(n);
}
// ✅ Sales Order with NO commas
function fmtSalesOrderNoCommas(v: any) {
  const s = v === null || v === undefined ? "" : String(v);
  return s.replace(/,/g, "");
}
// ✅ Employee Number with NO commas
function fmtEmployeeNumberNoCommas(v: any) {
  const s = v === null || v === undefined ? "" : String(v);
  return s.replace(/,/g, "");
}
function fmtDozens(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return nf2.format(n);
}

// ✅ Date formatting
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
  // If it's YYYY-MM-DD, parse as a local date (avoids timezone shifting)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dateFmt.format(dt);
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
  | "shift_date"
  | "entry_ts"
  | "name"
  | "machine_number"
  | "sales_order"
  | "detail_number"
  | "embroidery_location"
  | "stitches"
  | "pieces"
  | "annex"
  | "jobber_samples_ran"
  | "total_stitches"
  | "shift_stitches"
  | "shift_pieces"
  | "shift_stitches_by_person"
  | "shift_pieces_by_person"
  | "dozens"
  | "employee_number"
  | "shift";

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

export default function DailyProductionAllTable({
  defaultStart,
  defaultEnd,
}: {
  defaultStart: string;
  defaultEnd: string;
}) {
  // ✅ Top horizontal scrollbar sync refs
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const topScrollInnerRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);

  // Filters (header inputs)
  const [showAll, setShowAll] = useState(false);

  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);

  // ✅ global search
  const [q, setQ] = useState("");

  const [name, setName] = useState("");
  const [machineNumber, setMachineNumber] = useState("");
  const [salesOrder, setSalesOrder] = useState("");
  const [detailNumber, setDetailNumber] = useState("");
  const [location, setLocation] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [shift, setShift] = useState("");

  // ✅ NEW filters
  const [annex, setAnnex] = useState<"" | "true" | "false">("");
  const [jobberSamplesRan, setJobberSamplesRan] = useState("");

  const [is3d, setIs3d] = useState<"" | "true" | "false">("");
  const [isKnit, setIsKnit] = useState<"" | "true" | "false">("");
  const [detailComplete, setDetailComplete] = useState<"" | "true" | "false">("");

  const [notes, setNotes] = useState("");

  // Paging
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // Click-to-sort
  const [sort, setSort] = useState<SortKey>("entry_ts");
  const [dir, setDir] = useState<SortDir>("desc");

  // Data
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (machineNumber) p.set("machine_number", machineNumber);
    if (salesOrder) p.set("sales_order", salesOrder);
    if (detailNumber) p.set("detail_number", detailNumber);
    if (location) p.set("location", location);
    if (employeeNumber) p.set("employee_number", employeeNumber);
    if (shift) p.set("shift", shift);

    if (annex) p.set("annex", annex);
    if (jobberSamplesRan) p.set("jobber_samples_ran", jobberSamplesRan);

    if (is3d) p.set("is_3d", is3d);
    if (isKnit) p.set("is_knit", isKnit);
    if (detailComplete) p.set("detail_complete", detailComplete);

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
    machineNumber,
    salesOrder,
    detailNumber,
    location,
    employeeNumber,
    shift,
    annex,
    jobberSamplesRan,
    is3d,
    isKnit,
    detailComplete,
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
      const res = await fetch(`/api/admin/daily-production-all?${qs}`, { cache: "no-store" });
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

  // ✅ 400ms debounce on typing/filters (server-side)
  useEffect(() => {
    const t = setTimeout(() => {
      load(query);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Reset page when filters change (but not when page changes)
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showAll,
    start,
    end,
    q,
    name,
    machineNumber,
    salesOrder,
    detailNumber,
    location,
    employeeNumber,
    shift,
    annex,
    jobberSamplesRan,
    is3d,
    isKnit,
    detailComplete,
    notes,
    pageSize,
  ]);

  function exportCsv() {
    const p = new URLSearchParams(query);
    p.set("format", "csv");
    window.location.href = `/api/admin/daily-production-all?${p.toString()}`;
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

  // ✅ Sync top scrollbar with table scrollbar
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

  // UI helper styles
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

  const label: React.CSSProperties = { fontSize: 12, color: "#374151", fontWeight: 700 };
  const input: React.CSSProperties = {
    height: 34,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    padding: "0 10px",
    background: "#fff",
    fontSize: 13,
    outline: "none",
  };
  const select: React.CSSProperties = { ...input, paddingRight: 8, cursor: "pointer" };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 14, padding: 12, width: "100%" }}>
      {/* Top controls */}
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

        {/* Global Search */}
        <div style={controlBox}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={label}>Search</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search: name, SO, detail, location, notes, emp#, shift…"
              style={{ ...input, width: 340 }}
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

      {/* Totals */}
      <div style={{ display: "flex", gap: 18, marginBottom: 10, color: "#111827", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 800 }}>Total Stitches: {fmtInt(totals?.total_stitches ?? 0)}</div>
        <div style={{ fontWeight: 800 }}>Total Pieces: {fmtInt(totals?.total_pieces ?? 0)}</div>
        <div style={{ fontWeight: 800 }}>Total Dozens: {fmtDozens(totals?.total_dozens ?? 0)}</div>
        <div style={{ marginLeft: "auto", fontWeight: 800 }}>Rows: {fmtInt(data?.totalCount ?? 0)}</div>
      </div>

      {error && <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>}
      {loading && <div style={{ marginBottom: 10, fontWeight: 700 }}>Loading…</div>}

      {/* TOP horizontal scrollbar */}
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
        aria-label="Horizontal scroll (top)"
        title="Horizontal scroll"
      >
        <div ref={topScrollInnerRef} style={{ height: 1 }} />
      </div>

      {/* Main table scroll container */}
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
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 2050 }}>
          <thead>
            <tr>
              <SortHeader label="Shift Date" sortKey="shift_date" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Data Timestamp" sortKey="entry_ts" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Name" sortKey="name" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Machine #" sortKey="machine_number" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Sales Order" sortKey="sales_order" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Detail" sortKey="detail_number" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Location" sortKey="embroidery_location" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Stitches" sortKey="stitches" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Pieces" sortKey="pieces" activeSort={sort} activeDir={dir} onChange={toggleSort} />

              {/* ✅ NEW */}
              <SortHeader label="Annex" sortKey="annex" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Jobber Samples Ran" sortKey="jobber_samples_ran" activeSort={sort} activeDir={dir} onChange={toggleSort} />

              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd", background: "#fafafa", whiteSpace: "nowrap" }}>3D</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd", background: "#fafafa", whiteSpace: "nowrap" }}>Knit</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd", background: "#fafafa", whiteSpace: "nowrap" }}>
                Detail Complete
              </th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd", background: "#fafafa", whiteSpace: "nowrap" }}>Notes</th>

              <SortHeader label="Total Stitches" sortKey="total_stitches" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Shift Stitches" sortKey="shift_stitches" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Shift Pieces" sortKey="shift_pieces" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader
                label="Shift Stitches By Person"
                sortKey="shift_stitches_by_person"
                activeSort={sort}
                activeDir={dir}
                onChange={toggleSort}
              />
              <SortHeader
                label="Shift Pieces By Person"
                sortKey="shift_pieces_by_person"
                activeSort={sort}
                activeDir={dir}
                onChange={toggleSort}
              />
              <SortHeader label="Dozens" sortKey="dozens" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Employee #" sortKey="employee_number" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Shift" sortKey="shift" activeSort={sort} activeDir={dir} onChange={toggleSort} />
            </tr>

            {/* Filters row */}
            <tr>
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff", whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 11, color: "#6b7280" }}>{showAll ? "All" : "Range"}</span>
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input disabled placeholder="(timestamp)" style={{ ...input, width: 130, opacity: 0.55 }} />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={{ ...input, width: 150 }} />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={machineNumber} onChange={(e) => setMachineNumber(e.target.value)} placeholder="Machine" style={{ ...input, width: 90 }} />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={salesOrder} onChange={(e) => setSalesOrder(e.target.value)} placeholder="SO" style={{ ...input, width: 120 }} />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={detailNumber} onChange={(e) => setDetailNumber(e.target.value)} placeholder="Detail" style={{ ...input, width: 90 }} />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" style={{ ...input, width: 120 }} />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input disabled placeholder="(view)" style={{ ...input, width: 90, opacity: 0.55 }} />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input disabled placeholder="(view)" style={{ ...input, width: 80, opacity: 0.55 }} />
              </th>

              {/* ✅ NEW: Annex filter */}
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <select value={annex} onChange={(e) => setAnnex(e.target.value as any)} style={{ ...select, width: 92 }}>
                  <option value="">Any</option>
                  <option value="true">TRUE</option>
                  <option value="false">FALSE</option>
                </select>
              </th>

              {/* ✅ NEW: Jobber Samples Ran filter */}
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input
                  value={jobberSamplesRan}
                  onChange={(e) => setJobberSamplesRan(e.target.value)}
                  placeholder="Jobber"
                  style={{ ...input, width: 110 }}
                />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <select value={is3d} onChange={(e) => setIs3d(e.target.value as any)} style={{ ...select, width: 92 }}>
                  <option value="">Any</option>
                  <option value="true">TRUE</option>
                  <option value="false">FALSE</option>
                </select>
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <select value={isKnit} onChange={(e) => setIsKnit(e.target.value as any)} style={{ ...select, width: 92 }}>
                  <option value="">Any</option>
                  <option value="true">TRUE</option>
                  <option value="false">FALSE</option>
                </select>
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <select value={detailComplete} onChange={(e) => setDetailComplete(e.target.value as any)} style={{ ...select, width: 130 }}>
                  <option value="">Any</option>
                  <option value="true">TRUE</option>
                  <option value="false">FALSE</option>
                </select>
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes contains" style={{ ...input, width: 180 }} />
              </th>

              {/* display-only columns */}
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input disabled style={{ ...input, width: 120, opacity: 0.55 }} />
              </th>
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input disabled style={{ ...input, width: 120, opacity: 0.55 }} />
              </th>
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input disabled style={{ ...input, width: 120, opacity: 0.55 }} />
              </th>
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input disabled style={{ ...input, width: 190, opacity: 0.55 }} />
              </th>
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input disabled style={{ ...input, width: 190, opacity: 0.55 }} />
              </th>
              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input disabled style={{ ...input, width: 95, opacity: 0.55 }} />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input
                  value={employeeNumber}
                  onChange={(e) => setEmployeeNumber(e.target.value)}
                  placeholder="Emp#"
                  style={{ ...input, width: 95 }}
                />
              </th>

              <th style={{ padding: 6, borderBottom: "1px solid #ddd", background: "#fff" }}>
                <input value={shift} onChange={(e) => setShift(e.target.value)} placeholder="Shift" style={{ ...input, width: 95 }} />
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: 10, borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{fmtDateOnly(r.shift_date)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{fmtTimestamp(r.entry_ts)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.name}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.machine_number)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtSalesOrderNoCommas(r.sales_order)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.detail_number)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.embroidery_location}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.stitches)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.pieces)}</td>

                {/* ✅ NEW */}
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.annex ? "TRUE" : "FALSE"}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.jobber_samples_ran)}</td>

                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.is_3d ? "TRUE" : "FALSE"}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.is_knit ? "TRUE" : "FALSE"}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.detail_complete ? "TRUE" : "FALSE"}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee", maxWidth: 520 }}>{r.notes || ""}</td>

                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.total_stitches)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.shift_stitches)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.shift_pieces)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.shift_stitches_by_person)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtInt(r.shift_pieces_by_person)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtDozens(r.dozens)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmtEmployeeNumberNoCommas(r.employee_number)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.shift}</td>
              </tr>
            ))}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={23} style={{ padding: 16, color: "#666" }}>
                  No results for the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error ? null : (
        <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
          Tip: Filters auto-refresh after you stop typing (400ms). Click column headers to sort. Use the top scrollbar to scroll columns.
        </div>
      )}
    </div>
  );
}