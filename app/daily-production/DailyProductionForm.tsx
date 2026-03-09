"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type LocationOption = { value: string; label: string };
type MachineOption = { value: string; label: string };

type Line = {
  detailNumber: string;
  embroideryLocation: string;
  stitches: string;
  pieces: string;

  // ✅ Only used when Annex is checked
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

export default function DailyProductionForm(props: DailyProductionFormProps) {
  const { initialSubmissionId } = props;

  const router = useRouter();
  const pathname = usePathname();

  const [salesOrder, setSalesOrder] = useState("");
  const [machineNumber, setMachineNumber] = useState("");
  const [headerNotes, setHeaderNotes] = useState("");

  // ✅ Annex header flag
  const [annex, setAnnex] = useState(false);
  const annexTouchedRef = useRef(false);

  const [lines, setLines] = useState<Line[]>([blankLine()]);

  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [machineOptions, setMachineOptions] = useState<MachineOption[]>([]);

  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>(initialSubmissionId ?? "");

  // ✅ optional: keep last created id (does NOT switch to edit mode)
  const [lastSavedSubmissionId, setLastSavedSubmissionId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  // ✅ only for REAL server/runtime errors (not validation)
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ✅ field-level validation errors
  const [errors, setErrors] = useState<FormErrors>({});

  const canRemove = useMemo(() => lines.length > 1, [lines.length]);

  // --- Refs for auto-scroll/focus ---
  const salesOrderRef = useRef<HTMLInputElement | null>(null);
  const detailRefs = useRef<(HTMLInputElement | null)[]>([]);
  const locRefs = useRef<(HTMLSelectElement | null)[]>([]);
  const stitchesRefs = useRef<(HTMLInputElement | null)[]>([]);
  const piecesRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ---------------------------------------------------------------------------
  // Styling helpers (matching your current form style)
  // ---------------------------------------------------------------------------
  const errTextClass = "mt-1 text-xs text-red-600";
  function inputClass(isError: boolean) {
    return [
      "mt-1 w-full rounded border px-3 py-2 text-sm",
      isError ? "border-red-500" : "border-gray-300",
      "focus:outline-none focus:ring-2 focus:ring-black/20",
    ].join(" ");
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

  // ---------------------------------------------------------------------------
  // Load dropdowns
  // ---------------------------------------------------------------------------
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
      } catch {
        // ignore
      }
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
      } catch {
        // ignore
      }
    })();
  }, []);

  // Auto-check Annex if logged-in user is in department "ANNEX EMBROIDERY"
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
      } catch {
        // ignore
      }
    })();
  }, []);

  // ---------------------------------------------------------------------------
  // Load an existing submission (edit mode)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!selectedSubmissionId) return;

    (async () => {
      try {
        setServerError(null);
        setSuccessMsg(null);

        const submissionId = selectedSubmissionId;
        const res = await fetch(`/api/daily-production-submission?id=${encodeURIComponent(submissionId)}`, {
          cache: "no-store",
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Failed to load submission.");

        const submission = data?.submission;
        const loadedLines = Array.isArray(data?.lines) ? data.lines : [];

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
      }
    })();
  }, [selectedSubmissionId]);

  // ---------------------------------------------------------------------------
  // Line manipulation
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Validation + error focus/scroll
  // ---------------------------------------------------------------------------
  function validateClient(): FormErrors {
    const next: FormErrors = {};

    // Sales order required and must be whole number
    if (!salesOrder.trim()) next.salesOrder = "Sales Order is required.";
    else if (!isWholeNumberString(salesOrder)) next.salesOrder = "Sales Order must be a whole number.";

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
        else if (!isWholeNumberString(l.jobberSamplesRan))
          le.jobberSamplesRan = "Jobber Samples Ran must be a whole number.";
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
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
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
      const isUpdate = !!selectedSubmissionId;

      const url = isUpdate
        ? `/api/daily-production-submission?id=${encodeURIComponent(selectedSubmissionId)}`
        : "/api/daily-production-add";

      const method = isUpdate ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryTs: new Date().toISOString(),
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

      // ✅ Success confirmation (and auto-hide)
      setSuccessMsg(isUpdate ? "Saved changes." : "Saved!");
      setErrors({});
      setTimeout(() => setSuccessMsg(null), 2500);

      if (isUpdate) {
        // stay in edit mode with the current data
        return;
      }

      // ✅ Keep last saved id for optional future use, but DO NOT switch to edit mode
      if (data?.submissionId) setLastSavedSubmissionId(String(data.submissionId));

      // ✅ ADD MODE: clear form for next entry
      setSelectedSubmissionId(""); // ensure we remain in add mode
      setSalesOrder("");
      setMachineNumber("");
      setHeaderNotes("");
      setLines([blankLine()]);

      // focus Sales Order
      setTimeout(() => salesOrderRef.current?.focus(), 50);

      // Optional: navigate back to list page after add
      // if (pathname?.includes("/daily-production/add")) router.push("/daily-production");
    } catch (err: any) {
      setServerError(err?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="rounded border p-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium">
              Sales Order <span className="text-red-600">*</span>
            </label>
            <input
              ref={salesOrderRef}
              value={salesOrder}
              onChange={(e) => {
                setSalesOrder(e.target.value);
                clearSalesOrderError();
              }}
              className={inputClass(!!errors.salesOrder)}
              placeholder="1234567"
              inputMode="numeric"
            />
            {errors.salesOrder ? <div className={errTextClass}>{errors.salesOrder}</div> : null}
            <div className="mt-1 text-xs opacity-70">Sales Orders are 7 digits.</div>
          </div>

          <div>
            <label className="block text-sm font-medium">Machine</label>
            {machineOptions.length > 0 ? (
              <select value={machineNumber} onChange={(e) => setMachineNumber(e.target.value)} className={inputClass(false)}>
                <option value="">Select…</option>
                {machineOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            ) : (
              <input value={machineNumber} onChange={(e) => setMachineNumber(e.target.value)} className={inputClass(false)} placeholder="Optional" />
            )}
          </div>

          <div className="flex items-center gap-3">
            <input
              id="annex"
              type="checkbox"
              checked={annex}
              onChange={(e) => {
                annexTouchedRef.current = true;
                const checked = e.target.checked;
                setAnnex(checked);

                // If Annex is turned off, clear Jobber Samples Ran values + related errors
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
            <label htmlFor="annex" className="text-sm font-medium select-none">
              Annex
            </label>
          </div>

          <div className="md:col-span-4">
            <label className="block text-sm font-medium">Header Notes</label>
            <input
              value={headerNotes}
              onChange={(e) => setHeaderNotes(e.target.value)}
              className={inputClass(false)}
              placeholder="Optional notes that apply to the whole submission"
            />
          </div>
        </div>
      </div>

      <div className="rounded border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Lines</h3>
          <button type="button" onClick={addLine} className="rounded border px-3 py-1 text-sm">
            + Add Line
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {lines.map((line, idx) => {
            const le = errors.lines?.[idx] ?? {};
            return (
              <div key={idx} className="rounded border p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Line {idx + 1}</div>
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    disabled={!canRemove}
                    className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>

               <div className={`mt-3 grid grid-cols-1 gap-4 ${annex ? "md:grid-cols-7" : "md:grid-cols-6"}`}>
  <div>
    <label className="block text-sm font-medium">
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
    {le.detailNumber ? <div className={errTextClass}>{le.detailNumber}</div> : null}
  </div>

  <div className={annex ? "md:col-span-2" : "md:col-span-2"}>
    <label className="block text-sm font-medium">
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
      className={inputClass(!!le.embroideryLocation)}
    >
      <option value="">Select…</option>
      {locationOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    {le.embroideryLocation ? <div className={errTextClass}>{le.embroideryLocation}</div> : null}
  </div>

  <div>
    <label className="block text-sm font-medium">
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
    {le.stitches ? <div className={errTextClass}>{le.stitches}</div> : null}
  </div>

  <div>
    <label className="block text-sm font-medium">
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
    {le.pieces ? <div className={errTextClass}>{le.pieces}</div> : null}
  </div>

  {/* ✅ Inline column when Annex is enabled */}
  {annex ? (
    <div>
      <label className="block text-sm font-medium">
        Samples Ran <span className="text-red-600">*</span>
      </label>
      <input
        value={line.jobberSamplesRan}
        onChange={(e) => {
          updateLine(idx, { jobberSamplesRan: e.target.value });
          clearLineFieldError(idx, "jobberSamplesRan");
        }}
        className={inputClass(!!le.jobberSamplesRan)}
        placeholder="0"
        inputMode="numeric"
      />
      {le.jobberSamplesRan ? <div className={errTextClass}>{le.jobberSamplesRan}</div> : null}
    </div>
  ) : null}

  <div className={`flex items-end gap-4 ${annex ? "md:col-span-7" : "md:col-span-6"}`}>
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={line.is3d} onChange={(e) => updateLine(idx, { is3d: e.target.checked })} />
      <span className="text-sm">3D</span>
    </label>

    <label className="flex items-center gap-2">
      <input type="checkbox" checked={line.isKnit} onChange={(e) => updateLine(idx, { isKnit: e.target.checked })} />
      <span className="text-sm">Knit</span>
    </label>

    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={line.detailComplete}
        onChange={(e) => updateLine(idx, { detailComplete: e.target.checked })}
      />
      <span className="text-sm">Complete</span>
    </label>
  </div>

  <div className={annex ? "md:col-span-7" : "md:col-span-6"}>
    <label className="block text-sm font-medium">Line Notes</label>
    <input
      value={line.notes}
      onChange={(e) => updateLine(idx, { notes: e.target.value })}
      className={inputClass(false)}
      placeholder="Optional"
    />
  </div>
</div>
              </div>
            );
          })}
        </div>
      </div>

      {serverError ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{serverError}</div>
      ) : null}

      {successMsg ? (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">{successMsg}</div>
      ) : null}

      <button type="submit" disabled={saving} className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}