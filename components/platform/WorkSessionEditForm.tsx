"use client";

import { useEffect, useMemo, useState } from "react";

type WorkSessionArea = {
  id: string;
  moduleKey: string;
  areaCode: string;
  areaLabel: string;
  sortOrder: number;
  isActive: boolean;
};

type WorkSession = {
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
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
};

type Props = {
  session: WorkSession;
  areas: WorkSessionArea[];
  canManage: boolean;
  onSaved?: (session: WorkSession) => void;
};

function toDateTimeLocalValue(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export default function WorkSessionEditForm({
  session,
  areas,
  canManage,
  onSaved,
}: Props) {
  const [areaCode, setAreaCode] = useState(session.areaCode);
  const [timeIn, setTimeIn] = useState(toDateTimeLocalValue(session.timeIn));
  const [timeOut, setTimeOut] = useState(toDateTimeLocalValue(session.timeOut));
  const [notes, setNotes] = useState(session.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAreaCode(session.areaCode);
    setTimeIn(toDateTimeLocalValue(session.timeIn));
    setTimeOut(toDateTimeLocalValue(session.timeOut));
    setNotes(session.notes ?? "");
  }, [session]);

  const selectedAreaLabel = useMemo(() => {
    return areas.find((a) => a.areaCode === areaCode)?.areaLabel || areaCode;
  }, [areas, areaCode]);

  async function save(payload: {
    areaCode?: string;
    timeIn?: string;
    timeOut?: string | null;
    notes?: string | null;
  }) {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/platform/work-sessions/${encodeURIComponent(session.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update work session.");
      }

      setMessage("Work session updated.");
      if (onSaved) onSaved(data.session);
    } catch (err: any) {
      setError(err?.message || "Failed to update work session.");
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;

    await save({
      areaCode,
      timeIn: timeIn ? new Date(timeIn).toISOString() : undefined,
      timeOut: timeOut ? new Date(timeOut).toISOString() : null,
      notes: notes.trim() || null,
    });
  }

  async function closeNow() {
    if (!canManage) return;
    await save({
      areaCode,
      timeIn: timeIn ? new Date(timeIn).toISOString() : undefined,
      timeOut: new Date().toISOString(),
      notes: notes.trim() || null,
    });
  }

  async function reopen() {
    if (!canManage) return;
    await save({
      areaCode,
      timeIn: timeIn ? new Date(timeIn).toISOString() : undefined,
      timeOut: null,
      notes: notes.trim() || null,
    });
  }

  return (
    <div className="record-section-card">
      <div className="record-section-header">
        <h2 className="record-section-title">Edit Session</h2>
      </div>

      {message ? <div className="alert alert-success" style={{ marginBottom: 12 }}>{message}</div> : null}
      {error ? <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div> : null}

      {!canManage ? (
        <div className="alert alert-warning">
          You do not have permission to edit this work session.
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="section-stack">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <div>
            <label className="field-label">Area</label>
            <select
              className="select"
              value={areaCode}
              disabled={!canManage || saving}
              onChange={(e) => setAreaCode(e.target.value)}
            >
              <option value="">Select area</option>
              {areas.map((area) => (
                <option key={area.id} value={area.areaCode}>
                  {area.areaLabel}
                </option>
              ))}
            </select>
            <div className="field-help">Current area label: {selectedAreaLabel}</div>
          </div>

          <div>
            <label className="field-label">Time In</label>
            <input
              className="input"
              type="datetime-local"
              value={timeIn}
              disabled={!canManage || saving}
              onChange={(e) => setTimeIn(e.target.value)}
            />
          </div>

          <div>
            <label className="field-label">Time Out</label>
            <input
              className="input"
              type="datetime-local"
              value={timeOut}
              disabled={!canManage || saving}
              onChange={(e) => setTimeOut(e.target.value)}
            />
            <div className="field-help">
              Leave blank to keep the session open.
            </div>
          </div>

          <div>
            <label className="field-label">Status</label>
            <div className="muted-box">
              <span className={session.isOpen ? "badge badge-success" : "badge badge-neutral"}>
                {session.isOpen ? "Open" : "Closed"}
              </span>
            </div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Notes</label>
            <textarea
              className="textarea"
              rows={4}
              value={notes}
              disabled={!canManage || saving}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional work session notes..."
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!canManage || saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>

          {session.isOpen ? (
            <button
              type="button"
              className="btn btn-danger"
              disabled={!canManage || saving}
              onClick={closeNow}
            >
              {saving ? "Closing..." : "Close Session Now"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!canManage || saving}
              onClick={reopen}
            >
              {saving ? "Reopening..." : "Reopen Session"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}