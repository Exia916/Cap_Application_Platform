"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import WorkSessionCard from "@/components/platform/WorkSessionCard";

type LookupOption = {
  id: string;
  itemCode?: string | null;
};

type KnitAreaOption = {
  id: string;
  areaName: string;
  sortOrder?: number;
  isActive?: boolean;
};

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
};

type Line = {
  detailNumber: string;
  itemStyle: string;
  logo: string;
  quantity: string;
  notes: string;
};

type LoadedSubmission = {
  id: string;
  entryTs: string;
  entryDate: string;
  name: string;
  employeeNumber: number;
  shift: string | null;
  stockOrder: boolean;
  salesOrder: string | null;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  knitArea: string;
  sessionId?: string | null;
  notes: string | null;
  isVoided?: boolean;
  voidedAt?: string | null;
  voidedBy?: string | null;
  voidReason?: string | null;
};

type LoadedLine = {
  id: string;
  submissionId: string;
  entryTs: string;
  entryDate: string;
  shiftDate: string | null;
  name: string;
  employeeNumber: number;
  shift: string | null;
  stockOrder: boolean;
  salesOrder: string | null;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  knitArea: string;
  detailNumber: number | null;
  itemStyle: string | null;
  logo: string | null;
  quantity: number | null;
  notes: string | null;
};

type MeResponse = {
  userId?: string | null;
  username?: string | null;
  displayName?: string | null;
  employeeNumber?: number | null;
  role?: string | null;
};

type Props = {
  initialSubmissionId?: string;
};

type FormErrors = {
  salesOrder?: string;
  knitArea?: string;
  lines?: Array<{
    detailNumber?: string;
    itemStyle?: string;
    quantity?: string;
  }>;
};

function isWholeNumberString(v: string) {
  return /^\d+$/.test(String(v ?? "").trim());
}

function emptyLine(): Line {
  return { detailNumber: "", itemStyle: "", logo: "", quantity: "", notes: "" };
}

function resetFormState() {
  return {
    entryTs: new Date().toISOString(),
    stockOrder: false,
    salesOrder: "",
    knitArea: "",
    notes: "",
    lines: [emptyLine()],
    errors: {} as FormErrors,
  };
}

function FieldBlock({
  label,
  error,
  children,
  full = false,
  required = false,
  helperText,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  full?: boolean;
  required?: boolean;
  helperText?: string;
}) {
  return (
    <div style={full ? { gridColumn: "1 / -1" } : undefined}>
      <label className="field-label">
        {label}
        {required ? <span style={{ color: "#dc2626" }}> *</span> : null}
      </label>
      {children}
      {helperText ? (
        <div className="text-soft" style={{ marginTop: 4 }}>
          {helperText}
        </div>
      ) : null}
      {error ? <div className="field-error">{error}</div> : null}
    </div>
  );
}

function CheckboxBlock({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <label
        className="muted-box"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          minHeight: 42,
          cursor: "pointer",
          width: "100%",
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{checked ? "Yes" : "No"}</span>
      </label>
    </div>
  );
}

function ItemStyleCombobox({
  items,
  value,
  onChange,
  error,
  disabled = false,
}: {
  items: LookupOption[];
  value: string;
  onChange: (v: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = items
      .map((x) => String(x.itemCode ?? "").trim())
      .filter(Boolean);

    if (!q) return all.slice(0, 25);

    const startsWith = all.filter((c) => c.toLowerCase().startsWith(q));
    const contains = all.filter(
      (c) => !c.toLowerCase().startsWith(q) && c.toLowerCase().includes(q)
    );

    return [...startsWith, ...contains].slice(0, 25);
  }, [items, query]);

  function choose(v: string) {
    setQuery(v);
    onChange(v);
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        className={`input${error ? " input-error" : ""}`}
        value={query}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          onChange(next);
          setOpen(true);
        }}
        onFocus={() => !disabled && setOpen(true)}
        onKeyDown={(e) => {
          if (disabled) return;

          if (e.key === "Enter") {
            e.preventDefault();

            const exact = filtered.find(
              (x) => x.toLowerCase() === String(query ?? "").trim().toLowerCase()
            );

            if (exact) {
              choose(exact);
              return;
            }

            if (filtered.length === 1) {
              choose(filtered[0]);
            }
          }

          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Type item style..."
        autoComplete="off"
      />

      {!disabled && open && filtered.length > 0 ? (
        <div style={comboMenu}>
          {filtered.map((v) => (
            <button
              key={v}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(v)}
              style={comboItem}
            >
              {v}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function KnitProductionForm({ initialSubmissionId }: Props) {
  const router = useRouter();
  const isEditMode = !!initialSubmissionId;

  const [me, setMe] = useState<MeResponse | null>(null);
  const [items, setItems] = useState<LookupOption[]>([]);
  const [knitAreaOptions, setKnitAreaOptions] = useState<KnitAreaOption[]>([]);
  const [sessionAreas, setSessionAreas] = useState<WorkSessionArea[]>([]);
  const [openSession, setOpenSession] = useState<WorkSession | null>(null);

  const [loading, setLoading] = useState(isEditMode);
  const [sessionLoading, setSessionLoading] = useState(!isEditMode);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isVoided, setIsVoided] = useState(false);

  const initialState = resetFormState();

  const [entryTs, setEntryTs] = useState<string>(initialState.entryTs);
  const [stockOrder, setStockOrder] = useState(initialState.stockOrder);
  const [salesOrder, setSalesOrder] = useState(initialState.salesOrder);
  const [knitArea, setKnitArea] = useState(initialState.knitArea);
  const [notes, setNotes] = useState(initialState.notes);
  const [lines, setLines] = useState<Line[]>(initialState.lines);
  const [errors, setErrors] = useState<FormErrors>(initialState.errors);

  useEffect(() => {
    (async () => {
      try {
        const [meRes, itemsRes, knitAreaRes, sessionAreaRes] = await Promise.all([
          fetch("/api/me", { cache: "no-store", credentials: "include" }),
          fetch("/api/recuts/lookups/items", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/knit-production/lookups/knit-areas", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/platform/work-sessions/areas?moduleKey=knit_production", {
            cache: "no-store",
            credentials: "include",
          }),
        ]);

        let meData: MeResponse | null = null;

        if (meRes.ok) {
          meData = await meRes.json();
          setMe(meData);
        }

        if (itemsRes.ok) {
          const data = await itemsRes.json();
          setItems(Array.isArray(data?.rows) ? data.rows : []);
        }

        if (knitAreaRes.ok) {
          const data = await knitAreaRes.json();
          const rows = Array.isArray(data?.rows) ? data.rows : [];
          setKnitAreaOptions(rows);

          if (!isEditMode && rows.length > 0) {
            setKnitArea((prev) => prev || String(rows[0]?.areaName ?? ""));
          }
        }

        if (sessionAreaRes.ok) {
          const data = await sessionAreaRes.json();
          setSessionAreas(Array.isArray(data?.rows) ? data.rows : []);
        }

        if (!isEditMode && meData?.employeeNumber) {
          setSessionLoading(true);

          const sessionRes = await fetch(
            `/api/platform/work-sessions?moduleKey=knit_production&employeeNumber=${encodeURIComponent(
              String(meData.employeeNumber)
            )}&isOpen=true&limit=1&offset=0`,
            { cache: "no-store", credentials: "include" }
          );

          const sessionData = await sessionRes.json().catch(() => ({}));
          const rows = Array.isArray(sessionData?.rows) ? sessionData.rows : [];
          setOpenSession(rows[0] ?? null);
        }
      } catch {
        // ignore bootstrap errors
      } finally {
        setSessionLoading(false);
      }
    })();
  }, [isEditMode]);

  useEffect(() => {
    if (!isEditMode || !initialSubmissionId) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setServerError(null);

      try {
        const res = await fetch(
          `/api/knit-production-submission?id=${encodeURIComponent(initialSubmissionId)}&includeVoided=true`,
          {
            cache: "no-store",
            credentials: "include",
          }
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setServerError(data?.error || "Failed to load knit production submission.");
          setLoading(false);
          return;
        }

        const submission = data?.submission as LoadedSubmission;
        const loadedLines = Array.isArray(data?.lines) ? (data.lines as LoadedLine[]) : [];

        setIsVoided(!!submission?.isVoided);

        if (submission?.isVoided) {
          setServerError(
            submission?.voidReason
              ? `This submission has been voided and cannot be edited. Reason: ${submission.voidReason}`
              : "This submission has been voided and cannot be edited."
          );
        }

        setEntryTs(submission?.entryTs ?? new Date().toISOString());
        setStockOrder(!!submission?.stockOrder);
        setSalesOrder(submission?.salesOrder ? String(submission.salesOrder) : "");
        setKnitArea(submission?.knitArea ? String(submission.knitArea) : "");
        setNotes(submission?.notes ? String(submission.notes) : "");
        setLines(
          loadedLines.length > 0
            ? loadedLines.map((l) => ({
                detailNumber: l?.detailNumber != null ? String(l.detailNumber) : "",
                itemStyle: l?.itemStyle != null ? String(l.itemStyle) : "",
                logo: l?.logo != null ? String(l.logo) : "",
                quantity: l?.quantity != null ? String(l.quantity) : "",
                notes: l?.notes != null ? String(l.notes) : "",
              }))
            : [emptyLine()]
        );
      } catch {
        setServerError("Failed to load knit production submission.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditMode, initialSubmissionId]);

  useEffect(() => {
    if (!isEditMode && openSession?.areaCode) {
      const matched = knitAreaOptions.find(
        (x) =>
          String(x.areaName ?? "").trim().toUpperCase() ===
          String(openSession.areaCode).trim().toUpperCase()
      );

      if (matched?.areaName) {
        setKnitArea(String(matched.areaName));
      }
    }
  }, [isEditMode, openSession?.areaCode, knitAreaOptions]);

  function clearSalesOrderError() {
    setErrors((prev) => {
      if (!prev.salesOrder) return prev;
      return { ...prev, salesOrder: undefined };
    });
  }

  function clearKnitAreaError() {
    setErrors((prev) => {
      if (!prev.knitArea) return prev;
      return { ...prev, knitArea: undefined };
    });
  }

  function updateLine(index: number, key: keyof Line, value: string) {
    setLines((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });

    if (key === "detailNumber" || key === "itemStyle" || key === "quantity") {
      setErrors((prev) => {
        if (!prev.lines?.[index]?.[key]) return prev;

        const nextLines = [...(prev.lines ?? [])];
        nextLines[index] = {
          ...(nextLines[index] ?? {}),
          [key]: undefined,
        };

        return { ...prev, lines: nextLines };
      });
    }
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [emptyLine()];
    });

    setErrors((prev) => {
      const nextLines = [...(prev.lines ?? [])].filter((_, i) => i !== index);
      return { ...prev, lines: nextLines };
    });
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    const lineErrors: NonNullable<FormErrors["lines"]> = [];

    if (!salesOrder.trim()) {
      next.salesOrder = "Sales Order is required.";
    }

    if (!knitArea.trim()) {
      next.knitArea = "Knit Area is required.";
    }

    lines.forEach((line, idx) => {
      const rowErr: {
        detailNumber?: string;
        itemStyle?: string;
        quantity?: string;
      } = {};

      if (!line.detailNumber.trim()) {
        rowErr.detailNumber = "Required";
      } else if (!isWholeNumberString(line.detailNumber)) {
        rowErr.detailNumber = "Whole number only";
      }

      if (!line.itemStyle.trim()) {
        rowErr.itemStyle = "Required";
      }

      if (!line.quantity.trim()) {
        rowErr.quantity = "Required";
      } else if (!isWholeNumberString(line.quantity)) {
        rowErr.quantity = "Whole number only";
      }

      lineErrors[idx] = rowErr;
    });

    if (lineErrors.some((x) => Object.keys(x).length > 0)) {
      next.lines = lineErrors;
    }

    return next;
  }

  function resetForNewEntry() {
    const next = resetFormState();
    const defaultKnitArea =
      knitAreaOptions.length > 0 ? String(knitAreaOptions[0]?.areaName ?? "") : "";

    setEntryTs(next.entryTs);
    setStockOrder(next.stockOrder);
    setSalesOrder(next.salesOrder);
    setKnitArea(defaultKnitArea);
    setNotes(next.notes);
    setLines(next.lines);
    setErrors(next.errors);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setSuccessMsg(null);

    if (isVoided) {
      setServerError("Voided submissions cannot be edited.");
      return;
    }

    if (!isEditMode && !openSession?.id) {
      setServerError("You must start a knit production work session before submitting production.");
      return;
    }

    const nextErrors = validate();
    setErrors(nextErrors);

    const hasErrors =
      !!nextErrors.salesOrder ||
      !!nextErrors.knitArea ||
      !!nextErrors.lines?.some((x) => Object.keys(x || {}).length > 0);

    if (hasErrors) return;

    setSaving(true);

    try {
      const url = isEditMode
        ? `/api/knit-production-submission?id=${encodeURIComponent(initialSubmissionId || "")}`
        : "/api/knit-production-add";

      const method = isEditMode ? "PUT" : "POST";

      const payloadEntryTs = isEditMode && entryTs ? entryTs : new Date().toISOString();

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          entryTs: payloadEntryTs,
          stockOrder,
          salesOrder: salesOrder.trim(),
          knitArea: knitArea.trim(),
          sessionId: !isEditMode ? openSession?.id ?? null : null,
          notes: notes.trim() || null,
          lines: lines.map((l) => ({
            detailNumber: l.detailNumber.trim(),
            itemStyle: l.itemStyle.trim(),
            logo: l.logo.trim() || null,
            quantity: l.quantity.trim(),
            notes: l.notes.trim() || null,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Save failed.");
      }

      if (isEditMode) {
        router.push("/knit-production");
        router.refresh();
        return;
      }

      setSuccessMsg("Knit production created.");
      resetForNewEntry();
      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    } catch (err: any) {
      setServerError(err?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="section-stack">
        <div className="card">
          <div className="text-muted">Loading knit production submission…</div>
        </div>
      </div>
    );
  }

  const knitAreaLockedToSession = !isEditMode && !!openSession?.id;

  return (
    <div className="section-stack">
      <style>{`
        /* Header card: Sales Order / Knit Area / Stock Order */
        .knit-header-grid {
          display: grid;
          grid-template-columns: minmax(220px, 1fr) minmax(220px, 280px) 220px;
          gap: 12px;
          align-items: start;
        }

        /* Line row: Detail # / Item Style / Logo / Quantity (+ full-width Line Notes) */
        .knit-line-grid {
          display: grid;
          grid-template-columns: 140px minmax(220px, 1.5fr) minmax(160px, 1fr) 160px;
          gap: 12px;
        }

        @media (max-width: 860px) {
          .knit-header-grid,
          .knit-line-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {serverError ? <div className="alert alert-danger">{serverError}</div> : null}
      {successMsg ? <div className="alert alert-success">{successMsg}</div> : null}

      {isVoided ? (
        <div className="alert alert-danger">
          This submission is voided and is now read-only.
        </div>
      ) : null}

      <div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => router.push("/knit-production")}
        >
          ← Back to List
        </button>
      </div>

      {!isEditMode ? (
        <WorkSessionCard
          moduleKey="knit_production"
          moduleLabel="Knit Production"
          session={openSession}
          areas={sessionAreas}
          disabled={saving || sessionLoading || isVoided}
          onStarted={(session) => {
            setOpenSession(session);

            const matched = knitAreaOptions.find(
              (x) =>
                String(x.areaName ?? "").trim().toUpperCase() ===
                String(session.areaCode ?? "").trim().toUpperCase()
            );

            if (matched?.areaName) {
              setKnitArea(String(matched.areaName));
            }
          }}
          onClosed={() => {
            setOpenSession(null);
          }}
        />
      ) : null}

      <div>
        <h1 style={{ margin: 0, marginBottom: 6 }}>
          {isEditMode ? "Edit Knit Production Submission" : "Add Knit Production Entry"}
        </h1>
      </div>

      <form onSubmit={onSubmit} className="section-stack">
        <div className="card">
          <div className="knit-header-grid">
            <FieldBlock
              label="Sales Order"
              error={errors.salesOrder}
              required
              helperText={
                isEditMode
                  ? "Sales Order cannot be changed when editing an existing submission."
                  : "Enter a sales order reference."
              }
            >
              <input
                className={`input${errors.salesOrder ? " input-error" : ""}`}
                value={salesOrder}
                disabled={isEditMode || isVoided}
                readOnly={isEditMode || isVoided}
                onChange={(e) => {
                  setSalesOrder(e.target.value);
                  if (e.target.value.trim()) clearSalesOrderError();
                }}
                placeholder="3023113.001"
              />
            </FieldBlock>

            <FieldBlock
              label="Knit Area"
              error={errors.knitArea}
              required
              helperText={
                knitAreaLockedToSession
                  ? "Knit Area is locked to the active work session."
                  : "Select the knit production area for this submission."
              }
            >
              <select
                className={`select${errors.knitArea ? " input-error" : ""}`}
                value={knitArea}
                disabled={isVoided || knitAreaLockedToSession}
                onChange={(e) => {
                  setKnitArea(e.target.value);
                  if (e.target.value.trim()) clearKnitAreaError();
                }}
              >
                <option value="">Select Knit Area</option>
                {knitAreaOptions.map((opt) => (
                  <option key={opt.id} value={opt.areaName}>
                    {opt.areaName}
                  </option>
                ))}
              </select>
            </FieldBlock>

            <CheckboxBlock
              label="Stock Order?"
              checked={stockOrder}
              onChange={(checked) => {
                if (isVoided) return;
                setStockOrder(checked);
              }}
            />

            <FieldBlock label="Header Notes" full>
              <textarea
                className="textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                style={{ resize: "vertical" }}
                disabled={isVoided}
                placeholder="Optional notes that apply to the whole submission"
              />
            </FieldBlock>
          </div>
        </div>

        <div className="card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <h2 style={{ margin: 0 }}>Lines</h2>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={addLine}
              disabled={isVoided}
            >
              + Add Line
            </button>
          </div>

          <div className="section-stack">
            {lines.map((line, i) => {
              const rowErr = errors.lines?.[i] ?? {};

              return (
                <div
                  key={i}
                  className="muted-box"
                  style={{
                    border: "1px solid var(--border-strong)",
                    borderRadius: 6,
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <strong>Line {i + 1}</strong>

                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removeLine(i)}
                      disabled={lines.length === 1 || isVoided}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="knit-line-grid">
                    <FieldBlock label="Detail #" error={rowErr.detailNumber} required>
                      <input
                        className={`input${rowErr.detailNumber ? " input-error" : ""}`}
                        value={line.detailNumber}
                        onChange={(e) => updateLine(i, "detailNumber", e.target.value)}
                        inputMode="numeric"
                        disabled={isVoided}
                      />
                    </FieldBlock>

                    <FieldBlock label="Item Style" error={rowErr.itemStyle} required>
                      <ItemStyleCombobox
                        items={items}
                        value={line.itemStyle}
                        onChange={(v) => updateLine(i, "itemStyle", v)}
                        error={rowErr.itemStyle}
                        disabled={isVoided}
                      />
                    </FieldBlock>

                    <FieldBlock label="Logo">
                      <input
                        className="input"
                        value={line.logo}
                        onChange={(e) => updateLine(i, "logo", e.target.value)}
                        disabled={isVoided}
                      />
                    </FieldBlock>

                    <FieldBlock label="Quantity" error={rowErr.quantity} required>
                      <input
                        className={`input${rowErr.quantity ? " input-error" : ""}`}
                        value={line.quantity}
                        onChange={(e) => updateLine(i, "quantity", e.target.value)}
                        inputMode="numeric"
                        disabled={isVoided}
                      />
                    </FieldBlock>

                    <FieldBlock label="Line Notes" full>
                      <input
                        className="input"
                        value={line.notes}
                        onChange={(e) => updateLine(i, "notes", e.target.value)}
                        disabled={isVoided}
                        placeholder="Optional"
                      />
                    </FieldBlock>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {!isVoided ? (
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Saving..." : isEditMode ? "Save Changes" : "Save"}
            </button>
          ) : null}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/knit-production")}
            disabled={saving}
          >
            {isEditMode || isVoided ? "Cancel" : "Back to List"}
          </button>
        </div>
      </form>
    </div>
  );
}

const comboMenu: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  maxHeight: 260,
  overflowY: "auto",
  border: "1px solid var(--border-strong)",
  borderRadius: 10,
  background: "var(--surface)",
  boxShadow: "var(--shadow-md)",
  zIndex: 30,
};

const comboItem: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  border: "none",
  background: "var(--surface)",
  cursor: "pointer",
};