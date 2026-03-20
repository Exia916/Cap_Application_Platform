"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

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

type FieldErrors = {
  salesOrder?: string;
  leatherStyleColor?: string;
  piecesCut?: string;
};

function hasErrors(e: FieldErrors) {
  return !!(e.salesOrder || e.leatherStyleColor || e.piecesCut);
}

export default function LaserProductionForm({
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
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [entryDate, setEntryDate] = useState(mode === "add" ? centralTodayISODate() : "");

  const [salesOrder, setSalesOrder] = useState("");
  const [leatherStyleColor, setLeatherStyleColor] = useState("");
  const [piecesCut, setPiecesCut] = useState("");
  const [notes, setNotes] = useState("");

  const [styles, setStyles] = useState<string[]>([]);
  const [stylesLoading, setStylesLoading] = useState(false);

  const salesOrderRef = useRef<HTMLInputElement | null>(null);
  const styleRef = useRef<HTMLSelectElement | null>(null);
  const piecesRef = useRef<HTMLInputElement | null>(null);

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
        setStylesLoading(true);
        const res = await fetch("/api/leather-styles", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load leather styles");
        if (!cancelled) setStyles(data.styles ?? []);
      } catch {
        // keep usable if styles fail to load
      } finally {
        if (!cancelled) setStylesLoading(false);
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

        const res = await fetch(`/api/laser-production-entry?id=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load entry");

        const rawDate = data.row?.entry_date ?? "";
        setEntryDate(typeof rawDate === "string" && rawDate.includes("T") ? rawDate.slice(0, 10) : rawDate);

        setSalesOrder(data.row?.sales_order ?? "");
        setLeatherStyleColor(data.row?.leather_style_color ?? "");
        setPiecesCut(data.row?.pieces_cut?.toString?.() ?? "");
        setNotes(data.row?.notes ?? "");
      } catch (e: any) {
        setError(e.message || "Error loading entry");
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, id]);

  function validateClient(): FieldErrors {
    const next: FieldErrors = {};

    const so = stripCommas(salesOrder).trim();
    if (!so) next.salesOrder = "Sales Order is required.";
    else if (!isSevenDigits(so)) next.salesOrder = "Sales Order must be exactly 7 digits (numbers only).";

    if (!String(leatherStyleColor ?? "").trim()) {
      next.leatherStyleColor = "Leather Style/Color is required.";
    }

    const pcs = stripCommas(piecesCut).trim();
    if (!pcs) next.piecesCut = "Pieces Cut is required.";
    else if (!isWholeNumber(pcs)) next.piecesCut = "Pieces Cut must be a whole number.";
    else if (Number(pcs) < 0) next.piecesCut = "Pieces Cut cannot be negative.";

    return next;
  }

  function scrollToFirstError(v: FieldErrors) {
    if (v.salesOrder && salesOrderRef.current) {
      salesOrderRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      salesOrderRef.current.focus();
      return;
    }
    if (v.leatherStyleColor && styleRef.current) {
      styleRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      styleRef.current.focus();
      return;
    }
    if (v.piecesCut && piecesRef.current) {
      piecesRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      piecesRef.current.focus();
      return;
    }
  }

  function resetForNewAdd() {
    setEntryDate(centralTodayISODate());
    setSalesOrder("");
    setLeatherStyleColor("");
    setPiecesCut("");
    setNotes("");
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
        leatherStyleColor,
        piecesCut: stripCommas(piecesCut),
        notes,
      };

      let url = "/api/laser-production-add";
      if (mode === "edit") {
        url = "/api/laser-production-update";
        payload.id = id;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");

      if (mode === "add") {
        setSuccessMsg("Saved entry.");
        resetForNewAdd();
        router.refresh();
      } else {
        router.push("/laser-production");
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
            onClick={() => router.push("/laser-production")}
          >
            ← Back to List
          </button>
        </div>

        <div className="card card-lg">
          <div className="text-sm text-muted">Loading entry…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="section-stack">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">
            {mode === "edit" ? "Edit Laser Production Entry" : "Laser Production Entry"}
          </h1>
          <p className="page-subtitle">
            Enter laser production details. Required fields are marked with *.
          </p>
        </div>

        <div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/laser-production")}
          >
            ← Back to List
          </button>
        </div>
      </div>

      <form onSubmit={onSubmit} className="section-stack">
        <section className="card card-lg">
          <div className="section-card-header">
            <div>
              <h2 className="mb-1 text-lg font-bold">Entry Details</h2>
              <p className="text-sm text-soft m-0">
                Enter the sales order, leather style/color, cut quantity, and optional notes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            <div className="md:col-span-4">
              <label className="field-label">
                Sales Order <span className="text-red-600">*</span>
              </label>
              <input
                ref={salesOrderRef}
                className={inputClass(!!fieldErrors.salesOrder)}
                value={salesOrder}
                onChange={(e) => {
                  setSalesOrder(stripCommas(e.target.value));
                  setFieldErrors((prev) => ({ ...prev, salesOrder: undefined }));
                }}
                placeholder="1234567"
                inputMode="numeric"
                readOnly={mode === "edit"}
              />
              {fieldErrors.salesOrder ? <div className="field-error">{fieldErrors.salesOrder}</div> : null}
              <div className="field-help">
                {mode === "edit"
                  ? "Sales Order cannot be changed when editing an existing entry."
                  : "Sales Order is required and must be exactly 7 digits."}
              </div>
            </div>

            <div className="md:col-span-4">
              <label className="field-label">
                Leather Style/Color <span className="text-red-600">*</span>
              </label>
              <select
                ref={styleRef}
                className={selectClass(!!fieldErrors.leatherStyleColor)}
                value={leatherStyleColor}
                onChange={(e) => {
                  setLeatherStyleColor(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, leatherStyleColor: undefined }));
                }}
              >
                <option value="">{stylesLoading ? "Loading..." : "Select Style/Color"}</option>
                {styles.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {fieldErrors.leatherStyleColor ? (
                <div className="field-error">{fieldErrors.leatherStyleColor}</div>
              ) : null}
            </div>

            <div className="md:col-span-4">
              <label className="field-label">
                Pieces Cut <span className="text-red-600">*</span>
              </label>
              <input
                ref={piecesRef}
                type="text"
                className={inputClass(!!fieldErrors.piecesCut)}
                value={piecesCut}
                onChange={(e) => {
                  setPiecesCut(stripCommas(e.target.value));
                  setFieldErrors((prev) => ({ ...prev, piecesCut: undefined }));
                }}
                inputMode="numeric"
                placeholder="0"
              />
              {fieldErrors.piecesCut ? <div className="field-error">{fieldErrors.piecesCut}</div> : null}
              <div className="field-help">Required. Numbers only.</div>
            </div>

            <div className="md:col-span-12">
              <label className="field-label">Notes</label>
              <textarea
                className={textareaClass(false)}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Optional"
              />
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
              onClick={() => router.push("/laser-production")}
              disabled={saving}
            >
              {mode === "edit" ? "Cancel" : "Back to List"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}