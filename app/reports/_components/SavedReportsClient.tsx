"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SavedReport = {
  id: string;
  reportName: string;
  description: string | null;
  datasetKey: string;
  visibility: string;
  ownerName: string | null;
  lastRunAt: string | null;
  updatedAt: string;
};

function fmtDate(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

export default function SavedReportsClient() {
  const [rows, setRows] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/reports/saved", {
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load saved reports.");
      }

      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err: any) {
      setRows([]);
      setError(err?.message || "Failed to load saved reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="section-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Saved Reports</h1>
          <p className="page-subtitle">
            Reports created by you or shared with your role/department.
          </p>
        </div>

        <Link href="/reports/builder" className="btn btn-primary">
          Create New Report
        </Link>
      </div>

      {loading ? <div className="card text-muted">Loading reports…</div> : null}
      {error ? <div className="alert alert-danger">{error}</div> : null}

      {!loading && !error && rows.length === 0 ? (
        <div className="card text-muted">No saved reports found.</div>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table-clean">
            <thead>
              <tr>
                <th>Report</th>
                <th>Dataset</th>
                <th>Visibility</th>
                <th>Owner</th>
                <th>Last Run</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div style={{ fontWeight: 800 }}>{row.reportName}</div>
                    {row.description ? (
                      <div className="text-soft" style={{ fontSize: 12 }}>
                        {row.description}
                      </div>
                    ) : null}
                  </td>
                  <td>{row.datasetKey}</td>
                  <td>
                    <span className="badge badge-neutral">{row.visibility}</span>
                  </td>
                  <td>{row.ownerName || ""}</td>
                  <td>{fmtDate(row.lastRunAt)}</td>
                  <td>{fmtDate(row.updatedAt)}</td>
                  <td>
                    <Link href={`/reports/${row.id}`} className="btn btn-secondary btn-sm">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}