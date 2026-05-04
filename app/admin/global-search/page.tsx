"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Me = {
  username: string | null;
  displayName: string | null;
  employeeNumber: number | null;
  role: string | null;
};

type SectionKey =
  | "daily"
  | "qc"
  | "emblem"
  | "laser"
  | "sampleEmbroidery"
  | "knitProduction"
  | "knitQc"
  | "designWorkflow"
  | "recut"
  | "workOrders";

type Section = {
  key: SectionKey;
  title: string;
  count: number;
  rows: any[];
};

type ApiResponse = {
  q: string;
  start: string | null;
  end: string | null;
  all: boolean;
  limit: number;
  sections: Section[];
};

const GLOBAL_SEARCH_ROLES = [
  "ADMIN",
  "SUPERVISOR",
  "MANAGER",
  "CUSTOMER SERVICE",
  "PURCHASING",
  "SALES",
];

const ROW_OPEN_RESTRICTED_ROLES = ["CUSTOMER SERVICE", "SALES"];

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function fmtInt(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return nf0.format(n);
}

const tsFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Chicago",
});

function fmtDateOnly(value: any) {
  if (!value) return "";

  const s = String(value).trim();

  // Safe handling for SQL DATE values like YYYY-MM-DD.
  // Do not convert these through JS Date objects.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${m}/${d}/${y}`;
  }

  return s;
}

function fmtTimestamp(value: any) {
  if (!value) return "";
  const dt = new Date(String(value));
  if (Number.isNaN(dt.getTime())) return String(value);
  return tsFmt.format(dt);
}

function getOpenUrl(sectionKey: SectionKey, q: string) {
  if (sectionKey === "daily") return `/admin/daily-production-all?q=${encodeURIComponent(q)}`;
  if (sectionKey === "qc") return `/admin/qc-daily-production-all?q=${encodeURIComponent(q)}`;
  if (sectionKey === "emblem") return `/admin/emblem-production-all?q=${encodeURIComponent(q)}`;
  if (sectionKey === "laser") return `/admin/laser-production-all?q=${encodeURIComponent(q)}`;
  if (sectionKey === "sampleEmbroidery") return `/production/sample-embroidery?q=${encodeURIComponent(q)}`;
  if (sectionKey === "knitProduction") return `/knit-production?q=${encodeURIComponent(q)}`;
  if (sectionKey === "knitQc") return `/knit-qc?q=${encodeURIComponent(q)}`;
  if (sectionKey === "designWorkflow") return `/design-workflow?q=${encodeURIComponent(q)}`;
  if (sectionKey === "recut") return `/recuts?q=${encodeURIComponent(q)}`;
  return `/cmms?q=${encodeURIComponent(q)}`;
}

function getRowUrl(sectionKey: SectionKey, r: any): string | null {
  if (sectionKey === "daily") {
    const id = r?.submission_id ?? r?.id;
    return id ? `/daily-production/${encodeURIComponent(String(id))}` : null;
  }

  if (sectionKey === "qc") {
    const id = r?.submission_id ?? r?.id;
    return id ? `/qc-daily-production/${encodeURIComponent(String(id))}` : null;
  }

  if (sectionKey === "emblem") {
    const id = r?.submission_id ?? r?.id;
    return id ? `/emblem-production/${encodeURIComponent(String(id))}` : null;
  }

  if (sectionKey === "laser") {
    return r?.id ? `/laser-production/${encodeURIComponent(String(r.id))}` : null;
  }

  if (sectionKey === "sampleEmbroidery") {
    return r?.id ? `/production/sample-embroidery/${encodeURIComponent(String(r.id))}` : null;
  }

  if (sectionKey === "knitProduction") {
    const id = r?.submission_id ?? r?.id;
    return id ? `/knit-production/${encodeURIComponent(String(id))}` : null;
  }

  if (sectionKey === "knitQc") {
    const id = r?.submission_id ?? r?.id;
    return id ? `/knit-qc/${encodeURIComponent(String(id))}` : null;
  }

  if (sectionKey === "designWorkflow") {
    return r?.id ? `/design-workflow?requestId=${encodeURIComponent(String(r.id))}` : null;
  }

  if (sectionKey === "recut") {
    return r?.id ? `/recuts/${encodeURIComponent(String(r.id))}` : null;
  }

  const workOrderId = r?.work_order_id ?? r?.id;
  return workOrderId ? `/cmms/${encodeURIComponent(String(workOrderId))}` : null;
}

function KeyFields({ sectionKey, r }: { sectionKey: SectionKey; r: any }) {
  if (sectionKey === "daily") {
    return (
      <span>
        SO: <b>{r.sales_order ?? ""}</b> · Detail: <b>{r.detail_number ?? ""}</b> · Loc:{" "}
        <b>{r.embroidery_location ?? ""}</b> · Pieces: <b>{r.pieces ?? ""}</b> · Stitches:{" "}
        <b>{r.stitches ?? ""}</b> · Shift: <b>{r.shift ?? ""}</b> · Machine:{" "}
        <b>{r.machine_number ?? ""}</b>
      </span>
    );
  }

  if (sectionKey === "qc") {
    return (
      <span>
        SO: <b>{r.sales_order ?? ""}</b> · Detail: <b>{r.detail_number ?? ""}</b> · Flat/3D:{" "}
        <b>{r.flat_or_3d ?? ""}</b> · Order Qty: <b>{r.order_quantity ?? ""}</b> · Inspected:{" "}
        <b>{r.inspected_quantity ?? ""}</b> · Rejected: <b>{r.rejected_quantity ?? ""}</b>
      </span>
    );
  }

  if (sectionKey === "emblem") {
    return (
      <span>
        SO: <b>{r.sales_order ?? ""}</b> · Detail: <b>{r.detail_number ?? ""}</b> · Type:{" "}
        <b>{r.emblem_type ?? ""}</b> · Logo: <b>{r.logo_name ?? ""}</b> · Pieces:{" "}
        <b>{r.pieces ?? ""}</b>
      </span>
    );
  }

  if (sectionKey === "laser") {
    return (
      <span>
        SO: <b>{r.sales_order ?? ""}</b> · Leather: <b>{r.leather_style_color ?? ""}</b> · Pieces:{" "}
        <b>{r.pieces_cut ?? ""}</b>
      </span>
    );
  }

  if (sectionKey === "sampleEmbroidery") {
    return (
      <span>
        SO: <b>{r.sales_order ?? ""}</b> · Detail Count: <b>{r.detail_count ?? ""}</b> · Qty:{" "}
        <b>{r.quantity ?? ""}</b>
      </span>
    );
  }

  if (sectionKey === "knitProduction") {
    return (
      <span>
        SO: <b>{r.sales_order ?? r.sales_order_display ?? ""}</b> · Detail:{" "}
        <b>{r.detail_number ?? ""}</b> · Item Style: <b>{r.item_style ?? ""}</b> · Logo:{" "}
        <b>{r.logo ?? ""}</b> · Qty: <b>{r.quantity ?? ""}</b> · Shift: <b>{r.shift ?? ""}</b>
      </span>
    );
  }

  if (sectionKey === "knitQc") {
    return (
      <span>
        SO: <b>{r.sales_order ?? r.sales_order_display ?? ""}</b> · Detail:{" "}
        <b>{r.detail_number ?? ""}</b> · Logo: <b>{r.logo ?? ""}</b> · Order Qty:{" "}
        <b>{r.order_quantity ?? ""}</b> · Inspected: <b>{r.inspected_quantity ?? ""}</b> · Rejected:{" "}
        <b>{r.rejected_quantity ?? ""}</b> · QC Emp#: <b>{r.qc_employee_number ?? ""}</b>
      </span>
    );
  }

  if (sectionKey === "designWorkflow") {
    return (
      <span>
        Req#: <b>{r.request_number ?? ""}</b> · SO: <b>{r.sales_order ?? ""}</b> · PO:{" "}
        <b>{r.po_number ?? ""}</b> · Tape: <b>{r.tape_name ?? ""}</b> · Customer:{" "}
        <b>{r.customer_name ?? ""}</b> · Status: <b>{r.request_status ?? ""}</b> · Due:{" "}
        <b>{fmtDateOnly(r.due_date)}</b> · Rush: <b>{r.rush ? "Yes" : "No"}</b>
      </span>
    );
  }

  if (sectionKey === "recut") {
    return (
      <span>
        Recut ID: <b>{r.recut_id ?? ""}</b> · SO: <b>{r.sales_order ?? ""}</b> · Detail:{" "}
        <b>{r.detail_number ?? ""}</b> · Style: <b>{r.cap_style ?? ""}</b> · Pieces:{" "}
        <b>{r.pieces ?? ""}</b>
      </span>
    );
  }

  return (
    <span>
      WO#: <b>{r.work_order_id ?? r.id ?? ""}</b> · Department: <b>{r.department ?? ""}</b> · Asset:{" "}
      <b>{r.asset ?? ""}</b> · Priority: <b>{r.priority ?? ""}</b> · Status: <b>{r.status ?? ""}</b>
    </span>
  );
}

function GlobalSearchPageInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const q = (sp?.get("q") || "").trim();

  const [showAll, setShowAll] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const [me, setMe] = useState<Me | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const role = useMemo(() => (me?.role ?? "").trim().toUpperCase(), [me?.role]);
  const canAccess = GLOBAL_SEARCH_ROLES.includes(role);
  const canOpenRows = !ROW_OPEN_RESTRICTED_ROLES.includes(role);

  useEffect(() => {
    let alive = true;

    (async () => {
      setMeLoaded(false);

      try {
        const res = await fetch("/api/me", {
          credentials: "include",
          cache: "no-store",
        });

        if (!alive) return;

        if (res.status === 401) {
          setMe(null);
          setMeLoaded(true);
          return;
        }

        if (!res.ok) {
          setMe(null);
          setMeLoaded(true);
          return;
        }

        const j = (await res.json()) as Me;
        if (!alive) return;

        setMe(j);
        setMeLoaded(true);
      } catch {
        if (!alive) return;
        setMe(null);
        setMeLoaded(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!meLoaded) return;
    if (!canAccess) return;

    if (!q) {
      setData(null);
      setError(null);
      return;
    }

    const p = new URLSearchParams();
    p.set("q", q);

    if (showAll) {
      p.set("all", "1");
    } else {
      if (start) p.set("start", start);
      if (end) p.set("end", end);
    }

    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/admin/global-search?${p.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });

        const j = await res.json();

        if (!res.ok) {
          throw new Error(j?.error || "Failed to load");
        }

        if (!alive) return;
        setData(j);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load");
        setData(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [q, showAll, start, end, meLoaded, canAccess]);

  if (!meLoaded) {
    return (
      <div style={{ padding: 16 }}>
        <h1 style={{ marginBottom: 6 }}>Global Search</h1>
        <div style={{ color: "#6b7280" }}>Loading…</div>
      </div>
    );
  }

  if (!me) {
    return (
      <div style={{ padding: 16 }}>
        <h1 style={{ marginBottom: 10 }}>Global Search</h1>
        <div style={{ color: "crimson", fontWeight: 800 }}>
          You are not signed in.
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div style={{ padding: 16 }}>
        <h1 style={{ marginBottom: 10 }}>Global Search</h1>
        <div style={{ color: "crimson", fontWeight: 800 }}>
          You do not have access to Global Search.
        </div>
        <div style={{ marginTop: 10, color: "#6b7280", fontSize: 13 }}>
          Allowed roles: <b>{GLOBAL_SEARCH_ROLES.join(", ")}</b>. (Your role from /api/me is:{" "}
          <b>{me?.role ?? "null"}</b>)
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Global Search</h1>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            <span style={{ fontSize: 12, color: "#374151", fontWeight: 800 }}>Show All</span>
          </label>

          {!showAll ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "#374151", fontWeight: 800 }}>Start</span>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={input} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "#374151", fontWeight: 800 }}>End</span>
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={input} />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ marginBottom: 12, color: "#111827" }}>
        <span style={{ fontWeight: 800 }}>Query:</span>{" "}
        <span style={{ fontFamily: "monospace" }}>{q || "(empty)"}</span>
      </div>

      {!canOpenRows ? (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            background: "#f9fafb",
            color: "#374151",
            fontSize: 13,
          }}
        >
          Search results are view-only for your role. Use the section buttons to open the full module pages.
        </div>
      ) : null}

      {error && <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>}
      {loading && <div style={{ marginBottom: 10, fontWeight: 800 }}>Searching…</div>}
      {!q ? (
        <div style={{ color: "#6b7280" }}>
          Type a value in the navbar search and press Enter / Search.
        </div>
      ) : null}

      {data?.sections?.map((sec) => (
        <div key={sec.key} style={sectionCard}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ fontWeight: 900 }}>{sec.title}</div>
            <div style={{ color: "#6b7280", fontSize: 12 }}>
              Matches: {fmtInt(sec.count)}
            </div>

            <button onClick={() => router.push(getOpenUrl(sec.key, q))} style={btnGhost}>
              Open {sec.title}
            </button>
          </div>

          {sec.rows.length === 0 ? (
            <div style={{ color: "#6b7280" }}>No matches.</div>
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 10, background: "#fff" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 1100 }}>
                <thead>
                  <tr>
                    <th style={th}>Timestamp</th>
                    <th style={th}>Date</th>
                    <th style={th}>Name</th>
                    <th style={th}>Emp#</th>
                    <th style={th}>Key Fields</th>
                    <th style={th}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {sec.rows.map((r: any, idx: number) => {
                    const rowUrl = canOpenRows ? getRowUrl(sec.key, r) : null;
                    const clickable = Boolean(rowUrl);

                    return (
                      <tr
                        key={`${sec.key}-${idx}`}
                        onClick={() => {
                          if (rowUrl) router.push(rowUrl);
                        }}
                        style={clickable ? rowClickable : undefined}
                        title={clickable ? "Open record" : undefined}
                        onKeyDown={(e) => {
                          if (!rowUrl) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(rowUrl);
                          }
                        }}
                        tabIndex={clickable ? 0 : -1}
                      >
                        <td style={td}>{fmtTimestamp(r.entry_ts)}</td>
                        <td style={td}>{fmtDateOnly(r.entry_date)}</td>
                        <td style={td}>{r.name ?? ""}</td>
                        <td style={td}>{r.employee_number ?? ""}</td>
                        <td style={td}>
                          <KeyFields sectionKey={sec.key} r={r} />
                        </td>
                        <td style={{ ...td, maxWidth: 520, whiteSpace: "pre-wrap" }}>
                          {r.notes ?? ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function GlobalSearchPageFallback() {
  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ marginBottom: 6 }}>Global Search</h1>
      <div style={{ color: "#6b7280" }}>Loading…</div>
    </div>
  );
}

export default function GlobalSearchPage() {
  return (
    <Suspense fallback={<GlobalSearchPageFallback />}>
      <GlobalSearchPageInner />
    </Suspense>
  );
}

const input: React.CSSProperties = {
  height: 36,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
};

const sectionCard: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 14,
  marginBottom: 14,
  background: "#f9fafb",
};

const btnGhost: React.CSSProperties = {
  marginLeft: "auto",
  height: 32,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 700,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #e5e7eb",
  background: "#f9fafb",
  color: "#111827",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top",
  color: "#111827",
};

const rowClickable: React.CSSProperties = {
  cursor: "pointer",
};