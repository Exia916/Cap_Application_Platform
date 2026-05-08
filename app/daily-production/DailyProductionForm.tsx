"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type LocationOption = { value: string; label: string };
type MachineOption = { value: string; label: string };

type Line = {
  detailNumber: string;
  embroideryLocation: string;
  stitches: string;
  pieces: string;
  jobberSamplesRan: string;
  is3d: boolean;
  isKnit: boolean;
  detailComplete: boolean;
  notes: string;
};

function blankLine(): Line {
  return {
    detailNumber: "",
    embroideryLocation: "",
    stitches: "",
    pieces: "",
    jobberSamplesRan: "",
    is3d: false,
    isKnit: false,
    detailComplete: false,
    notes: "",
  };
}

type DailyProductionFormProps = {
  initialSubmissionId?: string;
};

type LineFieldErrors = {
  detailNumber?: string;
  embroideryLocation?: string;
  stitches?: string;
  pieces?: string;
  jobberSamplesRan?: string;
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

function isWholeNumberString(v: string) {
  const s = String(v ?? "").trim();
  if (!s) return false;
  return /^\d+$/.test(s);
}

function isValidSalesOrderInput(v: string) {
  const s = String(v ?? "").trim();
  return /^\d{7}.*$/.test(s);
}

export default function DailyProductionForm(props: DailyProductionFormProps) {
  const { initialSubmissionId } = props;

  const router = useRouter();
  const isEditMode = !!initialSubmissionId;

  const [salesOrder, setSalesOrder] = useState("");
  const [machineNumber, setMachineNumber] = useState("");
  const [headerNotes, setHeaderNotes] = useState("");

  const [annex, setAnnex] = useState(false);
  const annexTouchedRef = useRef(false);
  const originalEntryTsRef = useRef<string | null>(null);

  const [lines, setLines] = useState<Line[]>([blankLine()]);

  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [machineOptions, setMachineOptions] = useState<MachineOption[]>([]);

  const [saving, setSaving] = useState(false);
  const [loadingSubmission, setLoadingSubmission] = useState(!!initialSubmissionId);

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const canRemove = useMemo(() => lines.length > 1, [lines.length]);

  const salesOrderRef = useRef<HTMLInputElement | null>(null);
  const detailRefs = useRef<(HTMLInputElement | null)[]>([]);
  const locRefs = useRef<(HTMLSelectElement | null)[]>([]);
  const stitchesRefs = useRef<(HTMLInputElement | null)[]>([]);
  const piecesRefs = useRef<(HTMLInputElement | null)[]>([]);
  const jobberRefs = useRef<(HTMLInputElement | null)[]>([]);

  function inputClass(isError: boolean) {
    return `${isError ? "input input-error" : "input"}`;
  }

  function selectClass(isError: boolean) {
    return `${isError ? "select select-error" : "select"}`;
  }

  function textareaClass(isError: boolean) {
    return `${isError ? "textarea textarea-error" : "textarea"}`;
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem("dp_last_machine");
      if (saved && !machineNumber) setMachineNumber(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (machineNumber) localStorage.setItem("dp_last_machine", machineNumber);
    } catch {}
  }, [machineNumber]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/embroidery-locations", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();

        const opts: LocationOption[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.options)
            ? data.options
            : Array.isArray(data?.locations)
              ? data.locations.map((l: any) => ({
                  value: String(l.value ?? l.id ?? l.name),
                  label: String(l.label ?? l.name ?? l.value ?? l.id),
                }))
              : [];

        setLocationOptions(opts);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/machines", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();

        const opts: MachineOption[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.options)
            ? data.options
            : Array.isArray(data?.machines)
              ? data.machines.map((m: any) => ({
                  value: String(m.value ?? m.machineNumber ?? m.id ?? m.name),
                  label: String(m.label ?? m.machineName ?? m.name ?? m.machineNumber ?? m.value ?? m.id),
                }))
              : [];

        setMachineOptions(opts);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();

        const dept = String((data as any)?.department ?? "").toLowerCase().trim();
        const shouldAnnex = dept === "annex embroidery";

        if (!annexTouchedRef.current) {
          setAnnex(shouldAnnex);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!initialSubmissionId) return;

    (async () => {
      try {
        setLoadingSubmission(true);
        setServerError(null);
        setSuccessMsg(null);

        const res = await fetch(`/api/daily-production-submission?id=${encodeURIComponent(initialSubmissionId)}`, {
          cache: "no-store",
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Failed to load submission.");

        const submission = data?.submission;
        const loadedLines = Array.isArray(data?.lines) ? data.lines : [];

        originalEntryTsRef.current = submission?.entryTs ? String(submission.entryTs) : null;

        if (submission?.salesOrder != null) setSalesOrder(String(submission.salesOrder));
        setHeaderNotes(submission?.notes ?? "");
        if (submission?.machineNumber != null) setMachineNumber(String(submission.machineNumber));

        if (submission?.annex != null) {
          annexTouchedRef.current = true;
          setAnnex(!!submission.annex);
        }

        setLines(
          loadedLines.length > 0
            ? loadedLines.map((l: any) => ({
                detailNumber: l?.detailNumber != null ? String(l.detailNumber) : "",
                embroideryLocation: l?.embroideryLocation != null ? String(l.embroideryLocation) : "",
                stitches: l?.stitches != null ? String(l.stitches) : "",
                pieces: l?.pieces != null ? String(l.pieces) : "",
                jobberSamplesRan: l?.jobberSamplesRan != null ? String(l.jobberSamplesRan) : "",
                is3d: !!l?.is3d,
                isKnit: !!l?.isKnit,
                detailComplete: !!l?.detailComplete,
                notes: l?.notes ?? "",
              }))
            : [blankLine()]
        );
      } catch (err: any) {
        setServerError(err?.message ?? "Failed to load submission.");
      } finally {
        setLoadingSubmission(false);
      }
    })();
  }, [initialSubmissionId]);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, blankLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => {
      if (!prev.lines) return prev;
      const next = [...prev.lines];
      next.splice(index, 1);
      return { ...prev, lines: next };
    });
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

      if (!l.embroideryLocation.trim()) le.embroideryLocation = "Location is required.";

      if (!String(l.stitches ?? "").trim()) le.stitches = "Stitches is required.";
      else if (!isWholeNumberString(l.stitches)) le.stitches = "Stitches must be a whole number.";

      if (!String(l.pieces ?? "").trim()) le.pieces = "Pieces is required.";
      else if (!isWholeNumberString(l.pieces)) le.pieces = "Pieces must be a whole number.";

      if (annex) {
        if (!String(l.jobberSamplesRan ?? "").trim()) le.jobberSamplesRan = "Jobber Samples Ran is required.";
        else if (!isWholeNumberString(l.jobberSamplesRan)) {
          le.jobberSamplesRan = "Jobber Samples Ran must be a whole number.";
        }
      }

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
      const nextLines = prev.lines.map((le, i) => (i === index ? { ...le, [field]: undefined } : le));
      return { ...prev, lines: nextLines };
    });
  }

  function scrollToFirstError(v: FormErrors) {
    if (v.salesOrder) {
      salesOrderRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      salesOrderRef.current?.focus();
      return;
    }

    if (v.lines) {
      const i = v.lines.findIndex((le) => Object.keys(le).length > 0);
      if (i >= 0) {
        const le = v.lines[i];

        if (le.detailNumber) {
          detailRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
          detailRefs.current[i]?.focus();
          return;
        }
        if (le.embroideryLocation) {
          locRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
          locRefs.current[i]?.focus();
          return;
        }
        if (le.stitches) {
          stitchesRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
          stitchesRefs.current[i]?.focus();
          return;
        }
        if (le.pieces) {
          piecesRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
          piecesRefs.current[i]?.focus();
          return;
        }
        if (le.jobberSamplesRan) {
          jobberRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
          jobberRefs.current[i]?.focus();
          return;
        }
      }
    }
  }

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

    if (isEditMode && !originalEntryTsRef.current) {
      setServerError(
        "Original entry timestamp was not loaded. Please refresh the record before saving."
      );
      return;
    }

    setSaving(true);
    try {
      const isUpdate = isEditMode;

      const url = isUpdate
        ? `/api/daily-production-submission?id=${encodeURIComponent(initialSubmissionId || "")}`
        : "/api/daily-production-add";

      const method = isUpdate ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryTs: isUpdate ? originalEntryTsRef.current : new Date().toISOString(),
          salesOrder: salesOrder.trim(),
          machineNumber: machineNumber.trim() || null,
          notes: headerNotes.trim() || null,
          annex,
          lines: lines.map((l) => ({
            detailNumber: l.detailNumber.trim(),
            embroideryLocation: l.embroideryLocation.trim(),
            stitches: l.stitches,
            pieces: l.pieces,
            jobberSamplesRan: annex ? l.jobberSamplesRan : null,
            is3d: !!l.is3d,
            isKnit: !!l.isKnit,
            detailComplete: !!l.detailComplete,
            notes: l.notes?.trim() || null,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setServerError(data?.error ?? "Failed to save.");
        return;
      }

      if (isUpdate) {
        router.push("/daily-production");
        router.refresh();
        return;
      }

      setSuccessMsg("Saved!");
      setErrors({});
      setTimeout(() => setSuccessMsg(null), 2500);

      setSalesOrder("");
      setMachineNumber("");
      setHeaderNotes("");
      setLines([blankLine()]);
      setTimeout(() => salesOrderRef.current?.focus(), 50);
    } catch (err: any) {
      setServerError(err?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingSubmission) {
    return (
      <div className="section-stack">
        <div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/daily-production")}
          >
            ← Back to List
          </button>
        </div>

        <div className="card card-lg">
          <div className="text-sm text-muted">Loading submission…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="section-stack">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">
            {isEditMode ? "Embroidery Production Submission" : "Embroidery Production Entry"}
          </h1>
          <p className="page-subtitle">
            Enter submission details and production lines. Required fields are marked with *.
          </p>
        </div>

        <div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/daily-production")}
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
                Enter the sales order, machine, and submission-level notes.
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
                  if (isEditMode) return;
                  setSalesOrder(e.target.value);
                  clearSalesOrderError();
                }}
                className={inputClass(!!errors.salesOrder)}
                placeholder="1234567 or 1234567.001"
                disabled={isEditMode}
                readOnly={isEditMode}
              />
              {errors.salesOrder ? <div className="field-error">{errors.salesOrder}</div> : null}
              <div className="field-help">
                {isEditMode
                  ? "Sales Order cannot be changed when editing an existing submission."
                  : "Enter the order reference. The system uses the first 7 digits as the base Sales Order."}
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="field-label">Machine</label>
              {machineOptions.length > 0 ? (
                <select
                  value={machineNumber}
                  onChange={(e) => setMachineNumber(e.target.value)}
                  className={selectClass(false)}
                >
                  <option value="">Select…</option>
                  {machineOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={machineNumber}
                  onChange={(e) => setMachineNumber(e.target.value)}
                  className={inputClass(false)}
                  placeholder=""
                />
              )}
              <div className="field-help">Machine assignment for this submission.</div>
            </div>

            <div className="md:col-span-4">
              <label className="field-label">Submission Type</label>
              <div className="flex items-center gap-3 pt-2">
                <label className="inline-flex items-center gap-3 text-sm font-medium select-none cursor-pointer">
                  <input
                    id="annex"
                    type="checkbox"
                    checked={annex}
                    onChange={(e) => {
                      annexTouchedRef.current = true;
                      const checked = e.target.checked;
                      setAnnex(checked);

                      if (!checked) {
                        setLines((prev) => prev.map((l) => ({ ...l, jobberSamplesRan: "" })));
                        setErrors((prev) => {
                          if (!prev.lines) return prev;
                          const next = prev.lines.map((le) => ({ ...le, jobberSamplesRan: undefined }));
                          return { ...prev, lines: next };
                        });
                      }
                    }}
                  />
                  <span className="font-semibold">Annex</span>
                </label>
              </div>
              <div className="field-help">
                When enabled, each line requires Jobber Samples Ran.
              </div>
            </div>

            <div className="md:col-span-12">
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
              <h2 className="mb-1 text-lg font-bold">Production Lines</h2>
              <p className="text-sm text-soft m-0">
                Add one or more production lines for this submission.
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
                        placeholder="1"
                        inputMode="numeric"
                      />
                      {le.detailNumber ? <div className="field-error">{le.detailNumber}</div> : null}
                    </div>

                    <div className={annex ? "md:col-span-3" : "md:col-span-4"}>
                      <label className="field-label">
                        Location <span className="text-red-600">*</span>
                      </label>
                      <select
                        ref={(el) => {
                          locRefs.current[idx] = el;
                        }}
                        value={line.embroideryLocation}
                        onChange={(e) => {
                          updateLine(idx, { embroideryLocation: e.target.value });
                          clearLineFieldError(idx, "embroideryLocation");
                        }}
                        className={selectClass(!!le.embroideryLocation)}
                      >
                        <option value="">Select…</option>
                        {locationOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {le.embroideryLocation ? <div className="field-error">{le.embroideryLocation}</div> : null}
                    </div>

                    <div className="md:col-span-2">
                      <label className="field-label">
                        Stitches <span className="text-red-600">*</span>
                      </label>
                      <input
                        ref={(el) => {
                          stitchesRefs.current[idx] = el;
                        }}
                        value={line.stitches}
                        onChange={(e) => {
                          updateLine(idx, { stitches: e.target.value });
                          clearLineFieldError(idx, "stitches");
                        }}
                        className={inputClass(!!le.stitches)}
                        placeholder="3200"
                        inputMode="numeric"
                      />
                      {le.stitches ? <div className="field-error">{le.stitches}</div> : null}
                    </div>

                    <div className="md:col-span-2">
                      <label className="field-label">
                        Pieces <span className="text-red-600">*</span>
                      </label>
                      <input
                        ref={(el) => {
                          piecesRefs.current[idx] = el;
                        }}
                        value={line.pieces}
                        onChange={(e) => {
                          updateLine(idx, { pieces: e.target.value });
                          clearLineFieldError(idx, "pieces");
                        }}
                        className={inputClass(!!le.pieces)}
                        placeholder="100"
                        inputMode="numeric"
                      />
                      {le.pieces ? <div className="field-error">{le.pieces}</div> : null}
                    </div>

                    {annex ? (
                      <div className="md:col-span-3">
                        <label className="field-label">
                          Jobber Samples Ran <span className="text-red-600">*</span>
                        </label>
                        <input
                          ref={(el) => {
                            jobberRefs.current[idx] = el;
                          }}
                          value={line.jobberSamplesRan}
                          onChange={(e) => {
                            updateLine(idx, { jobberSamplesRan: e.target.value });
                            clearLineFieldError(idx, "jobberSamplesRan");
                          }}
                          className={inputClass(!!le.jobberSamplesRan)}
                          placeholder="0"
                          inputMode="numeric"
                        />
                        {le.jobberSamplesRan ? <div className="field-error">{le.jobberSamplesRan}</div> : null}
                      </div>
                    ) : null}

                    <div className="md:col-span-12">
                      <label className="field-label">Flags</label>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <label className="muted-box inline-flex items-center gap-3 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={line.is3d}
                            onChange={(e) => updateLine(idx, { is3d: e.target.checked })}
                          />
                          <span className="font-medium">3D</span>
                        </label>

                        <label className="muted-box inline-flex items-center gap-3 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={line.isKnit}
                            onChange={(e) => updateLine(idx, { isKnit: e.target.checked })}
                          />
                          <span className="font-medium">Knit</span>
                        </label>

                        <label className="muted-box inline-flex items-center gap-3 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={line.detailComplete}
                            onChange={(e) => updateLine(idx, { detailComplete: e.target.checked })}
                          />
                          <span className="font-medium">Detail Complete</span>
                        </label>
                      </div>
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
              {saving ? "Saving..." : isEditMode ? "Save Changes" : "Save"}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => router.push("/daily-production")}
              disabled={saving}
            >
              {isEditMode ? "Cancel" : "Back to List"}
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