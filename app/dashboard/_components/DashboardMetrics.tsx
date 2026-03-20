"use client";

import { useEffect, useMemo, useState } from "react";

type MyMetricsResponse = {
  date: string;

  // Original cards (kept intact)
  totalStitches: number;
  totalPieces: number;

  qcFlatInspected: number;
  qc3DInspected: number;
  qcTotalInspected: number;

  emblemSewPieces: number;
  emblemStickerPieces: number;
  emblemHeatSealPieces: number;
  emblemTotalPieces: number;

  laserTotalPieces: number;

  // New modules
  knitProductionSubmissionCount: number;
  knitProductionTotalQuantity: number;

  knitQcSubmissionCount: number;
  knitQcTotalInspected: number;
  knitQcTotalRejected: number;

  sampleEmbroideryEntryCount: number;
  sampleEmbroideryTotalQuantity: number;
  sampleEmbroideryTotalDetailCount: number;

  recutRequestCount: number;
  recutTotalPieces: number;
  recutDoNotPullCount: number;

  summary: {
    totalSubmissions: number;
    activeModules: number;
    inactiveModules: number;
    hasAnyActivity: boolean;
  };
};

function ymdChicago(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mm = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysToYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);

  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmt(n: number | string) {
  return new Intl.NumberFormat().format(Math.round(Number(n || 0)));
}

async function fetchMetrics(date: string): Promise<MyMetricsResponse> {
  const res = await fetch(`/api/dashboard-metrics?date=${encodeURIComponent(date)}`, {
    cache: "no-store",
    credentials: "include",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Request failed (${res.status})`);
  }

  return json as MyMetricsResponse;
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="card">
      <div
        className="text-soft"
        style={{
          fontSize: 12,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 28,
          fontWeight: 800,
          lineHeight: 1.1,
        }}
      >
        {fmt(value)}
      </div>
    </div>
  );
}

function MetricSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section-card">
      <div className="section-card-header">
        <h2 style={{ margin: 0 }}>{title}</h2>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        {children}
      </div>
    </section>
  );
}

export default function DashboardMetrics() {
  const today = useMemo(() => ymdChicago(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [data, setData] = useState<MyMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr("");

      try {
        const result = await fetchMetrics(selectedDate);
        if (!cancelled) {
          setData(result);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message || "Failed to load metrics");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  if (loading) {
    return <div className="card">Loading metrics…</div>;
  }

  if (err) {
    return <div className="alert alert-danger">{err}</div>;
  }

  if (!data) {
    return <div className="alert alert-warning">No data returned.</div>;
  }

  return (
    <div className="section-stack">
      <div
        className="card"
        style={{
          display: "flex",
          alignItems: "end",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div>
          <label className="field-label">Selected Date</label>
          <input
            type="date"
            className="input"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setSelectedDate(ymdChicago(new Date()))}
        >
          Today
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setSelectedDate(addDaysToYmd(selectedDate, -1))}
        >
          Yesterday
        </button>

        <div className="text-soft" style={{ fontSize: 13 }}>
          Showing metrics for {data.date}
        </div>
      </div>

      {!data.summary.hasAnyActivity ? (
        <div className="alert alert-info">
          No submissions found for you on this date.
        </div>
      ) : null}

      <MetricSection title="My Activity Summary">
        <MetricCard label="Total Submissions" value={data.summary.totalSubmissions} />
        <MetricCard label="Active Modules" value={data.summary.activeModules} />
        <MetricCard label="Inactive Modules" value={data.summary.inactiveModules} />
      </MetricSection>

      <MetricSection title="Core Daily Metrics">
        <MetricCard label="Embroidery Total Stitches" value={data.totalStitches} />
        <MetricCard label="Embroidery Total Pieces" value={data.totalPieces} />

        <MetricCard label="QC Flat Inspected" value={data.qcFlatInspected} />
        <MetricCard label="QC 3D Inspected" value={data.qc3DInspected} />
        <MetricCard label="QC Total Inspected" value={data.qcTotalInspected} />

        <MetricCard label="Emblem Sew Pieces" value={data.emblemSewPieces} />
        <MetricCard label="Emblem Sticker Pieces" value={data.emblemStickerPieces} />
        <MetricCard label="Emblem Heat Seal Pieces" value={data.emblemHeatSealPieces} />
        <MetricCard label="Emblem Total Pieces" value={data.emblemTotalPieces} />

        <MetricCard label="Laser Total Pieces Cut" value={data.laserTotalPieces} />
      </MetricSection>

      <MetricSection title="Additional My Metrics">
        <MetricCard
          label="Knit Production Submissions"
          value={data.knitProductionSubmissionCount}
        />
        <MetricCard
          label="Knit Production Total Quantity"
          value={data.knitProductionTotalQuantity}
        />

        <MetricCard label="Knit QC Submissions" value={data.knitQcSubmissionCount} />
        <MetricCard label="Knit QC Total Inspected" value={data.knitQcTotalInspected} />
        <MetricCard label="Knit QC Total Rejected" value={data.knitQcTotalRejected} />

        <MetricCard
          label="Sample Embroidery Entries"
          value={data.sampleEmbroideryEntryCount}
        />
        <MetricCard
          label="Sample Embroidery Total Quantity"
          value={data.sampleEmbroideryTotalQuantity}
        />
        <MetricCard
          label="Sample Embroidery Total Details"
          value={data.sampleEmbroideryTotalDetailCount}
        />

        <MetricCard label="Recut Requests" value={data.recutRequestCount} />
        <MetricCard label="Recut Total Pieces" value={data.recutTotalPieces} />
        <MetricCard label="Recut Do Not Pull Count" value={data.recutDoNotPullCount} />
      </MetricSection>
    </div>
  );
}