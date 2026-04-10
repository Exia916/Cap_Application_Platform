"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Row = {
  id: string;
  recutId: number;

  requestedAt: string;
  requestedDate: string;
  requestedTime: string;

  requestedByUserId: string | null;
  requestedByUsername: string | null;
  requestedByName: string;
  requestedByEmployeeNumber: number | null;

  requestedDepartment: string;

  salesOrder: string;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;

  designName: string;
  recutReason: string;
  detailNumber: number;
  capStyle: string;
  pieces: number;
  operator: string;
  deliverTo: string;
  notes: string | null;
  event: boolean;

  supervisorApproved: boolean;
  supervisorApprovedAt: string | null;
  supervisorApprovedBy: string | null;

  warehousePrinted: boolean;
  warehousePrintedAt: string | null;
  warehousePrintedBy: string | null;

  isCompleted: boolean;

  doNotPull: boolean;
  doNotPullAt: string | null;
  doNotPullBy: string | null;

  createdAt: string;
  updatedAt: string;
};

type Totals = {
  total_pieces: number | string;
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
  | "requestedDate"
  | "operator"
  | "requestedByName"
  | "salesOrder"
  | "recutReason"
  | "pieces"
  | "recutId"
  | "requestedDepartment"
  | "salesOrderBase"
  | "designName"
  | "detailNumber"
  | "capStyle"
  | "deliverTo"
  | "notes"
  | "event"
  | "supervisorApproved"
  | "warehousePrinted"
  | "isCompleted"
  | "doNotPull";

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function fmtInt(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return nf0.format(n);
}

function fmtDateOnly(value: any) {
  if (!value) return "";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toISOString().slice(0, 10);
}

function fmtBool(v: boolean) {
  return v ? "Yes" : "No";
}

function BoolBadge({
  value,
  trueTone = "success",
}: {
  value: boolean;
  trueTone?: "success" | "warning" | "danger" | "brand-blue";
}) {
  const cls = value
    ? trueTone === "warning"
      ? "badge badge-warning"
      : trueTone === "danger"
        ? "badge badge-danger"
        : trueTone === "brand-blue"
          ? "badge badge-brand-blue"
          : "badge badge-success"
    : "badge badge-neutral";

  return <span className={cls}>{value ? "Yes" : "No"}</span>;
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
        borderBottom: "1px solid var(--border-table-strong)",
        background: "var(--surface-muted)",
        whiteSpace: "nowrap",
        cursor: "pointer",
        userSelect: "none",
        fontSize: 12,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
      title="Click to sort"
    >
      {label}
      <span style={{ color: "var(--text-soft)" }}>{arrow}</span>
    </th>
  );
}

export default function RecutsAllTable({
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

  const [recutId, setRecutId] = useState("");
  const [requestedByName, setRequestedByName] = useState("");
  const [requestedDepartment, setRequestedDepartment] = useState("");
  const [salesOrder, setSalesOrder] = useState("");
  const [salesOrderBase, setSalesOrderBase] = useState("");
  const [designName, setDesignName] = useState("");
  const [recutReason, setRecutReason] = useState("");
  const [detailNumber, setDetailNumber] = useState("");
  const [capStyle, setCapStyle] = useState("");
  const [pieces, setPieces] = useState("");
  const [operator, setOperator] = useState("");
  const [deliverTo, setDeliverTo] = useState("");
  const [notes, setNotes] = useState("");

  const [event, setEvent] = useState<"" | "true" | "false">("");
  const [supervisorApproved, setSupervisorApproved] = useState<"" | "true" | "false">("");
  const [warehousePrinted, setWarehousePrinted] = useState<"" | "true" | "false">("");
  const [isCompleted, setIsCompleted] = useState<"" | "true" | "false">("");
  const [doNotPull, setDoNotPull] = useState<"" | "true" | "false">("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  const [sort, setSort] = useState<SortKey>("requestedDate");
  const [dir, setDir] = useState<SortDir>("desc");

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

    if (recutId) p.set("recutId", recutId);
    if (requestedByName) p.set("requestedByName", requestedByName);
    if (requestedDepartment) p.set("requestedDepartment", requestedDepartment);
    if (salesOrder) p.set("salesOrder", salesOrder);
    if (salesOrderBase) p.set("salesOrderBase", salesOrderBase);
    if (designName) p.set("designName", designName);
    if (recutReason) p.set("recutReason", recutReason);
    if (detailNumber) p.set("detailNumber", detailNumber);
    if (capStyle) p.set("capStyle", capStyle);
    if (pieces) p.set("pieces", pieces);
    if (operator) p.set("operator", operator);
    if (deliverTo) p.set("deliverTo", deliverTo);
    if (notes) p.set("notes", notes);

    if (event) p.set("event", event);
    if (supervisorApproved) p.set("supervisorApproved", supervisorApproved);
    if (warehousePrinted) p.set("warehousePrinted", warehousePrinted);
    if (isCompleted) p.set("isCompleted", isCompleted);
    if (doNotPull) p.set("doNotPull", doNotPull);

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
    recutId,
    requestedByName,
    requestedDepartment,
    salesOrder,
    salesOrderBase,
    designName,
    recutReason,
    detailNumber,
    capStyle,
    pieces,
    operator,
    deliverTo,
    notes,
    event,
    supervisorApproved,
    warehousePrinted,
    isCompleted,
    doNotPull,
    page,
    pageSize,
    sort,
    dir,
  ]);

  async function load(qs: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/recuts-all?${qs}`, { cache: "no-store" });
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
    showAll,
    start,
    end,
    q,
    recutId,
    requestedByName,
    requestedDepartment,
    salesOrder,
    salesOrderBase,
    designName,
    recutReason,
    detailNumber,
    capStyle,
    pieces,
    operator,
    deliverTo,
    notes,
    event,
    supervisorApproved,
    warehousePrinted,
    isCompleted,
    doNotPull,
    pageSize,
  ]);

  function exportCsv() {
    const p = new URLSearchParams(query);
    p.set("format", "csv");
    window.location.href = `/api/admin/recuts-all?${p.toString()}`;
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

  const btn = (variant: "primary" | "ghost" = "primary") => ({
    height: 36,
    padding: "0 14px",
    borderRadius: 10,
    border: variant === "primary" ? "1px solid var(--btn-primary-border)" : "1px solid var(--btn-secondary-border)",
    background: variant === "primary" ? "var(--btn-primary-bg)" : "var(--btn-secondary-bg)",
    color: variant === "primary" ? "var(--btn-primary-text)" : "var(--btn-secondary-text)",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer" as const,
    opacity: loading ? 0.85 : 1,
  });

  const controlBox = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface-subtle)",
  };

  const label = { fontSize: 12, color: "var(--text-muted)", fontWeight: 700 };
  const input = {
    height: 34,
    borderRadius: 10,
    border: "1px solid var(--border-strong)",
    padding: "0 10px",
    background: "var(--surface)",
    fontSize: 13,
    outline: "none",
  };
  const select = { ...input, paddingRight: 8, cursor: "pointer" as const };

  const headInput = {
    width: "100%",
    minWidth: 110,
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "6px 8px",
    fontSize: 12,
    background: "var(--surface)",
  };

  function rowClass(r: Row) {
    if (r.doNotPull) return "dt-row-danger";
    return "dt-row";
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 12, width: "100%", background: "var(--surface)" }}>
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
              placeholder="Search recut id, name, SO, reason, operator, notes..."
              style={{ ...input, width: 360 }}
            />
          </div>

          {q ? (
            <button type="button" style={btn("ghost")} onClick={() => setQ("")} disabled={loading}>
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

          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 800 }}>
            Page {page} / {totalPages}
          </div>

          <button style={btn("ghost")} disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 18, marginBottom: 10, color: "var(--text)", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 800 }}>Total Pieces: {fmtInt(totals?.total_pieces ?? 0)}</div>
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
          border: "1px solid var(--border)",
          borderRadius: 10,
          width: "100%",
          background: "var(--surface)",
          marginBottom: 8,
        }}
      >
        <div ref={topScrollInnerRef} style={{ height: 1 }} />
      </div>

      <div
        ref={tableScrollRef}
        style={{
          overflowX: "auto",
          border: "1px solid var(--border)",
          borderRadius: 10,
          width: "100%",
          background: "var(--surface)",
        }}
      >
        <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: 2550 }}>
          <thead>
            <tr>
              <SortHeader label="Date Requested" sortKey="requestedDate" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Operator" sortKey="operator" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Name" sortKey="requestedByName" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Sales Order #" sortKey="salesOrder" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Recut Reason" sortKey="recutReason" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Pieces" sortKey="pieces" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Requested Department" sortKey="requestedDepartment" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Sales Order Base" sortKey="salesOrderBase" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Design Name" sortKey="designName" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Detail #" sortKey="detailNumber" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Cap Style" sortKey="capStyle" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Deliver To" sortKey="deliverTo" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Notes" sortKey="notes" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Event" sortKey="event" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Supervisor Approved" sortKey="supervisorApproved" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Warehouse Printed" sortKey="warehousePrinted" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Completed" sortKey="isCompleted" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Do Not Pull" sortKey="doNotPull" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="View" sortKey="recutId" activeSort={sort} activeDir={dir} onChange={toggleSort} />
              <SortHeader label="Recut ID" sortKey="recutId" activeSort={sort} activeDir={dir} onChange={toggleSort} />
            </tr>

            <tr>
              <th style={{ padding: 8, background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }} />
              <th style={{ padding: 8, background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
                <input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="Filter..." style={headInput} />
              </th>
              <th style={{ padding: 8, background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
                <input value={requestedByName} onChange={(e) => setRequestedByName(e.target.value)} placeholder="Filter..." style={headInput} />
              </th>
              <th style={{ padding: 8, background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
                <input value={salesOrder} onChange={(e) => setSalesOrder(e.target.value)} placeholder="Filter..." style={headInput} />
              </th>
              <th style={{ padding: 8, background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
                <input value={recutReason} onChange={(e) => setRecutReason(e.target.value)} placeholder="Filter..." style={headInput} />
              </th>
              <th style={{ padding: 8, background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
                <input value={pieces} onChange={(e) => setPieces(e.target.value)} placeholder="Filter..." style={headInput} />
              </th>
              <th style={{ padding: 8, background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
                <input value={requestedDepartment} onChange={(e) => setRequestedDepartment(e.target.value)} placeholder="Filter..." style={headInput} />
              </th>
              <th style={{ padding: 8, background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
                <input value={salesOrderBase} onChange={(e) => setSalesOrderBase(e.target.value)} placeholder="Filter..." style={headInput} />
              </th>
              <th style={{ padding: 8, background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
                <input value={designName} onChange={(e) => setDesignName(e.target.value)} placeholder="Filter..." style={headInput} />
              </th>
              <th style={{ padding: 8, background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
                <input value={detailNumber} onChange={(e) => setDetailNumber(e.target.value)} placeholder="Filter..." style={headInput} />
              </th>
              <th style={{ padding: 8, background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
                <input value={capStyle} onChange={(e) => setCapStyle(e.target.value)} placeholder="Filter..." style={headInput} />
              </th>
              <th style={{ padding: 8, background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
                <input value={deliverTo} onChange={(e) => setDeliverTo(e.target.value)} placeholder="Filter..." style={headInput} />
              </th>
              <th style={{ padding: 8, background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Filter..." style={headInput} />
              </th>
              <th style={{ padding: 8, background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
                <select value={event} onChange={(e) => setEvent(e.target.value as any)} style={headInput}>
                  <option value="">All</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </th>
              <th style={{ padding: 8, background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
                <select value={supervisorApproved} onChange={(e) => setSupervisorApproved(e.target.value as any)} style={headInput}>
                  <option value="">All</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </th>
              <th style={{ padding: 8, background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
                <select value={warehousePrinted} onChange={(e) => setWarehousePrinted(e.target.value as any)} style={headInput}>
                  <option value="">All</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </th>
              <th style={{ padding: 8, background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
                <select value={isCompleted} onChange={(e) => setIsCompleted(e.target.value as any)} style={headInput}>
                  <option value="">All</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </th>
              <th style={{ padding: 8, background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
                <select value={doNotPull} onChange={(e) => setDoNotPull(e.target.value as any)} style={headInput}>
                  <option value="">All</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </th>
              <th style={{ padding: 8, background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }} />
              <th style={{ padding: 8, background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
                <input value={recutId} onChange={(e) => setRecutId(e.target.value)} placeholder="Filter..." style={headInput} />
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={rowClass(r)}>
                <td style={td}>{fmtDateOnly(r.requestedDate)}</td>
                <td style={td}>{r.operator}</td>
                <td style={td}>{r.requestedByName}</td>
                <td style={td}>{r.salesOrder}</td>
                <td style={td}>{r.recutReason}</td>
                <td style={td}>{fmtInt(r.pieces)}</td>
                <td style={td}>{r.requestedDepartment}</td>
                <td style={td}>{r.salesOrderBase || ""}</td>
                <td style={td}>{r.designName}</td>
                <td style={td}>{r.detailNumber}</td>
                <td style={td}>{r.capStyle}</td>
                <td style={td}>{r.deliverTo}</td>
                <td style={td}>{r.notes || ""}</td>
                <td style={td}><BoolBadge value={r.event} trueTone="brand-blue" /></td>
                <td style={td}><BoolBadge value={r.supervisorApproved} /></td>
                <td style={td}><BoolBadge value={r.warehousePrinted} trueTone="warning" /></td>
                <td style={td}><BoolBadge value={r.isCompleted} /></td>
                <td style={td}><BoolBadge value={r.doNotPull} trueTone="danger" /></td>
                <td style={td}>
                  <Link href={`/recuts/${r.id}`} className="btn btn-secondary btn-sm">
                    View
                  </Link>
                </td>
                <td style={td}>{r.recutId}</td>
              </tr>
            ))}

            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={20} style={{ ...td, textAlign: "center", fontWeight: 700 }}>
                  No recut entries found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const td = {
  padding: 10,
  borderBottom: "1px solid var(--border-table)",
  whiteSpace: "nowrap" as const,
  verticalAlign: "top" as const,
  color: "var(--text-muted)",
  fontSize: 13,
};