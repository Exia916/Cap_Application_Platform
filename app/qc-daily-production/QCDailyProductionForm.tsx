"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type SubmissionOption = {
  id: string;
  entryTs: string;
  salesOrder: string | null;
  notes: string | null;
  lineCount?: number;
};

type Line = {
  detailNumber: string;
  flatOr3d: string;
  orderQuantity: string;
  inspectedQuantity: string;
  rejectedQuantity: string;
  quantityShipped: string;
  notes: string;
};

function blankLine(): Line {
  return {
    detailNumber: "",
    flatOr3d: "FLAT",
    orderQuantity: "",
    inspectedQuantity: "",
    rejectedQuantity: "",
    quantityShipped: "",
    notes: "",
  };
}

function isWholeNumberString(v: any) {
  const s = v === null || v === undefined ? "" : String(v).trim();
  if (!s) return false;
  return /^\d+$/.test(s);
}

function isValidSalesOrderInput(v: any) {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return /^\d{7}.*$/.test(s);
}

function formatSubmissionLabel(s: SubmissionOption) {
  const dt = new Date(s.entryTs);
  const dtStr = Number.isNaN(dt.getTime()) ? s.entryTs : dt.toLocaleString();
  const so = s.salesOrder != null ? ` | SO ${s.salesOrder}` : "";
  const count = s.lineCount != null ? ` | ${s.lineCount} line(s)` : "";
  return `${dtStr}${so}${count}`;
}

type Props = { initialSubmissionId?: string };

type LineFieldErrors = {
  detailNumber?: string;
  flatOr3d?: string;
  orderQuantity?: string;
  inspectedQuantity?: string;
  rejectedQuantity?: string;
  quantityShipped?: string;
};

type FormErrors = {
  salesOrder?: string;
  lines?: LineFieldErrors[];
};

function hasErrors(e: FormErrors) {
  if (e.salesOrder) return true;
  if (e.lines && e.lines.some((x) => Object.keys(x).length > 0)) return true;
  return false;
}

export default function QCDailyProductionForm({ initialSubmissionId }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const isEditRoute = !!initialSubmissionId;

  const [salesOrder, setSalesOrder] = useState("");
  const [headerNotes, setHeaderNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);

  const [submissions, setSubmissions] = useState<SubmissionOption[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>(initialSubmissionId ?? "");

  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const canRemove = useMemo(() => lines.length > 1, [lines.length]);

  const salesOrderRef = useRef<HTMLInputElement | null>(null);
  const detailRefs = useRef<(HTMLInputElement | null)[]>([]);
  const flatRefs = useRef<(HTMLSelectElement | null)[]>([]);
  const orderRefs = useRef<(HTMLInputElement | null)[]>([]);
  const inspectedRefs = useRef<(HTMLInputElement | null)[]>([]);
  const rejectedRefs = useRef<(HTMLInputElement | null)[]>([]);
  const shippedRefs = useRef<(HTMLInputElement | null)[]>([]);

  function inputClass(hasErr?: boolean) {
    return hasErr ? "input input-error" : "input";
  }

  function selectClass(hasErr?: boolean) {
    return hasErr ? "select select-error" : "select";
  }

  function textareaClass(hasErr?: boolean) {
    return hasErr ? "textarea textarea-error" : "textarea";
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, blankLine()]);
    setErrors((prev) => ({
      ...prev,
      lines: prev.lines ? [...prev.lines, {}] : prev.lines,
    }));
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => {
      if (!prev.lines) return prev;
      return { ...prev, lines: prev.lines.filter((_, i) => i !== index) };
    });

    detailRefs.current.splice(index, 1);
    flatRefs.current.splice(index, 1);
    orderRefs.current.splice(index, 1);
    inspectedRefs.current.splice(index, 1);
    rejectedRefs.current.splice(index, 1);
    shippedRefs.current.splice(index, 1);
  }

  function validateClient(): FormErrors {
    const next: FormErrors = {};

    if (!salesOrder.trim()) next.salesOrder = "Sales Order is required.";
    else if (!isValidSalesOrderInput(salesOrder)) {
      next.salesOrder = "Sales Order must begin with 7 digits.";
    }

    const lineErrors: LineFieldErrors[] = lines.map((l) => {
      const le: LineFieldErrors = {};

      if (!String(l.detailNumber ?? "").trim()) le.detailNumber = "Detail # is required.";
      else if (!isWholeNumberString(l.detailNumber)) le.detailNumber = "Detail # must be a whole number.";

      if (!String(l.flatOr3d ?? "").trim()) le.flatOr3d = "Flat / 3D is required.";

      if (!String(l.orderQuantity ?? "").trim()) le.orderQuantity = "Order Qty is required.";
      else if (!isWholeNumberString(l.orderQuantity)) le.orderQuantity = "Order Qty must be a whole number.";

      if (!String(l.inspectedQuantity ?? "").trim()) le.inspectedQuantity = "Inspected Qty is required.";
      else if (!isWholeNumberString(l.inspectedQuantity)) le.inspectedQuantity = "Inspected Qty must be a whole number.";

      if (!String(l.rejectedQuantity ?? "").trim()) le.rejectedQuantity = "Rejected Qty is required.";
      else if (!isWholeNumberString(l.rejectedQuantity)) le.rejectedQuantity = "Rejected Qty must be a whole number.";

      if (!String(l.quantityShipped ?? "").trim()) le.quantityShipped = "Qty Shipped is required.";
      else if (!isWholeNumberString(l.quantityShipped)) le.quantityShipped = "Qty Shipped must be a whole number.";

      return le;
    });

    if (lineErrors.some((le) => Object.keys(le).length > 0)) next.lines = lineErrors;
    return next;
  }

  function clearSalesOrderError() {
    setErrors((prev) => ({ ...prev, salesOrder: undefined }));
  }

  function clearLineFieldError(index: number, field: keyof LineFieldErrors) {
    setErrors((prev) => {
      if (!prev.lines) return prev;
      const nextLines = [...prev.lines];
      const cur = nextLines[index] ?? {};
      nextLines[index] = { ...cur, [field]: undefined };
      return { ...prev, lines: nextLines };
    });
  }

  function scrollToFirstError(v: FormErrors) {
    if (v.salesOrder && salesOrderRef.current) {
      salesOrderRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      salesOrderRef.current.focus();
      return;
    }

    if (v.lines) {
      for (let i = 0; i < v.lines.length; i++) {
        const le = v.lines[i];
        if (!le) continue;

        if (le.detailNumber && detailRefs.current[i]) {
          detailRefs.current[i]!.scrollIntoView({ behavior: "smooth", block: "center" });
          detailRefs.current[i]!.focus();
          return;
        }
        if (le.flatOr3d && flatRefs.current[i]) {
          flatRefs.current[i]!.scrollIntoView({ behavior: "smooth", block: "center" });
          flatRefs.current[i]!.focus();
          return;
        }
        if (le.orderQuantity && orderRefs.current[i]) {
          orderRefs.current[i]!.scrollIntoView({ behavior: "smooth", block: "center" });
          orderRefs.current[i]!.focus();
          return;
        }
        if (le.inspectedQuantity && inspectedRefs.current[i]) {
          inspectedRefs.current[i]!.scrollIntoView({ behavior: "smooth", block: "center" });
          inspectedRefs.current[i]!.focus();
          return;
        }
        if (le.rejectedQuantity && rejectedRefs.current[i]) {
          rejectedRefs.current[i]!.scrollIntoView({ behavior: "smooth", block: "center" });
          rejectedRefs.current[i]!.focus();
          return;
        }
        if (le.quantityShipped && shippedRefs.current[i]) {
          shippedRefs.current[i]!.scrollIntoView({ behavior: "smooth", block: "center" });
          shippedRefs.current[i]!.focus();
          return;
        }
      }
    }
  }

  async function loadSubmission(submissionId: string) {
    setServerError(null);
    setSuccessMsg(null);
    setErrors({});

    const res = await fetch(`/api/qc-daily-production-submission?id=${encodeURIComponent(submissionId)}`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Failed to load submission.");

    const submission = data?.submission;
    const loadedLines = Array.isArray(data?.lines) ? data.lines : [];

    if (submission?.salesOrder != null) setSalesOrder(String(submission.salesOrder));
    setHeaderNotes(submission?.notes ?? "");

    setLines(
      loadedLines.length > 0
        ? loadedLines.map((l: any) => ({
            detailNumber: l?.detailNumber != null ? String(l.detailNumber) : "",
            flatOr3d: (l?.flatOr3d ?? "FLAT").toString().toUpperCase(),
            orderQuantity: l?.orderQuantity != null ? String(l.orderQuantity) : "",
            inspectedQuantity: l?.inspectedQuantity != null ? String(l.inspectedQuantity) : "",
            rejectedQuantity: l?.rejectedQuantity != null ? String(l.rejectedQuantity) : "",
            quantityShipped: l?.quantityShipped != null ? String(l.quantityShipped) : "",
            notes: l?.notes != null ? String(l.notes) : "",
          }))
        : [blankLine()]
    );
  }

  useEffect(() => {
    if (!initialSubmissionId) return;
    setSelectedSubmissionId(initialSubmissionId);

    (async () => {
      try {
        await loadSubmission(initialSubmissionId);
      } catch (e: any) {
        setServerError(e?.message ?? "Failed to load submission.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSubmissionId]);

  useEffect(() => {
    if (isEditRoute) return;

    setSubmissions([]);
    setSelectedSubmissionId("");

    const so = salesOrder.trim();
    if (!isValidSalesOrderInput(so)) return;

    const handle = setTimeout(async () => {
      setLoadingSubmissions(true);
      try {
        const res = await fetch(`/api/qc-daily-production-submissions?salesOrder=${encodeURIComponent(so)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        const list = Array.isArray(data?.submissions) ? data.submissions : [];
        setSubmissions(
          list.map((s: any) => ({
            id: String(s.id),
            entryTs: String(s.entryTs),
            salesOrder: s.salesOrder == null ? null : String(s.salesOrder),
            notes: s.notes == null ? null : String(s.notes),
            lineCount: s.lineCount == null ? undefined : Number(s.lineCount),
          }))
        );
      } catch {
        setSubmissions([]);
      } finally {
        setLoadingSubmissions(false);
      }
    }, 350);

    return () => clearTimeout(handle);
  }, [salesOrder, isEditRoute]);

  useEffect(() => {
    if (isEditRoute) return;
    if (!selectedSubmissionId) return;

    (async () => {
      try {
        await loadSubmission(selectedSubmissionId);
      } catch (e: any) {
        setServerError(e?.message ?? "Failed to load submission.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubmissionId, isEditRoute]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setSuccessMsg(null);

    const v = validateClient();
    setErrors(v);

    if (hasErrors(v)) {
      setTimeout(() => scrollToFirstError(v), 50);
      return;
    }

    setSaving(true);
    try {
      const isUpdate = !!selectedSubmissionId && isEditRoute;

      const url = isUpdate
        ? `/api/qc-daily-production-submission?id=${encodeURIComponent(selectedSubmissionId)}`
        : "/api/qc-daily-production-add";

      const method = isUpdate ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryTs: new Date().toISOString(),
          salesOrder: salesOrder.trim(),
          notes: headerNotes.trim() || null,
          lines: lines.map((l) => ({
            detailNumber: l.detailNumber.trim(),
            flatOr3d: l.flatOr3d.trim(),
            orderQuantity: l.orderQuantity,
            inspectedQuantity: l.inspectedQuantity,
            rejectedQuantity: l.rejectedQuantity,
            quantityShipped: l.quantityShipped,
            notes: l.notes.trim() || null,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to save.");

      setSuccessMsg(
        isUpdate
          ? `Updated ${data?.count ?? lines.length} line(s).`
          : `Saved ${data?.count ?? lines.length} line(s).`
      );

      setErrors({});

      if (isEditRoute) {
        router.push("/qc-daily-production");
      } else {
        setHeaderNotes("");
        setLines([blankLine()]);
        setSelectedSubmissionId("");
      }
    } catch (err: any) {
      setServerError(err?.message ?? "Unexpected error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section-stack">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">
            {isEditRoute ? "Edit QC Daily Production Submission" : "QC Daily Production Entry"}
          </h1>
          <p className="page-subtitle">
            Enter submission details and QC line results. Required fields are marked with *.
          </p>
        </div>

        <div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/qc-daily-production")}
          >
            ← Back to List
          </button>
        </div>
      </div>

      <form onSubmit={onSubmit} className="section-stack">
        <section className="card card-lg">
          <div className="section-card-header">
            <div>
              <h2 className="mb-1 text-lg font-bold">Submission Details</h2>
              <p className="text-sm text-soft m-0">
                Enter the sales order and any submission-level notes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            <div className="md:col-span-5">
              <label className="field-label">
                Sales Order <span className="text-red-600">*</span>
              </label>
              <input
                ref={salesOrderRef}
                value={salesOrder}
                onChange={(e) => {
                  setSalesOrder(e.target.value);
                  clearSalesOrderError();
                }}
                readOnly={isEditRoute}
                className={inputClass(!!errors.salesOrder)}
                placeholder="1234567 or 1234567.001"
              />
              {errors.salesOrder ? <div className="field-error">{errors.salesOrder}</div> : null}
              <div className="field-help">
                Enter the order reference. The system uses the first 7 digits as the base Sales Order.
              </div>
            </div>

            <div className="md:col-span-7">
              <label className="field-label">Header Notes</label>
              <textarea
                value={headerNotes}
                onChange={(e) => setHeaderNotes(e.target.value)}
                className={textareaClass(false)}
                placeholder="Optional notes that apply to the whole submission"
                rows={3}
              />
            </div>
          </div>
        </section>

        <section className="card card-lg">
          <div className="section-card-header">
            <div>
              <h2 className="mb-1 text-lg font-bold">QC Lines</h2>
              <p className="text-sm text-soft m-0">
                Add one or more QC line results for this submission.
              </p>
            </div>

            <button type="button" onClick={addLine} className="btn btn-secondary">
              + Add Line
            </button>
          </div>

          <div className="space-y-4">
            {lines.map((line, idx) => {
              const le = errors.lines?.[idx] ?? {};

              return (
                <div key={idx} className="card border border-[var(--border)] bg-[var(--surface-subtle)]">
                  <div className="section-card-header">
                    <div className="flex items-center gap-3">
                      <div className="badge badge-brand-blue">Line {idx + 1}</div>
                      <span className="text-sm text-soft">
                        {line.detailNumber ? `Detail #${line.detailNumber}` : "New line"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      disabled={!canRemove}
                      className="btn btn-danger btn-sm"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                    <div className="md:col-span-2">
                      <label className="field-label">
                        Detail # <span className="text-red-600">*</span>
                      </label>
                      <input
                        ref={(el) => {
                          detailRefs.current[idx] = el;
                        }}
                        value={line.detailNumber}
                        onChange={(e) => {
                          updateLine(idx, { detailNumber: e.target.value });
                          clearLineFieldError(idx, "detailNumber");
                        }}
                        className={inputClass(!!le.detailNumber)}
                        inputMode="numeric"
                        placeholder="1"
                      />
                      {le.detailNumber ? <div className="field-error">{le.detailNumber}</div> : null}
                    </div>

                    <div className="md:col-span-2">
                      <label className="field-label">
                        Flat / 3D <span className="text-red-600">*</span>
                      </label>
                      <select
                        ref={(el) => {
                          flatRefs.current[idx] = el;
                        }}
                        value={line.flatOr3d}
                        onChange={(e) => {
                          updateLine(idx, { flatOr3d: e.target.value });
                          clearLineFieldError(idx, "flatOr3d");
                        }}
                        className={selectClass(!!le.flatOr3d)}
                      >
                        <option value="FLAT">FLAT</option>
                        <option value="3D">3D</option>
                      </select>
                      {le.flatOr3d ? <div className="field-error">{le.flatOr3d}</div> : null}
                    </div>

                    <div className="md:col-span-2">
                      <label className="field-label">
                        Order Qty <span className="text-red-600">*</span>
                      </label>
                      <input
                        ref={(el) => {
                          orderRefs.current[idx] = el;
                        }}
                        value={line.orderQuantity}
                        onChange={(e) => {
                          updateLine(idx, { orderQuantity: e.target.value });
                          clearLineFieldError(idx, "orderQuantity");
                        }}
                        className={inputClass(!!le.orderQuantity)}
                        inputMode="numeric"
                        placeholder="0"
                      />
                      {le.orderQuantity ? <div className="field-error">{le.orderQuantity}</div> : null}
                    </div>

                    <div className="md:col-span-2">
                      <label className="field-label">
                        Inspected Qty <span className="text-red-600">*</span>
                      </label>
                      <input
                        ref={(el) => {
                          inspectedRefs.current[idx] = el;
                        }}
                        value={line.inspectedQuantity}
                        onChange={(e) => {
                          updateLine(idx, { inspectedQuantity: e.target.value });
                          clearLineFieldError(idx, "inspectedQuantity");
                        }}
                        className={inputClass(!!le.inspectedQuantity)}
                        inputMode="numeric"
                        placeholder="0"
                      />
                      {le.inspectedQuantity ? <div className="field-error">{le.inspectedQuantity}</div> : null}
                    </div>

                    <div className="md:col-span-2">
                      <label className="field-label">
                        Rejected Qty <span className="text-red-600">*</span>
                      </label>
                      <input
                        ref={(el) => {
                          rejectedRefs.current[idx] = el;
                        }}
                        value={line.rejectedQuantity}
                        onChange={(e) => {
                          updateLine(idx, { rejectedQuantity: e.target.value });
                          clearLineFieldError(idx, "rejectedQuantity");
                        }}
                        className={inputClass(!!le.rejectedQuantity)}
                        inputMode="numeric"
                        placeholder="0"
                      />
                      {le.rejectedQuantity ? <div className="field-error">{le.rejectedQuantity}</div> : null}
                    </div>

                    <div className="md:col-span-2">
                      <label className="field-label">
                        Qty Shipped <span className="text-red-600">*</span>
                      </label>
                      <input
                        ref={(el) => {
                          shippedRefs.current[idx] = el;
                        }}
                        value={line.quantityShipped}
                        onChange={(e) => {
                          updateLine(idx, { quantityShipped: e.target.value });
                          clearLineFieldError(idx, "quantityShipped");
                        }}
                        className={inputClass(!!le.quantityShipped)}
                        inputMode="numeric"
                        placeholder="0"
                      />
                      {le.quantityShipped ? <div className="field-error">{le.quantityShipped}</div> : null}
                    </div>

                    <div className="md:col-span-12">
                      <label className="field-label">Line Notes</label>
                      <textarea
                        value={line.notes}
                        onChange={(e) => updateLine(idx, { notes: e.target.value })}
                        className={textareaClass(false)}
                        placeholder="Optional"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {serverError ? <div className="alert alert-danger">{serverError}</div> : null}
        {successMsg ? <div className="alert alert-success">{successMsg}</div> : null}

        <div className="sticky-actions">
          <div className="flex flex-wrap gap-2 pt-3">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Saving..." : isEditRoute ? "Update Submission" : "Save"}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => router.push("/qc-daily-production")}
              disabled={saving}
            >
              {isEditRoute ? "Cancel" : "Back to List"}
            </button>

            <button
              type="button"
              onClick={addLine}
              className="btn btn-secondary"
              disabled={saving}
            >
              + Add Line
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}