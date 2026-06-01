"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";

type LookupOption = {
  id: number;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

type CustomerOption = {
  id: string;
  code: string;
  name: string;
  label: string;
  isActive: boolean;
};

type LineForm = {
  poNumber: string;
  customerId: string;
  customerName: string;
  logo: string;
  tracking: string;
  lineDestination: string;
  quantity: string;
  cartonCount: string;
  notes: string;
};

type InvoiceForm = {
  invoiceNumber: string;
  invoiceTypeId: string;
  invoiceDate: string;
  amount: string;
  notes: string;
};

type LoadedShipment = {
  id: string;
  inboundShipmentNumber: string;
  statusId: number;
  statusCode: string;
  statusLabel: string;
  mblNumber: string | null;
  hblNumber: string | null;
  containerNumber: string | null;
  sealNumber: string | null;
  port: string | null;
  carrier: string | null;
  forwarder: string | null;
  shipmentType: string | null;
  containerDestination: string | null;
  etd: string | null;
  eta: string | null;
  cartonCount: number | null;
  notes: string | null;
  isVoided: boolean;
  voidReason: string | null;
  lines: Array<{
    poNumber: string | null;
    customerId: string | null;
    customerName: string | null;
    logo: string | null;
    tracking: string | null;
    lineDestination: string | null;
    quantity: number | null;
    cartonCount: number | null;
    notes: string | null;
  }>;
  invoices: Array<{
    invoiceNumber: string | null;
    invoiceTypeId: number | null;
    invoiceDate: string | null;
    amount: number | null;
    notes: string | null;
  }>;
};

type Props = {
  initialShipmentId?: string;
};

type FormErrors = {
  statusId?: string;
  containerDestination?: string;
  cartonCount?: string;
  lines?: string;
  invoices?: string;
};

function emptyLine(): LineForm {
  return {
    poNumber: "",
    customerId: "",
    customerName: "",
    logo: "",
    tracking: "",
    lineDestination: "",
    quantity: "",
    cartonCount: "",
    notes: "",
  };
}

function emptyInvoice(): InvoiceForm {
  return {
    invoiceNumber: "",
    invoiceTypeId: "",
    invoiceDate: "",
    amount: "",
    notes: "",
  };
}

function dateOnly(v?: string | null) {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  return "";
}

function isNonNegativeIntegerString(v: string) {
  const s = String(v ?? "").trim();
  return s === "" || /^\d+$/.test(s);
}

function isNonNegativeNumberString(v: string) {
  const s = String(v ?? "").trim();
  return s === "" || /^\d+(\.\d{1,2})?$/.test(s);
}

function FieldBlock({
  label,
  required,
  error,
  children,
  full = false,
  helperText,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  full?: boolean;
  helperText?: string;
}) {
  return (
    <div style={full ? { gridColumn: "1 / -1" } : undefined}>
      <label className="field-label">
        {label}
        {required ? <span className="text-brand-red"> *</span> : null}
      </label>
      {children}
      {helperText ? <div className="field-help">{helperText}</div> : null}
      {error ? <div className="field-error">{error}</div> : null}
    </div>
  );
}

function CustomerCombobox({
  value,
  customerId,
  disabled,
  onChoose,
}: {
  value: string;
  customerId: string;
  disabled?: boolean;
  onChoose: (next: { customerId: string; customerName: string }) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties | null>(null);

  function positionDropdown() {
    const input = inputRef.current;
    if (!input) return;

    const rect = input.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    const maxHeightBelow = Math.max(140, viewportHeight - rect.bottom - 16);
    const preferredHeight = 280;
    const maxHeight = Math.min(preferredHeight, maxHeightBelow);

    setDropdownStyle({
      position: "fixed",
      zIndex: 9999,
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight,
      overflowY: "auto",
      padding: 6,
    });
  }

  useEffect(() => {
    setQuery(value);
  }, [value, customerId]);

  useEffect(() => {
    if (!open) return;

    positionDropdown();

    function onScrollOrResize() {
      positionDropdown();
    }

    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open && query.trim().length === 0) return;

    const t = window.setTimeout(async () => {
      try {
        setLoading(true);

        const sp = new URLSearchParams();
        if (query.trim()) sp.set("q", query.trim());

        const res = await fetch(
          `/api/inbound-shipments/lookups/customers?${sp.toString()}`,
          {
            cache: "no-store",
            credentials: "include",
          }
        );

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          setOptions(Array.isArray(data?.rows) ? data.rows : []);
        }
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => window.clearTimeout(t);
  }, [query, open]);

  useEffect(() => {
    function close(e: MouseEvent) {
      const target = e.target as Node;

      if (wrapRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;

      setOpen(false);
    }

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function choose(opt: CustomerOption) {
    setQuery(opt.name);
    onChoose({
      customerId: opt.id,
      customerName: opt.name,
    });
    setOpen(false);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        ref={inputRef}
        className="input"
        value={query}
        disabled={disabled}
        placeholder="Search customer..."
        autoComplete="off"
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
          window.setTimeout(positionDropdown, 0);
        }}
        onChange={(e) => {
          const next = e.target.value;

          setQuery(next);
          onChoose({
            customerId: "",
            customerName: next,
          });

          setOpen(true);
          window.setTimeout(positionDropdown, 0);
        }}
      />

      {!disabled && open && dropdownStyle ? (
        <div ref={dropdownRef} className="card" style={dropdownStyle}>
          {loading ? (
            <div className="text-soft" style={{ padding: 8 }}>
              Loading…
            </div>
          ) : null}

          {!loading && options.length === 0 ? (
            <div className="text-soft" style={{ padding: 8 }}>
              No customers found.
            </div>
          ) : null}

          {!loading
            ? options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{
                    width: "100%",
                    justifyContent: "flex-start",
                    boxShadow: "none",
                    marginBottom: 4,
                    textAlign: "left",
                    whiteSpace: "normal",
                    lineHeight: 1.25,
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(opt)}
                >
                  {opt.label}
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}

export default function InboundShipmentForm({ initialShipmentId }: Props) {
  const router = useRouter();
  const isEditMode = !!initialShipmentId;

  const [statusOptions, setStatusOptions] = useState<LookupOption[]>([]);
  const [invoiceTypeOptions, setInvoiceTypeOptions] = useState<LookupOption[]>([]);

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isVoided, setIsVoided] = useState(false);
  const [inboundShipmentNumber, setInboundShipmentNumber] = useState<string | null>(
    null
  );

  const [statusId, setStatusId] = useState("");
  const [mblNumber, setMblNumber] = useState("");
  const [hblNumber, setHblNumber] = useState("");
  const [containerNumber, setContainerNumber] = useState("");
  const [sealNumber, setSealNumber] = useState("");
  const [port, setPort] = useState("");
  const [carrier, setCarrier] = useState("");
  const [forwarder, setForwarder] = useState("");
  const [shipmentType, setShipmentType] = useState("");
  const [containerDestination, setContainerDestination] = useState("");
  const [etd, setEtd] = useState("");
  const [eta, setEta] = useState("");
  const [cartonCount, setCartonCount] = useState("");
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);
  const [invoices, setInvoices] = useState<InvoiceForm[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});

  const draftStatusId = useMemo(() => {
    const draft = statusOptions.find((s) => s.code === "DRAFT");
    return draft ? String(draft.id) : "";
  }, [statusOptions]);

  useEffect(() => {
    async function loadLookups() {
      try {
        const [statusRes, invoiceTypeRes] = await Promise.all([
          fetch("/api/inbound-shipments/lookups/statuses", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/inbound-shipments/lookups/invoice-types", {
            cache: "no-store",
            credentials: "include",
          }),
        ]);

        const statusData = await statusRes.json().catch(() => ({}));
        const invoiceTypeData = await invoiceTypeRes.json().catch(() => ({}));

        if (statusRes.ok) {
          setStatusOptions(Array.isArray(statusData?.rows) ? statusData.rows : []);
        }

        if (invoiceTypeRes.ok) {
          setInvoiceTypeOptions(
            Array.isArray(invoiceTypeData?.rows) ? invoiceTypeData.rows : []
          );
        }
      } catch {
        // Form submit will surface API/auth errors later if needed.
      }
    }

    loadLookups();
  }, []);

  useEffect(() => {
    if (!isEditMode && !statusId && draftStatusId) {
      setStatusId(draftStatusId);
    }
  }, [draftStatusId, isEditMode, statusId]);

  useEffect(() => {
    if (!isEditMode || !initialShipmentId) {
      setLoading(false);
      return;
    }

    async function loadShipment() {
      try {
        setLoading(true);
        setServerError(null);

        const res = await fetch(
          `/api/inbound-shipments/${encodeURIComponent(
            initialShipmentId
          )}?includeVoided=true`,
          {
            cache: "no-store",
            credentials: "include",
          }
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load inbound shipment.");
        }

        const row = data?.row as LoadedShipment;

        setInboundShipmentNumber(row.inboundShipmentNumber ?? null);
        setIsVoided(!!row.isVoided);

        if (row.isVoided) {
          setServerError(
            row.voidReason
              ? `This inbound shipment is voided and cannot be edited. Reason: ${row.voidReason}`
              : "This inbound shipment is voided and cannot be edited."
          );
        }

        setStatusId(row.statusId ? String(row.statusId) : "");
        setMblNumber(row.mblNumber ?? "");
        setHblNumber(row.hblNumber ?? "");
        setContainerNumber(row.containerNumber ?? "");
        setSealNumber(row.sealNumber ?? "");
        setPort(row.port ?? "");
        setCarrier(row.carrier ?? "");
        setForwarder(row.forwarder ?? "");
        setShipmentType(row.shipmentType ?? "");
        setContainerDestination(row.containerDestination ?? "");
        setEtd(dateOnly(row.etd));
        setEta(dateOnly(row.eta));
        setCartonCount(row.cartonCount != null ? String(row.cartonCount) : "");
        setNotes(row.notes ?? "");

        setLines(
          row.lines?.length
            ? row.lines.map((line) => ({
                poNumber: line.poNumber ?? "",
                customerId: line.customerId ?? "",
                customerName: line.customerName ?? "",
                logo: line.logo ?? "",
                tracking: line.tracking ?? "",
                lineDestination: line.lineDestination ?? "",
                quantity: line.quantity != null ? String(line.quantity) : "",
                cartonCount:
                  line.cartonCount != null ? String(line.cartonCount) : "",
                notes: line.notes ?? "",
              }))
            : [emptyLine()]
        );

        setInvoices(
          row.invoices?.length
            ? row.invoices.map((invoice) => ({
                invoiceNumber: invoice.invoiceNumber ?? "",
                invoiceTypeId:
                  invoice.invoiceTypeId != null ? String(invoice.invoiceTypeId) : "",
                invoiceDate: dateOnly(invoice.invoiceDate),
                amount: invoice.amount != null ? String(invoice.amount) : "",
                notes: invoice.notes ?? "",
              }))
            : []
        );
      } catch (err: any) {
        setServerError(err?.message || "Failed to load inbound shipment.");
      } finally {
        setLoading(false);
      }
    }

    loadShipment();
  }, [initialShipmentId, isEditMode]);

  function updateLine(index: number, key: keyof LineForm, value: string) {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  function updateInvoice(index: number, key: keyof InvoiceForm, value: string) {
    setInvoices((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  function removeLine(index: number) {
    setLines((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [emptyLine()];
    });
  }

  function removeInvoice(index: number) {
    setInvoices((prev) => prev.filter((_, i) => i !== index));
  }

  function validate(): FormErrors {
    const next: FormErrors = {};

    if (!statusId) {
      next.statusId = "Status is required.";
    }

    if (!containerDestination.trim()) {
      next.containerDestination = "Container Destination is required.";
    }

    if (!isNonNegativeIntegerString(cartonCount)) {
      next.cartonCount = "Carton Count must be a non-negative whole number.";
    }

    const selectedStatus = statusOptions.find((s) => String(s.id) === String(statusId));
    const isDraft = selectedStatus?.code === "DRAFT";

    const meaningfulLines = lines.filter((line) =>
      Boolean(
        line.poNumber.trim() ||
          line.customerName.trim() ||
          line.logo.trim() ||
          line.tracking.trim() ||
          line.lineDestination.trim() ||
          line.quantity.trim() ||
          line.cartonCount.trim() ||
          line.notes.trim()
      )
    );

    if (!isDraft && meaningfulLines.length === 0) {
      next.lines = "At least one line row is required after Draft.";
    }

    for (const line of meaningfulLines) {
      if (!line.poNumber.trim() || !line.customerName.trim()) {
        next.lines = "Each line row must include PO # and Customer.";
        break;
      }

      if (!isNonNegativeIntegerString(line.quantity)) {
        next.lines = "Line Quantity must be a non-negative whole number.";
        break;
      }

      if (!isNonNegativeIntegerString(line.cartonCount)) {
        next.lines = "Line Carton Count must be a non-negative whole number.";
        break;
      }
    }

    for (const invoice of invoices) {
      const hasInvoiceValue = Boolean(
        invoice.invoiceNumber.trim() ||
          invoice.invoiceTypeId ||
          invoice.invoiceDate ||
          invoice.amount.trim() ||
          invoice.notes.trim()
      );

      if (!hasInvoiceValue) continue;

      if (!invoice.invoiceNumber.trim()) {
        next.invoices = "Invoice # is required for each invoice row that is entered.";
        break;
      }

      if (!isNonNegativeNumberString(invoice.amount)) {
        next.invoices = "Invoice Amount must be a valid non-negative number.";
        break;
      }
    }

    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (isVoided) {
      setServerError("Voided inbound shipments cannot be edited.");
      return;
    }

    setServerError(null);

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    try {
      setSaving(true);

      const payload = {
        statusId: statusId ? Number(statusId) : null,
        mblNumber: mblNumber.trim() || null,
        hblNumber: hblNumber.trim() || null,
        containerNumber: containerNumber.trim() || null,
        sealNumber: sealNumber.trim() || null,
        port: port.trim() || null,
        carrier: carrier.trim() || null,
        forwarder: forwarder.trim() || null,
        shipmentType: shipmentType.trim() || null,
        containerDestination: containerDestination.trim(),
        etd: etd || null,
        eta: eta || null,
        cartonCount: cartonCount.trim() ? Number(cartonCount) : null,
        notes: notes.trim() || null,
        lines: lines
          .filter((line) =>
            Boolean(
              line.poNumber.trim() ||
                line.customerName.trim() ||
                line.logo.trim() ||
                line.tracking.trim() ||
                line.lineDestination.trim() ||
                line.quantity.trim() ||
                line.cartonCount.trim() ||
                line.notes.trim()
            )
          )
          .map((line, idx) => ({
            poNumber: line.poNumber.trim() || null,
            customerId: line.customerId || null,
            customerName: line.customerName.trim() || null,
            logo: line.logo.trim() || null,
            tracking: line.tracking.trim() || null,
            lineDestination: line.lineDestination.trim() || null,
            quantity: line.quantity.trim() ? Number(line.quantity) : null,
            cartonCount: line.cartonCount.trim()
              ? Number(line.cartonCount)
              : null,
            notes: line.notes.trim() || null,
            sortOrder: idx,
          })),
        invoices: invoices
          .filter((invoice) =>
            Boolean(
              invoice.invoiceNumber.trim() ||
                invoice.invoiceTypeId ||
                invoice.invoiceDate ||
                invoice.amount.trim() ||
                invoice.notes.trim()
            )
          )
          .map((invoice, idx) => ({
            invoiceNumber: invoice.invoiceNumber.trim() || null,
            invoiceTypeId: invoice.invoiceTypeId
              ? Number(invoice.invoiceTypeId)
              : null,
            invoiceDate: invoice.invoiceDate || null,
            amount: invoice.amount.trim() ? Number(invoice.amount) : null,
            notes: invoice.notes.trim() || null,
            sortOrder: idx,
          })),
      };

      const url = isEditMode
        ? `/api/inbound-shipments/${encodeURIComponent(initialShipmentId || "")}`
        : "/api/inbound-shipments";

      const method = isEditMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Save failed.");
      }

      const id = isEditMode ? initialShipmentId : data?.id;
      router.push(
        id ? `/inbound-shipments/${encodeURIComponent(id)}` : "/inbound-shipments"
      );
      router.refresh();
    } catch (err: any) {
      setServerError(err?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="page-shell">
        <div className="card">
          <div className="text-muted">Loading inbound shipment…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell-wide">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">
            {isEditMode ? "Edit Inbound Shipment" : "New Inbound Shipment"}
          </h1>
          <p className="page-subtitle">
            {inboundShipmentNumber
              ? `Inbound Shipment # ${inboundShipmentNumber}`
              : "Create a container-level inbound shipment record."}
          </p>
        </div>

        <div className="record-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              router.push(
                isEditMode && initialShipmentId
                  ? `/inbound-shipments/${encodeURIComponent(initialShipmentId)}`
                  : "/inbound-shipments"
              )
            }
          >
            Cancel
          </button>
          <button
            type="submit"
            form="inbound-shipment-form"
            className="btn btn-primary"
            disabled={saving || isVoided}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {serverError ? <div className="alert alert-danger">{serverError}</div> : null}

      {isVoided ? (
        <div className="alert alert-danger" style={{ marginTop: 12 }}>
          This inbound shipment is voided and is read-only.
        </div>
      ) : null}

      <form id="inbound-shipment-form" onSubmit={onSubmit} className="section-stack">
        <section className="section-card card">
          <div className="section-card-header">
            <h2 style={{ margin: 0 }}>Submission Details</h2>
          </div>

          <div className="form-grid">
            <FieldBlock label="Status" required error={errors.statusId}>
              <select
                className={`select${errors.statusId ? " select-error" : ""}`}
                value={statusId}
                disabled={saving || isVoided}
                onChange={(e) => setStatusId(e.target.value)}
              >
                <option value="">Select status...</option>
                {statusOptions.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.label}
                  </option>
                ))}
              </select>
            </FieldBlock>

            <FieldBlock label="CNTR #">
              <input
                className="input"
                value={containerNumber}
                disabled={saving || isVoided}
                onChange={(e) => setContainerNumber(e.target.value)}
              />
            </FieldBlock>

            <FieldBlock label="MBL #">
              <input
                className="input"
                value={mblNumber}
                disabled={saving || isVoided}
                onChange={(e) => setMblNumber(e.target.value)}
              />
            </FieldBlock>

            <FieldBlock label="HBL #">
              <input
                className="input"
                value={hblNumber}
                disabled={saving || isVoided}
                onChange={(e) => setHblNumber(e.target.value)}
              />
            </FieldBlock>

            <FieldBlock label="Seal #">
              <input
                className="input"
                value={sealNumber}
                disabled={saving || isVoided}
                onChange={(e) => setSealNumber(e.target.value)}
              />
            </FieldBlock>

            <FieldBlock label="Port">
              <input
                className="input"
                value={port}
                disabled={saving || isVoided}
                onChange={(e) => setPort(e.target.value)}
              />
            </FieldBlock>

            <FieldBlock label="Carrier">
              <input
                className="input"
                value={carrier}
                disabled={saving || isVoided}
                onChange={(e) => setCarrier(e.target.value)}
              />
            </FieldBlock>

            <FieldBlock label="Forwarder">
              <input
                className="input"
                value={forwarder}
                disabled={saving || isVoided}
                onChange={(e) => setForwarder(e.target.value)}
              />
            </FieldBlock>

            <FieldBlock label="Shipment Type">
              <input
                className="input"
                value={shipmentType}
                disabled={saving || isVoided}
                onChange={(e) => setShipmentType(e.target.value)}
              />
            </FieldBlock>

            <FieldBlock
              label="Container Destination"
              required
              error={errors.containerDestination}
              helperText="Where the container arrives before PO/customer lines are split."
            >
              <input
                className={`input${
                  errors.containerDestination ? " input-error" : ""
                }`}
                value={containerDestination}
                disabled={saving || isVoided}
                onChange={(e) => setContainerDestination(e.target.value)}
              />
            </FieldBlock>

            <FieldBlock label="ETD">
              <input
                className="input"
                type="date"
                value={etd}
                disabled={saving || isVoided}
                onChange={(e) => setEtd(e.target.value)}
              />
            </FieldBlock>

            <FieldBlock label="ETA">
              <input
                className="input"
                type="date"
                value={eta}
                disabled={saving || isVoided}
                onChange={(e) => setEta(e.target.value)}
              />
            </FieldBlock>

            <FieldBlock label="Carton Count" error={errors.cartonCount}>
              <input
                className={`input${errors.cartonCount ? " input-error" : ""}`}
                inputMode="numeric"
                value={cartonCount}
                disabled={saving || isVoided}
                onChange={(e) => setCartonCount(e.target.value)}
              />
            </FieldBlock>

            <FieldBlock label="Notes" full>
              <textarea
                className="textarea"
                rows={4}
                value={notes}
                disabled={saving || isVoided}
                onChange={(e) => setNotes(e.target.value)}
              />
            </FieldBlock>
          </div>
        </section>

        <section className="section-card card">
          <div className="section-card-header">
            <div>
              <h2 style={{ margin: 0 }}>Invoice Details</h2>
              <p className="page-subtitle" style={{ marginTop: 4 }}>
                Add commercial, freight, duty, tariff, or other invoice references.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={saving || isVoided}
              onClick={() => setInvoices((prev) => [...prev, emptyInvoice()])}
            >
              Add Invoice
            </button>
          </div>

          {errors.invoices ? (
            <div className="alert alert-danger">{errors.invoices}</div>
          ) : null}

          {invoices.length === 0 ? (
            <div className="muted-box">No invoice rows added.</div>
          ) : (
            <div className="table-card" style={{ marginTop: 12 }}>
              <div className="table-scroll">
                <table className="table-clean">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Invoice Type</th>
                      <th>Invoice Date</th>
                      <th>Amount</th>
                      <th>Notes</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice, idx) => (
                      <tr key={idx}>
                        <td>
                          <input
                            className="input"
                            value={invoice.invoiceNumber}
                            disabled={saving || isVoided}
                            onChange={(e) =>
                              updateInvoice(idx, "invoiceNumber", e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <select
                            className="select"
                            value={invoice.invoiceTypeId}
                            disabled={saving || isVoided}
                            onChange={(e) =>
                              updateInvoice(idx, "invoiceTypeId", e.target.value)
                            }
                          >
                            <option value="">Select type...</option>
                            {invoiceTypeOptions.map((type) => (
                              <option key={type.id} value={String(type.id)}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className="input"
                            type="date"
                            value={invoice.invoiceDate}
                            disabled={saving || isVoided}
                            onChange={(e) =>
                              updateInvoice(idx, "invoiceDate", e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="input"
                            inputMode="decimal"
                            value={invoice.amount}
                            disabled={saving || isVoided}
                            onChange={(e) =>
                              updateInvoice(idx, "amount", e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="input"
                            value={invoice.notes}
                            disabled={saving || isVoided}
                            onChange={(e) =>
                              updateInvoice(idx, "notes", e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            disabled={saving || isVoided}
                            onClick={() => removeInvoice(idx)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="section-card card">
          <div className="section-card-header">
            <div>
              <h2 style={{ margin: 0 }}>Line Details</h2>
              <p className="page-subtitle" style={{ marginTop: 4 }}>
                Add PO, customer, logo, tracking, and destination details.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={saving || isVoided}
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
            >
              Add Line
            </button>
          </div>

          {errors.lines ? <div className="alert alert-danger">{errors.lines}</div> : null}

          <div className="table-card" style={{ marginTop: 12 }}>
            <div className="table-scroll">
              <table className="table-clean">
                <thead>
                  <tr>
                    <th>PO #</th>
                    <th style={{ minWidth: 260 }}>Customer</th>
                    <th>Logo</th>
                    <th>Tracking</th>
                    <th>Line Destination</th>
                    <th>Quantity</th>
                    <th>Carton Count</th>
                    <th>Notes</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx}>
                      <td>
                        <input
                          className="input"
                          value={line.poNumber}
                          disabled={saving || isVoided}
                          onChange={(e) =>
                            updateLine(idx, "poNumber", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <CustomerCombobox
                          value={line.customerName}
                          customerId={line.customerId}
                          disabled={saving || isVoided}
                          onChoose={(next) => {
                            setLines((prev) => {
                              const copy = [...prev];
                              copy[idx] = {
                                ...copy[idx],
                                customerId: next.customerId,
                                customerName: next.customerName,
                              };
                              return copy;
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          value={line.logo}
                          disabled={saving || isVoided}
                          onChange={(e) => updateLine(idx, "logo", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          value={line.tracking}
                          disabled={saving || isVoided}
                          onChange={(e) =>
                            updateLine(idx, "tracking", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          value={line.lineDestination}
                          disabled={saving || isVoided}
                          onChange={(e) =>
                            updateLine(idx, "lineDestination", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={line.quantity}
                          disabled={saving || isVoided}
                          onChange={(e) =>
                            updateLine(idx, "quantity", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={line.cartonCount}
                          disabled={saving || isVoided}
                          onChange={(e) =>
                            updateLine(idx, "cartonCount", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          value={line.notes}
                          disabled={saving || isVoided}
                          onChange={(e) => updateLine(idx, "notes", e.target.value)}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={saving || isVoided || lines.length === 1}
                          onClick={() => removeLine(idx)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <div
          className="sticky-actions"
          style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              router.push(
                isEditMode && initialShipmentId
                  ? `/inbound-shipments/${encodeURIComponent(initialShipmentId)}`
                  : "/inbound-shipments"
              )
            }
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || isVoided}
          >
            {saving ? "Saving..." : "Save Inbound Shipment"}
          </button>
        </div>
      </form>
    </main>
  );
}