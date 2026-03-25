"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Line = {
  detailNumber: string;
  logo: string;
  orderQuantity: string;
  inspectedQuantity: string;
  rejectedQuantity: string;
  rejectReasonId: string;
  qcEmployeeNumber: string;
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
  detailNumber: number | null;
  logo: string | null;
  orderQuantity: number | null;
  inspectedQuantity: number | null;
  rejectedQuantity: number | null;
  rejectReasonId: string | null;
  qcEmployeeNumber: number | null;
  notes: string | null;
};

type Props = {
  initialSubmissionId?: string;
};

type FormErrors = {
  salesOrder?: string;
  lines?: Array<{
    detailNumber?: string;
    orderQuantity?: string;
    inspectedQuantity?: string;
    rejectedQuantity?: string;
    qcEmployeeNumber?: string;
  }>;
};

function isWholeNumberString(v: string) {
  return /^\d+$/.test(String(v ?? "").trim());
}

function emptyLine(): Line {
  return {
    detailNumber: "",
    logo: "",
    orderQuantity: "",
    inspectedQuantity: "",
    rejectedQuantity: "",
    rejectReasonId: "",
    qcEmployeeNumber: "",
    notes: "",
  };
}

function resetFormState() {
  return {
    entryTs: new Date().toISOString(),
    stockOrder: false,
    salesOrder: "",
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
    <div style={full ? { gridColumn: "1 / -1", minWidth: 0 } : { minWidth: 0 }}>
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
    <div style={{ minWidth: 0 }}>
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

export default function KnitQcForm({ initialSubmissionId }: Props) {
  const router = useRouter();
  const isEditMode = !!initialSubmissionId;

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isVoided, setIsVoided] = useState(false);

  const [reasons, setReasons] = useState<{ id: string; label: string }[]>([]);
  const [employees, setEmployees] = useState<
    {
      employeeNumber: number | null;
      displayName: string | null;
    }[]
  >([]);

  const initialState = resetFormState();

  const [entryTs, setEntryTs] = useState<string>(initialState.entryTs);
  const [stockOrder, setStockOrder] = useState(initialState.stockOrder);
  const [salesOrder, setSalesOrder] = useState(initialState.salesOrder);
  const [notes, setNotes] = useState(initialState.notes);
  const [lines, setLines] = useState<Line[]>(initialState.lines);
  const [errors, setErrors] = useState<FormErrors>(initialState.errors);

  useEffect(() => {
    (async () => {
      try {
        const [reasonsRes, usersRes] = await Promise.all([
          fetch("/api/knit-qc-reject-reasons", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/knit-qc-users", {
            cache: "no-store",
            credentials: "include",
          }),
        ]);

        if (reasonsRes.ok) {
          const reasonsData = await reasonsRes.json().catch(() => ({}));
          setReasons(Array.isArray(reasonsData?.reasons) ? reasonsData.reasons : []);
        }

        if (usersRes.ok) {
          const usersData = await usersRes.json().catch(() => ({}));
          setEmployees(Array.isArray(usersData?.users) ? usersData.users : []);
        }
      } catch {
        // ignore bootstrap errors
      }
    })();
  }, []);

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
          `/api/knit-qc-submission?id=${encodeURIComponent(initialSubmissionId)}&includeVoided=true`,
          {
            cache: "no-store",
            credentials: "include",
          }
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setServerError(data?.error || "Failed to load knit QC submission.");
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
        setSalesOrder(
          submission?.salesOrderDisplay
            ? String(submission.salesOrderDisplay)
            : submission?.salesOrder
              ? String(submission.salesOrder)
              : ""
        );
        setNotes(submission?.notes ? String(submission.notes) : "");
        setLines(
          loadedLines.length > 0
            ? loadedLines.map((l) => ({
                detailNumber: l?.detailNumber != null ? String(l.detailNumber) : "",
                logo: l?.logo != null ? String(l.logo) : "",
                orderQuantity: l?.orderQuantity != null ? String(l.orderQuantity) : "",
                inspectedQuantity: l?.inspectedQuantity != null ? String(l.inspectedQuantity) : "",
                rejectedQuantity: l?.rejectedQuantity != null ? String(l.rejectedQuantity) : "",
                rejectReasonId: l?.rejectReasonId != null ? String(l.rejectReasonId) : "",
                qcEmployeeNumber:
                  l?.qcEmployeeNumber != null ? String(l.qcEmployeeNumber) : "",
                notes: l?.notes != null ? String(l.notes) : "",
              }))
            : [emptyLine()]
        );
      } catch {
        setServerError("Failed to load knit QC submission.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditMode, initialSubmissionId]);

  function clearSalesOrderError() {
    setErrors((prev) => {
      if (!prev.salesOrder) return prev;
      return { ...prev, salesOrder: undefined };
    });
  }

  function updateLine(index: number, key: keyof Line, value: string) {
    setLines((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });

    if (
      key === "detailNumber" ||
      key === "orderQuantity" ||
      key === "inspectedQuantity" ||
      key === "rejectedQuantity" ||
      key === "qcEmployeeNumber"
    ) {
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

    if (!stockOrder && !salesOrder.trim()) {
      next.salesOrder = "Sales Order is required.";
    }

    lines.forEach((line, idx) => {
      const rowErr: {
        detailNumber?: string;
        orderQuantity?: string;
        inspectedQuantity?: string;
        rejectedQuantity?: string;
        qcEmployeeNumber?: string;
      } = {};

      if (!line.detailNumber.trim()) {
        rowErr.detailNumber = "Required";
      } else if (!isWholeNumberString(line.detailNumber)) {
        rowErr.detailNumber = "Whole number only";
      }

      if (!line.orderQuantity.trim()) {
        rowErr.orderQuantity = "Required";
      } else if (!isWholeNumberString(line.orderQuantity)) {
        rowErr.orderQuantity = "Whole number only";
      }

      if (!line.inspectedQuantity.trim()) {
        rowErr.inspectedQuantity = "Required";
      } else if (!isWholeNumberString(line.inspectedQuantity)) {
        rowErr.inspectedQuantity = "Whole number only";
      }

      if (line.rejectedQuantity.trim() && !isWholeNumberString(line.rejectedQuantity)) {
        rowErr.rejectedQuantity = "Whole number only";
      }

      if (line.qcEmployeeNumber.trim() && !isWholeNumberString(line.qcEmployeeNumber)) {
        rowErr.qcEmployeeNumber = "Whole number only";
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
    setEntryTs(next.entryTs);
    setStockOrder(next.stockOrder);
    setSalesOrder(next.salesOrder);
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

    const nextErrors = validate();
    setErrors(nextErrors);

    const hasErrors =
      !!nextErrors.salesOrder ||
      !!nextErrors.lines?.some((x) => Object.keys(x || {}).length > 0);

    if (hasErrors) return;

    setSaving(true);

    try {
      const url = isEditMode
        ? `/api/knit-qc-submission?id=${encodeURIComponent(initialSubmissionId || "")}`
        : "/api/knit-qc-add";

      const method = isEditMode ? "PUT" : "POST";
      const payloadEntryTs = isEditMode && entryTs ? entryTs : new Date().toISOString();

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          entryTs: payloadEntryTs,
          stockOrder,
          salesOrder: salesOrder.trim() || null,
          notes: notes.trim() || null,
          lines: lines.map((l) => ({
            detailNumber: l.detailNumber.trim(),
            logo: l.logo.trim() || null,
            orderQuantity: l.orderQuantity.trim(),
            inspectedQuantity: l.inspectedQuantity.trim(),
            rejectedQuantity: l.rejectedQuantity.trim() || null,
            rejectReasonId: l.rejectReasonId.trim() || null,
            qcEmployeeNumber: l.qcEmployeeNumber.trim() || null,
            notes: l.notes.trim() || null,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Save failed.");
      }

      if (isEditMode) {
        router.push("/knit-qc");
        router.refresh();
        return;
      }

      setSuccessMsg("Knit QC entry created.");
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
          <div className="text-muted">Loading knit QC submission…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="section-stack">
      <style>{`
        /* Header card: Sales Order / Stock Order */
        .knitqc-header-grid {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) 220px;
          gap: 12px;
          align-items: start;
        }

        /* Line row: 7 fields auto-fit, Line Notes spans full width */
        .knitqc-line-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 12px;
          align-items: start;
        }

        @media (max-width: 640px) {
          .knitqc-header-grid,
          .knitqc-line-grid {
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
          onClick={() => router.push("/knit-qc")}
        >
          ← Back to List
        </button>
      </div>

      <div>
        <h1 style={{ margin: 0, marginBottom: 6 }}>
          {isEditMode ? "Edit Knit QC Submission" : "Add Knit QC Entry"}
        </h1>
      </div>

      <form onSubmit={onSubmit} className="section-stack">
        <div className="card">
          <div className="knitqc-header-grid">
            <FieldBlock
              label="Sales Order"
              error={errors.salesOrder}
              required={!stockOrder}
              helperText={
                isEditMode
                  ? "Sales Order cannot be changed when editing an existing submission."
                  : stockOrder
                    ? "Optional for stock orders, but still allowed."
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

            <CheckboxBlock
              label="Stock Order?"
              checked={stockOrder}
              onChange={(checked) => {
                if (isVoided) return;
                setStockOrder(checked);
                if (!checked && salesOrder.trim()) {
                  clearSalesOrderError();
                }
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
                    overflow: "hidden",
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

                  <div className="knitqc-line-grid">
                    <FieldBlock label="Detail #" error={rowErr.detailNumber} required>
                      <input
                        className={`input${rowErr.detailNumber ? " input-error" : ""}`}
                        value={line.detailNumber}
                        onChange={(e) => updateLine(i, "detailNumber", e.target.value)}
                        inputMode="numeric"
                        disabled={isVoided}
                      />
                    </FieldBlock>

                    <FieldBlock label="Logo">
                      <input
                        className="input"
                        value={line.logo}
                        onChange={(e) => updateLine(i, "logo", e.target.value)}
                        disabled={isVoided}
                        placeholder="Optional"
                      />
                    </FieldBlock>

                    <FieldBlock label="Order Qty" error={rowErr.orderQuantity} required>
                      <input
                        className={`input${rowErr.orderQuantity ? " input-error" : ""}`}
                        value={line.orderQuantity}
                        onChange={(e) => updateLine(i, "orderQuantity", e.target.value)}
                        inputMode="numeric"
                        disabled={isVoided}
                      />
                    </FieldBlock>

                    <FieldBlock label="Inspected Qty" error={rowErr.inspectedQuantity} required>
                      <input
                        className={`input${rowErr.inspectedQuantity ? " input-error" : ""}`}
                        value={line.inspectedQuantity}
                        onChange={(e) => updateLine(i, "inspectedQuantity", e.target.value)}
                        inputMode="numeric"
                        disabled={isVoided}
                      />
                    </FieldBlock>

                    <FieldBlock label="Rejected Qty" error={rowErr.rejectedQuantity}>
                      <input
                        className={`input${rowErr.rejectedQuantity ? " input-error" : ""}`}
                        value={line.rejectedQuantity}
                        onChange={(e) => updateLine(i, "rejectedQuantity", e.target.value)}
                        inputMode="numeric"
                        disabled={isVoided}
                        placeholder="Optional"
                      />
                    </FieldBlock>

                    <FieldBlock label="Reject Reason">
                      <select
                        className="select"
                        value={line.rejectReasonId}
                        onChange={(e) => updateLine(i, "rejectReasonId", e.target.value)}
                        disabled={isVoided}
                      >
                        <option value="">-- Optional --</option>
                        {reasons.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </FieldBlock>

                    <FieldBlock label="Employee" error={rowErr.qcEmployeeNumber}>
                      <select
                        className={`select${rowErr.qcEmployeeNumber ? " input-error" : ""}`}
                        value={line.qcEmployeeNumber}
                        onChange={(e) => updateLine(i, "qcEmployeeNumber", e.target.value)}
                        disabled={isVoided}
                      >
                        <option value="">-- Optional --</option>
                        {employees.map((u) => (
                          <option
                            key={String(u.employeeNumber ?? "")}
                            value={u.employeeNumber != null ? String(u.employeeNumber) : ""}
                          >
                            {(u.displayName || "").trim()}
                            {u.employeeNumber != null ? ` (#${u.employeeNumber})` : ""}
                          </option>
                        ))}
                      </select>
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
            onClick={() => router.push("/knit-qc")}
            disabled={saving}
          >
            {isEditMode || isVoided ? "Cancel" : "Back to List"}
          </button>
        </div>
      </form>
    </div>
  );
}