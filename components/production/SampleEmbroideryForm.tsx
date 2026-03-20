"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type FieldErrors = {
  salesOrder?: string;
  detailCount?: string;
  quantity?: string;
};

function hasErrors(e: FieldErrors) {
  return !!(e.salesOrder || e.detailCount || e.quantity);
}

function isSevenDigits(v: string) {
  return /^\d{7}$/.test(v.trim());
}

function isWholeNumber(v: string) {
  return /^\d+$/.test(v.trim());
}

export default function SampleEmbroideryForm({
  mode,
  id,
}: {
  mode: "add" | "edit";
  id?: string;
}) {
  const router = useRouter();
  const isEditMode = mode === "edit";

  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [salesOrder, setSalesOrder] = useState("");
  const [detailCount, setDetailCount] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const salesOrderRef = useRef<HTMLInputElement | null>(null);
  const detailCountRef = useRef<HTMLInputElement | null>(null);
  const quantityRef = useRef<HTMLInputElement | null>(null);

  const errTextClass = "mt-1 text-xs font-semibold text-red-700";
  const inputBaseClass = "w-full rounded border p-2";
  const inputErrorClass = "border-red-500 ring-2 ring-red-200";

  function inputClass(hasErr?: boolean, disabled?: boolean) {
    return `${inputBaseClass} ${hasErr ? inputErrorClass : ""} ${
      disabled ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
    }`;
  }

  useEffect(() => {
    if (mode !== "edit" || !id) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setSuccessMsg(null);
        setFieldErrors({});

        const res = await fetch(
          `/api/production/sample-embroidery/entry?id=${encodeURIComponent(id)}`,
          { cache: "no-store" }
        );

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load entry");

        setSalesOrder(data.row?.salesOrder ?? "");
        setDetailCount(String(data.row?.detailCount ?? ""));
        setQuantity(String(data.row?.quantity ?? ""));
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

    if (!salesOrder.trim()) {
      next.salesOrder = "Sales Order is required.";
    } else if (!isSevenDigits(salesOrder)) {
      next.salesOrder = "Sales Order must be exactly 7 digits.";
    }

    if (!detailCount.trim()) {
      next.detailCount = "Number of Details is required.";
    } else if (!isWholeNumber(detailCount)) {
      next.detailCount = "Number of Details must be a whole number.";
    }

    if (!quantity.trim()) {
      next.quantity = "Quantity is required.";
    } else if (!isWholeNumber(quantity)) {
      next.quantity = "Quantity must be a whole number.";
    }

    return next;
  }

  function scrollToFirstError(v: FieldErrors) {
    if (v.salesOrder && salesOrderRef.current) {
      salesOrderRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      salesOrderRef.current.focus();
      return;
    }
    if (v.detailCount && detailCountRef.current) {
      detailCountRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      detailCountRef.current.focus();
      return;
    }
    if (v.quantity && quantityRef.current) {
      quantityRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      quantityRef.current.focus();
    }
  }

  function resetForNewAdd() {
    setSalesOrder("");
    setDetailCount("");
    setQuantity("");
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

      if (hasErrors(v)) {
        setTimeout(() => scrollToFirstError(v), 50);
        return;
      }

      const payload: any = {
        salesOrder: salesOrder.trim(),
        detailCount: detailCount.trim(),
        quantity: quantity.trim(),
        notes,
      };

      let url = "/api/production/sample-embroidery/add";
      if (mode === "edit") {
        url = "/api/production/sample-embroidery/update";
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
        router.push("/production/sample-embroidery");
        router.refresh();
      }
    } catch (e: any) {
      setError(e.message || "Save error");
    } finally {
      setSaving(false);
    }
  }

  function goBackToList() {
    router.push("/production/sample-embroidery");
  }

  if (loading) {
    return <div className="p-6">Loading…</div>;
  }

  return (
    <form onSubmit={onSubmit} className="section-card" style={{ maxWidth: 760 }}>
      <div className="section-card-header">
        <div>
          <h1 className="section-title">
            {mode === "add" ? "Add Sample Embroidery Entry" : "Edit Sample Embroidery Entry"}
          </h1>
          <p className="section-subtitle">
            Capture sample embroidery production activity.
          </p>
        </div>
      </div>

      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={goBackToList}
        >
          Back to List
        </button>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {successMsg ? <div className="alert alert-success">{successMsg}</div> : null}

      <div className="form-grid form-grid-2">
        <div>
          <label className="form-label">Sales Order</label>
          <input
            ref={salesOrderRef}
            className={inputClass(!!fieldErrors.salesOrder, isEditMode)}
            value={salesOrder}
            onChange={(e) => {
              if (isEditMode) return;
              setSalesOrder(e.target.value);
            }}
            placeholder="1234567"
            disabled={isEditMode}
            readOnly={isEditMode}
          />
          {fieldErrors.salesOrder ? (
            <div className={errTextClass}>{fieldErrors.salesOrder}</div>
          ) : null}
          {isEditMode ? (
            <div className="mt-1 text-xs text-gray-500">
              Sales Order cannot be changed when editing.
            </div>
          ) : null}
        </div>

        <div>
          <label className="form-label">Number of Details</label>
          <input
            ref={detailCountRef}
            className={inputClass(!!fieldErrors.detailCount)}
            value={detailCount}
            onChange={(e) => setDetailCount(e.target.value)}
            placeholder="0"
          />
          {fieldErrors.detailCount ? (
            <div className={errTextClass}>{fieldErrors.detailCount}</div>
          ) : null}
        </div>

        <div>
          <label className="form-label">Location Quantity</label>
          <input
            ref={quantityRef}
            className={inputClass(!!fieldErrors.quantity)}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
          />
          {fieldErrors.quantity ? (
            <div className={errTextClass}>{fieldErrors.quantity}</div>
          ) : null}
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Notes</label>
          <textarea
            className="w-full rounded border p-2"
            rows={5}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes"
          />
        </div>
      </div>

      <div className="section-actions" style={{ marginTop: 16 }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving..." : mode === "add" ? "Save Entry" : "Save Changes"}
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={goBackToList}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}