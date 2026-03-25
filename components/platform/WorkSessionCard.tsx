"use client";

import { useMemo, useState } from "react";

export type WorkSessionCardArea = {
  id: string;
  moduleKey: string;
  areaCode: string;
  areaLabel: string;
  sortOrder: number;
  isActive: boolean;
};

export type WorkSessionCardSession = {
  id: string;
  moduleKey: string;
  areaCode: string;
  workDate: string;
  shiftDate: string | null;
  shift: string | null;
  userId: string | null;
  username: string | null;
  employeeNumber: number | null;
  operatorName: string;
  timeIn: string;
  timeOut: string | null;
  isOpen: boolean;
  notes: string | null;
};

type Props = {
  moduleKey: string;
  moduleLabel?: string;
  session: WorkSessionCardSession | null;
  areas: WorkSessionCardArea[];
  disabled?: boolean;
  onStarted?: (session: WorkSessionCardSession) => void;
  onClosed?: (session: WorkSessionCardSession) => void;
};

function fmtTs(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function getChicagoDateTimeLocalValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function statusBadge(open: boolean) {
  return (
    <span className={open ? "badge badge-success" : "badge badge-neutral"}>
      {open ? "Open" : "Closed"}
    </span>
  );
}

export default function WorkSessionCard({
  moduleKey,
  moduleLabel,
  session,
  areas,
  disabled = false,
  onStarted,
  onClosed,
}: Props) {
  const [areaCode, setAreaCode] = useState("");
  const [timeIn, setTimeIn] = useState(() => getChicagoDateTimeLocalValue());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedModuleLabel = moduleLabel || moduleKey;

  const selectedAreaLabel = useMemo(() => {
    if (!session?.areaCode) return "";
    return areas.find((a) => a.areaCode === session.areaCode)?.areaLabel || session.areaCode;
  }, [areas, session?.areaCode]);

  async function startSession() {
    setSaving(true);
    setError(null);

    try {
      const parsedTimeIn = new Date(timeIn);
      if (Number.isNaN(parsedTimeIn.getTime())) {
        throw new Error("Please enter a valid session start time.");
      }

      const res = await fetch("/api/platform/work-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          moduleKey,
          areaCode,
          timeIn: parsedTimeIn.toISOString(),
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to start work session.");
      }

      setAreaCode("");
      setNotes("");
      setTimeIn(getChicagoDateTimeLocalValue());

      if (onStarted) onStarted(data.session);
    } catch (err: any) {
      setError(err?.message || "Failed to start work session.");
    } finally {
      setSaving(false);
    }
  }

  async function closeSession() {
    if (!session?.id) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/platform/work-sessions/${encodeURIComponent(session.id)}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          timeOut: new Date().toISOString(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to close work session.");
      }

      if (onClosed) onClosed(data.session);
    } catch (err: any) {
      setError(err?.message || "Failed to close work session.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <style>{`
        /* Session detail: Module / Area / Time In / Shift */
        .wsc-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(180px, 1fr));
          gap: 12px;
        }

        /* Start session form: Area / Time In */
        .wsc-form-grid {
          display: grid;
          grid-template-columns: minmax(220px, 1fr) minmax(220px, 240px);
          gap: 12px;
        }

        @media (max-width: 560px) {
          .wsc-detail-grid,
          .wsc-form-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <div className="section-card-header">
        <div>
          <h3 style={{ margin: 0 }}>Work Session</h3>
          <div className="text-soft" style={{ marginTop: 4 }}>
            {resolvedModuleLabel}
          </div>
        </div>

        {session ? statusBadge(!!session.isOpen) : <span className="badge badge-neutral">No Session</span>}
      </div>

      {error ? <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div> : null}

      {session ? (
        <div className="section-stack">
          <div className="muted-box">
            <div className="wsc-detail-grid">
              <div>
                <div className="field-label">Module</div>
                <div>{resolvedModuleLabel}</div>
              </div>
              <div>
                <div className="field-label">Area</div>
                <div>{selectedAreaLabel || session.areaCode}</div>
              </div>
              <div>
                <div className="field-label">Time In</div>
                <div>{fmtTs(session.timeIn)}</div>
              </div>
              <div>
                <div className="field-label">Shift</div>
                <div>{session.shift || ""}</div>
              </div>
            </div>
          </div>

          {session.isOpen ? (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-danger"
                disabled={saving || disabled}
                onClick={closeSession}
              >
                {saving ? "Closing..." : "Close Session"}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="section-stack">
          <div className="wsc-form-grid">
            <div>
              <label className="field-label">Area *</label>
              <select
                className="select"
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value)}
                disabled={saving || disabled}
              >
                <option value="">Select area…</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.areaCode}>
                    {area.areaLabel}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Time In *</label>
              <input
                className="input"
                type="datetime-local"
                value={timeIn}
                onChange={(e) => setTimeIn(e.target.value)}
                disabled={saving || disabled}
              />
            </div>
          </div>

          <div>
            <label className="field-label">Notes</label>
            <textarea
              className="textarea"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving || disabled}
              placeholder="Optional session notes..."
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving || disabled || !areaCode || !timeIn}
              onClick={startSession}
            >
              {saving ? "Starting..." : "Start Session"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}