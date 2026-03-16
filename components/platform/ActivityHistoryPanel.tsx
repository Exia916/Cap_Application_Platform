"use client";

import { useEffect, useState } from "react";

type Activity = {
  id: number;
  eventType: string;
  fieldName: string | null;
  oldValue: any;
  newValue: any;
  createdAt: string;
  createdByName: string | null;
};

type Props = {
  entityType: string;
  entityId: string;
};

export default function ActivityHistoryPanel({
  entityType,
  entityId,
}: Props) {
  const [rows, setRows] = useState<Activity[]>([]);
  const [expanded, setExpanded] = useState(false);

  async function load() {
    const res = await fetch(
      `/api/platform/activity-history?entityType=${entityType}&entityId=${entityId}`
    );

    const data = await res.json();
    setRows(data.rows || []);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <h3 style={{ margin: 0 }}>
          Activity History ({rows.length})
        </h3>

        <button className="btnSecondary">
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          {rows.length === 0 && <div>No activity yet.</div>}

          {rows.map((r) => (
            <div
              key={r.id}
              style={{
                borderBottom: "1px solid #e5e7eb",
                padding: "10px 0",
              }}
            >
              <div>
                <b>{r.eventType}</b>
              </div>

              <div style={{ fontSize: 12, color: "#666" }}>
                By: {r.createdByName || "System"} |{" "}
                {new Date(r.createdAt).toLocaleString()}
              </div>

              {r.oldValue && (
                <div style={{ marginTop: 6 }}>
                  <b>Previous</b>
                  <pre style={{ fontSize: 12 }}>
                    {JSON.stringify(r.oldValue, null, 2)}
                  </pre>
                </div>
              )}

              {r.newValue && (
                <div>
                  <b>New</b>
                  <pre style={{ fontSize: 12 }}>
                    {JSON.stringify(r.newValue, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}