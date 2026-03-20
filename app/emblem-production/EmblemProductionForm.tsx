"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Line = {
  detailNumber: string;
  emblemType: string;
  logoName: string;
  pieces: string;
  notes: string;
};

function blankLine(): Line {
  return { detailNumber: "", emblemType: "", logoName: "", pieces: "", notes: "" };
}

/**
 * Returns YYYY-MM-DD for "today" in America/Chicago
 * (Central Time, including DST automatically).
 */
function centralTodayISODate(): string {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "";
  const mm = parts.find((p) => p.type === "month")?.value ?? "";
  const dd = parts.find((p) => p.type === "day")?.value ?? "";

  return `${yyyy}-${mm}-${dd}`;
}

function stripCommas(v: any) {
  const s = v === null || v === undefined ? "" : String(v);
  return s.replace(/,/g, "");
}

function isSevenDigits(v: any) {
  const s = stripCommas(v).trim();
  return /^\d{7}$/.test(s);
}

function isWholeNumber(v: any) {
  const s = stripCommas(v).trim();
  return /^\d+$/.test(s);
}

type LineFieldErrors = {
  detailNumber?: string;
  emblemType?: string;
  pieces?: string;
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

export default function EmblemProductionForm({
  mode,
  id,
}: {
  mode: "add" | "edit";
  id?: string;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

  const [entryDate, setEntryDate] = useState(mode === "add" ? centralTodayISODate() : "");
  const [salesOrder, setSalesOrder] = useState("");
  const [headerNotes, setHeaderNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [emblemTypes, setEmblemTypes] = useState<string[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);

  const salesOrderRef = useRef<HTMLInputElement | null>(null);
  const detailRefs = useRef<(HTMLInputElement | null)[]>([]);
  const emblemTypeRefs = useRef<(HTMLSelectElement | null)[]>([]);
  const piecesRefs = useRef<(HTMLInputElement | null)[]>([]);

  const canRemove = useMemo(() => lines.length > 1, [lines.length]);

  function inputClass(hasErr?: boolean) {
    return hasErr ? "input input-error" : "input";
  }

  function selectClass(hasErr?: boolean) {
    return hasErr ? "select select-error" : "select";
  }

  function textareaClass(hasErr?: boolean) {
    return hasErr ? "textarea textarea-error" : "textarea";
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setTypesLoading(true);
        const res = await fetch("/api/emblem-types", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load emblem types");
        if (!cancelled) setEmblemTypes(data.types ?? []);
      } catch {
        // keep usable even if types fail
      } finally {
        if (!cancelled) setTypesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== "edit" || !id) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setSuccessMsg(null);
        setFieldErrors({});

        const res = await fetch(`/api/emblem-production-submissions?id=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load submission");

        const rawEntryDate = data.header?.entry_date ?? "";
        const safeEntryDate =
          typeof rawEntryDate === "string" && rawEntryDate.includes("T")
            ? rawEntryDate.slice(0, 10)
            : rawEntryDate;

        setEntryDate(safeEntryDate);
        setSalesOrder(data.header?.sales_order ?? "");
        setHeaderNotes(data.header?.notes ?? "");

        const mapped: Line[] = (data.lines ?? []).map((l: any) => ({
          detailNumber: l.detail_number?.toString?.() ?? "",
          emblemType: l.emblem_type ?? "",
          logoName: l.logo_name ?? "",
          pieces: l.pieces?.toString?.() ?? "",
          notes: l.line_notes ?? "",
        }));

        setLines(mapped.length ? mapped : [blankLine()]);
      } catch (e: any) {
        setError(e.message || "Error loading submission");
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, id]);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, blankLine()]);
    setFieldErrors((prev) => ({
      ...prev,
      lines: prev.lines ? [...prev.lines, {}] : prev.lines,
    }));
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
    setFieldErrors((prev) => {
      if (!prev.lines) return prev;
      return { ...prev, lines: prev.lines.filter((_, i) => i !== index) };
    });

    detailRefs.current.splice(index, 1);
    emblemTypeRefs.current.splice(index, 1);
    piecesRefs.current.splice(index, 1);
  }

  const totalPieces = useMemo(() => {
    return lines.reduce((sum, l) => sum + (Number(stripCommas(l.pieces)) || 0), 0);
  }, [lines]);

  function clearSalesOrderError() {
    setFieldErrors((prev) => ({ ...prev, salesOrder: undefined }));
  }

  function clearLineFieldError(index: number, field: keyof LineFieldErrors) {
    setFieldErrors((prev) => {
      if (!prev.lines) return prev;
      const nextLines = [...prev.lines];
      const cur = nextLines[index] ?? {};
      nextLines[index] = { ...cur, [field]: undefined };
      return { ...prev, lines: nextLines };
    });
  }

  function validateClient(): FormErrors {
    const next: FormErrors = {};

    const so = stripCommas(salesOrder).trim();
    if (!so) next.salesOrder = "Sales Order is required.";
    else if (!isSevenDigits(so)) next.salesOrder = "Sales Order must be exactly 7 digits (numbers only).";

    if (!lines.length) {
      next.lines = [];
      return next;
    }

    const lineErrors: LineFieldErrors[] = lines.map((l) => {
      const le: LineFieldErrors = {};

      const dn = stripCommas(l.detailNumber).trim();
      if (!dn) le.detailNumber = "Detail # is required.";
      else if (!isWholeNumber(dn)) le.detailNumber = "Detail # must be a whole number.";

      const et = String(l.emblemType ?? "").trim();
      if (!et) le.emblemType = "Emblem Type is required.";

      const pcs = stripCommas(l.pieces).trim();
      if (!pcs) le.pieces = "Pieces is required.";
      else if (!isWholeNumber(pcs)) le.pieces = "Pieces must be a whole number.";
      else if (Number(pcs) < 0) le.pieces = "Pieces cannot be negative.";

      return le;
    });

    if (lineErrors.some((le) => Object.keys(le).length > 0)) next.lines = lineErrors;

    return next;
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

        if (le.emblemType && emblemTypeRefs.current[i]) {
          emblemTypeRefs.current[i]!.scrollIntoView({ behavior: "smooth", block: "center" });
          emblemTypeRefs.current[i]!.focus();
          return;
        }

        if (le.pieces && piecesRefs.current[i]) {
          piecesRefs.current[i]!.scrollIntoView({ behavior: "smooth", block: "center" });
          piecesRefs.current[i]!.focus();
          return;
        }
      }
    }
  }

  function resetForNewAdd() {
    setEntryDate(centralTodayISODate());
    setSalesOrder("");
    setHeaderNotes("");
    setLines([blankLine()]);
    setFieldErrors({});
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const v = validateClient();
      setFieldErrors(v);

      if (hasErrors(v) || !entryDate) {
        if (!entryDate) setError("Entry Date is required.");
        setTimeout(() => scrollToFirstError(v), 50);
        return;
      }

      const payload: any = {
        entryDate,
        salesOrder: stripCommas(salesOrder),
        headerNotes,
        lines: lines.map((l) => ({
          detailNumber: stripCommas(l.detailNumber),
          emblemType: l.emblemType,
          logoName: l.logoName,
          pieces: stripCommas(l.pieces),
          notes: l.notes,
        })),
      };

      const url = mode === "add" ? "/api/emblem-production-submission" : "/api/emblem-production-update";
      if (mode === "edit") payload.id = id;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");

      if (mode === "add") {
        setSuccessMsg(`Saved ${lines.length} line(s).`);
        resetForNewAdd();
        router.refresh();
      } else {
        router.push("/emblem-production");
        router.refresh();
      }
    } catch (e: any) {
      setError(e.message || "Save error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="section-stack">
        <div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/emblem-production")}
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
            {mode === "edit" ? "Edit Emblem Production Submission" : "Emblem Production Entry"}
          </h1>
          <p className="page-subtitle">
            Enter submission details and emblem production lines. Required fields are marked with *.
          </p>
        </div>

        <div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/emblem-production")}
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
                className={inputClass(!!fieldErrors.salesOrder)}
                value={salesOrder}
                onChange={(e) => {
                  setSalesOrder(stripCommas(e.target.value));
                  clearSalesOrderError();
                }}
                placeholder="1234567"
                inputMode="numeric"
                readOnly={mode === "edit"}
              />
              {fieldErrors.salesOrder ? <div className="field-error">{fieldErrors.salesOrder}</div> : null}
              <div className="field-help">
                {mode === "edit"
                  ? "Sales Order cannot be changed when editing an existing submission."
                  : "Sales Order is required and must be a 7 digit number."}
              </div>
            </div>

            <div className="md:col-span-7">
              <label className="field-label">Header Notes</label>
              <textarea
                className={textareaClass(false)}
                value={headerNotes}
                onChange={(e) => setHeaderNotes(e.target.value)}
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
                Add one or more emblem production lines for this submission.
              </p>
            </div>

            <button type="button" onClick={addLine} className="btn btn-secondary">
              + Add Line
            </button>
          </div>

          <div className="space-y-4">
            {lines.map((line, idx) => {
              const le = fieldErrors.lines?.[idx] ?? {};

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
                      className="btn btn-danger btn-sm"
                      disabled={!canRemove}
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
                        className={inputClass(!!le.detailNumber)}
                        value={line.detailNumber}
                        onChange={(e) => {
                          updateLine(idx, { detailNumber: stripCommas(e.target.value) });
                          clearLineFieldError(idx, "detailNumber");
                        }}
                        inputMode="numeric"
                        placeholder="1"
                      />
                      {le.detailNumber ? <div className="field-error">{le.detailNumber}</div> : null}
                    </div>

                    <div className="md:col-span-3">
                      <label className="field-label">
                        Emblem Type <span className="text-red-600">*</span>
                      </label>
                      <select
                        ref={(el) => {
                          emblemTypeRefs.current[idx] = el;
                        }}
                        className={selectClass(!!le.emblemType)}
                        value={line.emblemType}
                        onChange={(e) => {
                          updateLine(idx, { emblemType: e.target.value });
                          clearLineFieldError(idx, "emblemType");
                        }}
                      >
                        <option value="">{typesLoading ? "Loading..." : "Select…"}</option>
                        {emblemTypes.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      {le.emblemType ? <div className="field-error">{le.emblemType}</div> : null}
                    </div>

                    <div className="md:col-span-4">
                      <label className="field-label">Logo Name</label>
                      <input
                        className={inputClass(false)}
                        value={line.logoName}
                        onChange={(e) => updateLine(idx, { logoName: e.target.value })}
                        placeholder="Optional"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="field-label">
                        Pieces <span className="text-red-600">*</span>
                      </label>
                      <input
                        ref={(el) => {
                          piecesRefs.current[idx] = el;
                        }}
                        type="text"
                        className={inputClass(!!le.pieces)}
                        value={line.pieces}
                        onChange={(e) => {
                          updateLine(idx, { pieces: stripCommas(e.target.value) });
                          clearLineFieldError(idx, "pieces");
                        }}
                        inputMode="numeric"
                        placeholder="0"
                      />
                      {le.pieces ? <div className="field-error">{le.pieces}</div> : null}
                    </div>

                    <div className="md:col-span-12">
                      <label className="field-label">Line Notes</label>
                      <textarea
                        className={textareaClass(false)}
                        value={line.notes}
                        onChange={(e) => updateLine(idx, { notes: e.target.value })}
                        placeholder="Optional"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2">
            <div className="muted-box inline-flex items-center gap-2 text-sm">
              <span className="font-semibold">Total Pieces:</span>
              <span>{totalPieces}</span>
            </div>
          </div>
        </section>

        {error ? <div className="alert alert-danger">{error}</div> : null}
        {successMsg ? <div className="alert alert-success">{successMsg}</div> : null}

        <div className="sticky-actions">
          <div className="flex flex-wrap gap-2 pt-3">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Saving..." : mode === "edit" ? "Update" : "Save"}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => router.push("/emblem-production")}
              disabled={saving}
            >
              {mode === "edit" ? "Cancel" : "Back to List"}
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