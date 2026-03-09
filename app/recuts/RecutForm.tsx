"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type LookupOption = {
  id: string;
  code?: string | null;
  label?: string | null;
  itemCode?: string | null;
};

type MeResponse = {
  username?: string | null;
  displayName?: string | null;
  employeeNumber?: number | null;
  role?: string | null;
  department?: string | null;
  userId?: string | null;
  error?: string;
};

type RecutEntry = {
  id: string;
  recutId: number;
  requestedDate: string;
  requestedTime: string;
  requestedByName: string;
  requestedDepartment: string;
  salesOrder: string;
  designName: string;
  recutReason: string;
  detailNumber: number;
  capStyle: string;
  pieces: number;
  operator: string;
  deliverTo: string;
  supervisorApproved: boolean;
  warehousePrinted: boolean;
};

type Props = {
  mode: "add" | "edit";
  initialId?: string;
};

type FormErrors = {
  requestedDepartment?: string;
  salesOrder?: string;
  designName?: string;
  recutReason?: string;
  detailNumber?: string;
  capStyle?: string;
  pieces?: string;
  operator?: string;
  deliverTo?: string;
};

function normalizeDept(value: string | null | undefined): string {
  const v = String(value ?? "").trim().toUpperCase();

  if (v === "EMBROIDERY") return "Embroidery";
  if (v === "ANNEX EMB") return "Annex Embroidery";
  if (v === "ANNEX EMBROIDERY") return "Annex Embroidery";
  if (v === "SAMPLE EMBROIDERY") return "Sample Embroidery";
  if (v === "QC") return "QC";

  return "";
}

function isEmbDept(value: string | null | undefined) {
  const v = normalizeDept(value);
  return v === "Embroidery" || v === "Annex Embroidery" || v === "Sample Embroidery";
}

function isValidSalesOrder(v: string) {
  return /^\d{7}\.\d{3}$/.test(String(v || "").trim());
}

function isWholeNumberString(v: string) {
  return /^\d+$/.test(String(v || "").trim());
}

function CapStyleCombobox({
  items,
  value,
  onChange,
  error,
}: {
  items: LookupOption[];
  value: string;
  onChange: (next: string) => void;
  error?: string;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (e.target instanceof Node && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const allCodes = items
      .map((x) => String(x.itemCode ?? "").trim())
      .filter(Boolean);

    if (!q) {
      return allCodes.slice(0, 25);
    }

    const startsWith = allCodes.filter((code) => code.toLowerCase().startsWith(q));
    const contains = allCodes.filter(
      (code) => !code.toLowerCase().startsWith(q) && code.toLowerCase().includes(q)
    );

    return [...startsWith, ...contains].slice(0, 25);
  }, [items, query]);

  function choose(code: string) {
    setQuery(code);
    onChange(code);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        value={query}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          onChange(next);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();

            const exact = filtered.find(
              (x) => x.toLowerCase() === String(query || "").trim().toLowerCase()
            );

            if (exact) {
              choose(exact);
              return;
            }

            if (filtered.length === 1) {
              choose(filtered[0]);
            }
          }

          if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Type cap style..."
        style={inputStyle(!!error)}
        autoComplete="off"
      />

      {open && filtered.length > 0 ? (
        <div style={comboMenu}>
          {filtered.map((code) => (
            <button
              key={code}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(code)}
              style={comboItem}
            >
              {code}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function RecutForm({ mode, initialId }: Props) {
  const router = useRouter();

  const [me, setMe] = useState<MeResponse | null>(null);

  const [reasons, setReasons] = useState<LookupOption[]>([]);
  const [requestedDepartments, setRequestedDepartments] = useState<LookupOption[]>([]);
  const [items, setItems] = useState<LookupOption[]>([]);

  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [recutId, setRecutId] = useState<number | null>(null);
  const [requestedDate, setRequestedDate] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [requestedByName, setRequestedByName] = useState("");

  const [requestedDepartment, setRequestedDepartment] = useState("");
  const [salesOrder, setSalesOrder] = useState("");
  const [designName, setDesignName] = useState("");
  const [recutReason, setRecutReason] = useState("");
  const [detailNumber, setDetailNumber] = useState("");
  const [capStyle, setCapStyle] = useState("");
  const [pieces, setPieces] = useState("");
  const [operator, setOperator] = useState("");
  const [deliverTo, setDeliverTo] = useState("");
  const [supervisorApproved, setSupervisorApproved] = useState(false);
  const [warehousePrinted, setWarehousePrinted] = useState(false);

  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    (async () => {
      try {
        const [meRes, reasonsRes, deptRes, itemsRes] = await Promise.all([
          fetch("/api/me", { cache: "no-store", credentials: "include" }),
          fetch("/api/recuts/lookups/reasons", { cache: "no-store", credentials: "include" }),
          fetch("/api/recuts/lookups/requested-departments", { cache: "no-store", credentials: "include" }),
          fetch("/api/recuts/lookups/items", { cache: "no-store", credentials: "include" }),
        ]);

        if (meRes.ok) {
          const meData = (await meRes.json()) as MeResponse;
          setMe(meData);

          if (mode === "add") {
            const inferredDept = normalizeDept(meData.department);
            const inferredName = String(meData.displayName ?? meData.username ?? "").trim();

            setRequestedByName(inferredName);
            setRequestedDepartment(inferredDept);

            if (isEmbDept(meData.department)) {
              setOperator(inferredName);
            }
          }
        }

        if (reasonsRes.ok) {
          const data = await reasonsRes.json();
          setReasons(Array.isArray(data?.rows) ? data.rows : []);
        }

        if (deptRes.ok) {
          const data = await deptRes.json();
          setRequestedDepartments(Array.isArray(data?.rows) ? data.rows : []);
        }

        if (itemsRes.ok) {
          const data = await itemsRes.json();
          setItems(Array.isArray(data?.rows) ? data.rows : []);
        }
      } catch {
        // ignore bootstrap errors here
      }
    })();
  }, [mode]);

  useEffect(() => {
    if (mode !== "edit" || !initialId) return;

    (async () => {
      setLoading(true);
      setServerError(null);

      try {
        const res = await fetch(`/api/recuts/${encodeURIComponent(initialId)}`, {
          cache: "no-store",
          credentials: "include",
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setServerError((data as any).error || "Failed to load recut request.");
          setLoading(false);
          return;
        }

        const row = (data as any).entry as RecutEntry;

        setRecutId(row.recutId ?? null);
        setRequestedDate(row.requestedDate ?? "");
        setRequestedTime(row.requestedTime ?? "");
        setRequestedByName(row.requestedByName ?? "");
        setRequestedDepartment(row.requestedDepartment ?? "");
        setSalesOrder(row.salesOrder ?? "");
        setDesignName(row.designName ?? "");
        setRecutReason(row.recutReason ?? "");
        setDetailNumber(String(row.detailNumber ?? ""));
        setCapStyle(row.capStyle ?? "");
        setPieces(String(row.pieces ?? ""));
        setOperator(row.operator ?? "");
        setDeliverTo(row.deliverTo ?? "");
        setSupervisorApproved(!!row.supervisorApproved);
        setWarehousePrinted(!!row.warehousePrinted);
      } catch {
        setServerError("Failed to load recut request.");
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, initialId]);

  const role = useMemo(() => String(me?.role ?? "").trim().toUpperCase(), [me?.role]);
  const canSeeApprovalFlags =
    role === "ADMIN" || role === "MANAGER" || role === "SUPERVISOR";

  const hideOperatorField = isEmbDept(me?.department);
  const showOperatorField = !hideOperatorField;

  function clearFieldError<K extends keyof FormErrors>(key: K) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      return { ...prev, [key]: undefined };
    });
  }

  function handleRequestedDepartmentChange(value: string) {
    setRequestedDepartment(value);
    if (value.trim()) clearFieldError("requestedDepartment");
  }

  function handleSalesOrderChange(value: string) {
    setSalesOrder(value);
    if (value.trim()) clearFieldError("salesOrder");
  }

  function handleDesignNameChange(value: string) {
    setDesignName(value);
    if (value.trim()) clearFieldError("designName");
  }

  function handleRecutReasonChange(value: string) {
    setRecutReason(value);
    if (value.trim()) clearFieldError("recutReason");
  }

  function handleDetailNumberChange(value: string) {
    setDetailNumber(value);
    if (value.trim()) clearFieldError("detailNumber");
  }

  function handleCapStyleChange(value: string) {
    setCapStyle(value);
    if (value.trim()) clearFieldError("capStyle");
  }

  function handlePiecesChange(value: string) {
    setPieces(value);
    if (value.trim()) clearFieldError("pieces");
  }

  function handleOperatorChange(value: string) {
    setOperator(value);
    if (value.trim()) clearFieldError("operator");
  }

  function handleDeliverToChange(value: string) {
    setDeliverTo(value);
    if (value.trim()) clearFieldError("deliverTo");
  }

  function preventEnterSubmit(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === "Enter") {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();

      if (tag === "input" || tag === "select") {
        e.preventDefault();
      }
    }
  }

  function validate(): FormErrors {
    const next: FormErrors = {};

    if (!requestedDepartment.trim()) next.requestedDepartment = "Requested Department is required.";

    if (!salesOrder.trim()) next.salesOrder = "Sales Order # is required.";
    else if (!isValidSalesOrder(salesOrder)) {
      next.salesOrder = "Sales Order must be in format 3023113.001";
    }

    if (!designName.trim()) next.designName = "Design Name is required.";
    if (!recutReason.trim()) next.recutReason = "Recut Reason is required.";

    if (!detailNumber.trim()) next.detailNumber = "Detail # is required.";
    else if (!isWholeNumberString(detailNumber)) next.detailNumber = "Detail # must be a whole number.";

    if (!capStyle.trim()) next.capStyle = "Cap Style is required.";

    if (!pieces.trim()) next.pieces = "Pieces is required.";
    else if (!isWholeNumberString(pieces) || Number(pieces) <= 0) {
      next.pieces = "Pieces must be a whole number greater than 0.";
    }

    if (!operator.trim()) next.operator = "Operator is required.";
    if (!deliverTo.trim()) next.deliverTo = "Deliver To is required.";

    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setSuccessMsg(null);

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);

    try {
      const body = {
        requestedDepartment: requestedDepartment.trim(),
        salesOrder: salesOrder.trim(),
        designName: designName.trim(),
        recutReason: recutReason.trim(),
        detailNumber: Number(detailNumber),
        capStyle: capStyle.trim(),
        pieces: Number(pieces),
        operator: operator.trim(),
        deliverTo: deliverTo.trim(),
        supervisorApproved,
        warehousePrinted,
      };

      const res =
        mode === "add"
          ? await fetch("/api/recuts/add", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(body),
            })
          : await fetch(`/api/recuts/${encodeURIComponent(initialId || "")}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(body),
            });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setServerError((data as any).error || "Save failed.");
        setSaving(false);
        return;
      }

      setSuccessMsg(mode === "add" ? "Recut request created." : "Recut request updated.");

      setTimeout(() => {
        router.push("/recuts");
        router.refresh();
      }, 500);
    } catch {
      setServerError("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 16 }}>Loading recut request…</div>;
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>{mode === "add" ? "New Recut Request" : "Edit Recut Request"}</h1>
        <p style={{ marginTop: 8, color: "#4b5563" }}>
          Create or update a single recut request.
        </p>
      </div>

      {serverError ? <div style={errorBox}>{serverError}</div> : null}
      {successMsg ? <div style={successBox}>{successMsg}</div> : null}

      <form onSubmit={onSubmit} onKeyDown={preventEnterSubmit}>
        <div style={grid}>
          <ReadOnlyField label="Recut ID" value={recutId != null ? String(recutId) : "Auto generated on save"} />
          <ReadOnlyField label="Date Requested" value={requestedDate || "Auto captured"} />
          <ReadOnlyField label="Time Requested" value={requestedTime || "Auto captured"} />
          <ReadOnlyField label="Name" value={requestedByName || "Loading user…"} />

          <FieldBlock label="Requested Department" error={errors.requestedDepartment}>
            <select
              value={requestedDepartment}
              onChange={(e) => handleRequestedDepartmentChange(e.target.value)}
              style={inputStyle(!!errors.requestedDepartment)}
            >
              <option value="">Select department</option>
              {requestedDepartments.map((d) => (
                <option key={d.id} value={String(d.label ?? "")}>
                  {String(d.label ?? "")}
                </option>
              ))}
            </select>
          </FieldBlock>

          <FieldBlock label="Sales Order #" error={errors.salesOrder}>
            <input
              value={salesOrder}
              onChange={(e) => handleSalesOrderChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              placeholder="3023113.001"
              style={inputStyle(!!errors.salesOrder)}
            />
          </FieldBlock>

          <FieldBlock label="Design Name" error={errors.designName}>
            <input
              value={designName}
              onChange={(e) => handleDesignNameChange(e.target.value)}
              style={inputStyle(!!errors.designName)}
            />
          </FieldBlock>

          <FieldBlock label="Recut Reason" error={errors.recutReason}>
            <select
              value={recutReason}
              onChange={(e) => handleRecutReasonChange(e.target.value)}
              style={inputStyle(!!errors.recutReason)}
            >
              <option value="">Select recut reason</option>
              {reasons.map((r) => (
                <option key={r.id} value={String(r.label ?? "")}>
                  {String(r.label ?? "")}
                </option>
              ))}
            </select>
          </FieldBlock>

          <FieldBlock label="Detail #" error={errors.detailNumber}>
            <input
              value={detailNumber}
              onChange={(e) => handleDetailNumberChange(e.target.value)}
              inputMode="numeric"
              style={inputStyle(!!errors.detailNumber)}
            />
          </FieldBlock>

          <FieldBlock label="Cap Style" error={errors.capStyle}>
            <CapStyleCombobox
              items={items}
              value={capStyle}
              onChange={handleCapStyleChange}
              error={errors.capStyle}
            />
          </FieldBlock>

          <FieldBlock label="Pieces" error={errors.pieces}>
            <input
              value={pieces}
              onChange={(e) => handlePiecesChange(e.target.value)}
              inputMode="numeric"
              style={inputStyle(!!errors.pieces)}
            />
          </FieldBlock>

          {showOperatorField ? (
            <FieldBlock label="Operator" error={errors.operator}>
              <input
                value={operator}
                onChange={(e) => handleOperatorChange(e.target.value)}
                style={inputStyle(!!errors.operator)}
              />
            </FieldBlock>
          ) : (
            <ReadOnlyField label="Operator" value={operator || requestedByName || ""} />
          )}

          <FieldBlock label="Deliver To" error={errors.deliverTo}>
            <input
              value={deliverTo}
              onChange={(e) => handleDeliverToChange(e.target.value)}
              style={inputStyle(!!errors.deliverTo)}
            />
          </FieldBlock>

          {canSeeApprovalFlags ? (
            <>
              <CheckboxBlock
                label="Supervisor Approved"
                checked={supervisorApproved}
                onChange={setSupervisorApproved}
              />
              <CheckboxBlock
                label="Warehouse Printed"
                checked={warehousePrinted}
                onChange={setWarehousePrinted}
              />
            </>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button type="submit" disabled={saving} style={btnPrimary}>
            {saving ? "Saving..." : mode === "add" ? "Create Recut Request" : "Save Changes"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/recuts")}
            style={btnSecondary}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function FieldBlock({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
      {error ? <div style={fieldError}>{error}</div> : null}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={readonlyStyle}>{value}</div>
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
      <label style={labelStyle}>{label}</label>
      <label style={checkWrap}>
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

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: "100%",
    border: hasError ? "1px solid #dc2626" : "1px solid #d1d5db",
    borderRadius: 8,
    padding: "10px 12px",
    background: "#fff",
  };
}

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontWeight: 600,
  fontSize: 14,
};

const readonlyStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: "10px 12px",
  background: "#f9fafb",
  minHeight: 42,
};

const fieldError: React.CSSProperties = {
  marginTop: 6,
  color: "#b91c1c",
  fontSize: 12,
  fontWeight: 600,
};

const errorBox: React.CSSProperties = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 8,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
};

const successBox: React.CSSProperties = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 8,
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
};

const checkWrap: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 42,
};

const comboMenu: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  maxHeight: 260,
  overflowY: "auto",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  background: "#fff",
  boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
  zIndex: 30,
};

const comboItem: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  border: "none",
  background: "#fff",
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = {
  border: "none",
  background: "#111827",
  color: "#fff",
  borderRadius: 8,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 600,
};

const btnSecondary: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 8,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 600,
};