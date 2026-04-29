"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AttachmentsPanel from "@/components/platform/AttachmentsPanel";
import CommentsPanel from "@/components/platform/CommentsPanel";
import ActivityHistoryPanel from "@/components/platform/ActivityHistoryPanel";

type Mode = "new" | "view" | "edit";

type RequestRecord = {
  id: string;
  requestNumber: string;
  salesOrderNumber: string | null;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  poNumber: string | null;
  tapeName: string | null;
  dateRequestCreated: string;
  dueDate: string | null;
  customerName: string | null;
  customerCode: string | null;
  binCode: string | null;
  createdByUserId: string | null;
  createdByName: string | null;
  digitizerUserId: string | null;
  digitizerName: string | null;
  designerUserId: string | null;
  designerName: string | null;
  statusId: number;
  statusCode: string;
  statusLabel: string;
  instructions: string | null;
  additionalInstructions: string | null;
  colorwaysText: string | null;
  tapeNumber: string | null;
  rush: boolean;
  styleCode: string | null;
  sampleSoNumber: string | null;
  stitchCount: number | null;
  artProof: boolean;
  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

type StatusRow = {
  id: number;
  code: string;
  label: string;
  sort_order: number;
};

type UserLookupRow = {
  id: string;
  name: string;
  username: string;
  role: string;
  employeeNumber: number | null;
  shift: string | null;
  department: string | null;
};

type BinLookupRow = {
  id: number;
  code: string;
  description: string | null;
};

type CustomerLookupRow = {
  id: string;
  code: string;
  name: string;
};

type StyleLookupRow = {
  id: string;
  code: string;
  description: string | null;
};

type StatusHistoryRow = {
  id: number;
  requestId: string;
  statusId: number;
  statusCode: string;
  statusLabel: string;
  changedAt: string;
  changedByUserId: string | null;
  changedByName: string | null;
};

type MeResponse = {
  username?: string | null;
  displayName?: string | null;
  employeeNumber?: number | null;
  role?: string | null;
  userId?: string | null;
  id?: string | null;
  name?: string | null;
};

type TabKey = "general" | "additional" | "colorways" | "attachments" | "history";

function fmtDateTime(v?: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function toDateInputValue(v?: string | null): string {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  return "";
}

function nowDisplayDateTime() {
  return new Date().toLocaleString();
}

function defaultRequestNumber() {
  return `DW-${Date.now()}`;
}

function emptyForm() {
  return {
    requestNumber: defaultRequestNumber(),
    salesOrderNumber: "",
    poNumber: "",
    tapeName: "",
    dueDate: "",
    customerCode: "",
    customerName: "",
    binCode: "Unspecified",
    digitizerUserId: "",
    digitizerName: "",
    designerUserId: "",
    designerName: "",
    statusId: "",
    instructions: "",
    additionalInstructions: "",
    colorwaysText: "",
    tapeNumber: "",
    rush: false,
    styleCode: "",
    sampleSoNumber: "",
    stitchCount: "",
    artProof: false,
  };
}


type SearchComboboxProps<T> = {
  value: string;
  disabled?: boolean;
  placeholder?: string;
  initialRows?: T[];
  endpoint: string;
  getKey: (row: T) => string;
  getPrimary: (row: T) => string;
  getSecondary?: (row: T) => string | null;
  onSelect: (row: T) => void;
  onTextChange?: (text: string) => void;
};

function LookupSearchCombobox<T>({
  value,
  disabled = false,
  placeholder = "Search...",
  initialRows = [],
  endpoint,
  getKey,
  getPrimary,
  getSecondary,
  onSelect,
  onTextChange,
}: SearchComboboxProps<T>) {
  const [query, setQuery] = useState(value || "");
  const [rows, setRows] = useState<T[]>(initialRows);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    if (disabled) return;

    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);

        const sp = new URLSearchParams();
        if (query.trim()) sp.set("q", query.trim());
        sp.set("limit", "75");

        const res = await fetch(`${endpoint}?${sp.toString()}`, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });

        const data = await res.json().catch(() => []);

        if (!res.ok) {
          throw new Error((data as any)?.error || "Lookup search failed.");
        }

        setRows(Array.isArray(data) ? data : []);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setRows([]);
        setError(err?.message || "Lookup search failed.");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [query, disabled, endpoint]);

  function choose(row: T) {
    const next = getPrimary(row);
    setQuery(next);
    onSelect(row);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        className="input"
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          onTextChange?.(next);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }

          if (e.key === "Enter") {
            e.preventDefault();

            const exact = rows.find(
              (row) => getPrimary(row).toLowerCase() === query.trim().toLowerCase()
            );

            if (exact) {
              choose(exact);
              return;
            }

            if (rows.length === 1) {
              choose(rows[0]);
            }
          }
        }}
      />

      {open && !disabled ? (
        <div style={lookupMenu}>
          {loading ? (
            <div style={lookupEmpty}>Searching…</div>
          ) : error ? (
            <div style={lookupError}>{error}</div>
          ) : rows.length === 0 ? (
            <div style={lookupEmpty}>No matching records found.</div>
          ) : (
            rows.map((row) => {
              const primary = getPrimary(row);
              const secondary = getSecondary?.(row);

              return (
                <button
                  key={getKey(row)}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(row)}
                  style={lookupItem}
                >
                  <strong>{primary}</strong>
                  {secondary ? (
                    <span style={{ color: "var(--text-soft)" }}> - {secondary}</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

function CustomerSearchCombobox({
  value,
  selectedName,
  rows,
  disabled,
  onSelect,
  onTextChange,
}: {
  value: string;
  selectedName: string;
  rows: CustomerLookupRow[];
  disabled?: boolean;
  onSelect: (row: CustomerLookupRow) => void;
  onTextChange: (text: string) => void;
}) {
  const displayValue = selectedName || value || "";

  return (
    <LookupSearchCombobox<CustomerLookupRow>
      value={displayValue}
      disabled={disabled}
      placeholder="Search customer..."
      initialRows={rows}
      endpoint="/api/design-workflow/lookups/customers"
      getKey={(row) => String(row.id)}
      getPrimary={(row) => row.name || row.code}
      getSecondary={(row) => (row.code && row.code !== row.name ? row.code : null)}
      onSelect={onSelect}
      onTextChange={onTextChange}
    />
  );
}

function StyleSearchCombobox({
  value,
  rows,
  disabled,
  onSelect,
  onTextChange,
}: {
  value: string;
  rows: StyleLookupRow[];
  disabled?: boolean;
  onSelect: (row: StyleLookupRow) => void;
  onTextChange: (text: string) => void;
}) {
  return (
    <LookupSearchCombobox<StyleLookupRow>
      value={value || ""}
      disabled={disabled}
      placeholder="Search style..."
      initialRows={rows}
      endpoint="/api/design-workflow/lookups/styles"
      getKey={(row) => String(row.id)}
      getPrimary={(row) => row.code}
      getSecondary={(row) => row.description}
      onSelect={onSelect}
      onTextChange={onTextChange}
    />
  );
}

export default function DesignRequestWindow({
  mode,
  requestId,
  isModal = false,
  onClose,
  onSaved,
}: {
  mode: Mode;
  requestId?: string;
  isModal?: boolean;
  onClose?: () => void;
  onSaved?: (record: RequestRecord | { id: string }) => void;
}) {
  const readOnly = mode === "view";

  const [tab, setTab] = useState<TabKey>("general");
  const [me, setMe] = useState<MeResponse | null>(null);

  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [digitizers, setDigitizers] = useState<UserLookupRow[]>([]);
  const [designers, setDesigners] = useState<UserLookupRow[]>([]);
  const [bins, setBins] = useState<BinLookupRow[]>([]);
  const [customers, setCustomers] = useState<CustomerLookupRow[]>([]);
  const [styles, setStyles] = useState<StyleLookupRow[]>([]);

  const [loading, setLoading] = useState(mode !== "new");
  const [saving, setSaving] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState<StatusHistoryRow[]>([]);

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [suggestedSalesOrderNumber, setSuggestedSalesOrderNumber] = useState("");

  const [record, setRecord] = useState<RequestRecord | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const [form, setForm] = useState(emptyForm());
  const [modalSize, setModalSize] = useState({ width: 895, height: 760 });
  const resizeStateRef = useRef<null | {
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    edge: "right" | "bottom" | "corner";
  }>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const state = resizeStateRef.current;
      if (!state) return;

      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;

      setModalSize((current) => {
        const nextWidth =
          state.edge === "right" || state.edge === "corner"
            ? Math.max(760, Math.min(window.innerWidth - 40, state.startWidth + dx))
            : current.width;

        const nextHeight =
          state.edge === "bottom" || state.edge === "corner"
            ? Math.max(560, Math.min(window.innerHeight - 64, state.startHeight + dy))
            : current.height;

        return { width: nextWidth, height: nextHeight };
      });
    }

    function onUp() {
      resizeStateRef.current = null;
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function startResize(edge: "right" | "bottom" | "corner") {
    return (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      resizeStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startWidth: modalSize.width,
        startHeight: modalSize.height,
        edge,
      };
    };
  }

  function renderModalWindow(content: React.ReactNode) {
    return (
      <div style={modalOverlay} onMouseDown={onClose}>
        <div style={getModalWindowStyle(modalSize)} onMouseDown={(e) => e.stopPropagation()}>
          {content}
          <div style={modalResizeRight} onMouseDown={startResize("right")} />
          <div style={modalResizeBottom} onMouseDown={startResize("bottom")} />
          <div style={modalResizeCorner} onMouseDown={startResize("corner")} />
        </div>
      </div>
    );
  }

  const createdDisplay = useMemo(() => {
    if (record?.dateRequestCreated) return fmtDateTime(record.dateRequestCreated);
    return nowDisplayDateTime();
  }, [record?.dateRequestCreated]);

  const selectedStatusLabel = useMemo(() => {
    const id = Number(form.statusId);
    return statuses.find((s) => s.id === id)?.label || "";
  }, [form.statusId, statuses]);

  useEffect(() => {
    let alive = true;

    async function bootstrap() {
      try {
        const [
          meRes,
          statusesRes,
          digitizersRes,
          designersRes,
          binsRes,
          customersRes,
          stylesRes,
        ] = await Promise.all([
          fetch("/api/me", { cache: "no-store", credentials: "include" }),
          fetch("/api/design-workflow/statuses", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/design-workflow/lookups/users?department=Digitizing", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/design-workflow/lookups/users?department=Art", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/design-workflow/lookups/bins", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/design-workflow/lookups/customers", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/design-workflow/lookups/styles", {
            cache: "no-store",
            credentials: "include",
          }),
        ]);

        const meData = meRes.ok ? await meRes.json() : null;
        const statusesData = statusesRes.ok ? await statusesRes.json() : [];
        const digitizersData = digitizersRes.ok ? await digitizersRes.json() : [];
        const designersData = designersRes.ok ? await designersRes.json() : [];
        const binsData = binsRes.ok ? await binsRes.json() : [];
        const customersData = customersRes.ok ? await customersRes.json() : [];
        const stylesData = stylesRes.ok ? await stylesRes.json() : [];

        let nextSalesOrderData: any = null;

        if (mode === "new") {
          const nextSalesOrderRes = await fetch(
            "/api/design-workflow/next-sales-order",
            {
              cache: "no-store",
              credentials: "include",
            }
          );

          nextSalesOrderData = await nextSalesOrderRes.json().catch(() => null);

          if (!nextSalesOrderRes.ok) {
            throw new Error(
              nextSalesOrderData?.error ||
                `Failed to generate suggested Sales Order #. Status: ${nextSalesOrderRes.status}`
            );
          }
        }

        if (!alive) return;

        setMe(meData);
        setStatuses(Array.isArray(statusesData) ? statusesData : []);
        setDigitizers(Array.isArray(digitizersData) ? digitizersData : []);
        setDesigners(Array.isArray(designersData) ? designersData : []);
        setBins(Array.isArray(binsData) ? binsData : []);
        setCustomers(Array.isArray(customersData) ? customersData : []);
        setStyles(Array.isArray(stylesData) ? stylesData : []);

        if (mode === "new") {
          const unspecified = Array.isArray(statusesData)
            ? statusesData.find((s: StatusRow) => s.label === "Unspecified")
            : null;

          const suggestedSalesOrder =
            typeof nextSalesOrderData?.nextSalesOrderNumber === "string"
              ? nextSalesOrderData.nextSalesOrderNumber
              : "";

          setSuggestedSalesOrderNumber(suggestedSalesOrder);

          setForm((prev) => ({
            ...prev,
            statusId: unspecified ? String(unspecified.id) : "",
            salesOrderNumber: prev.salesOrderNumber || suggestedSalesOrder,
          }));
        }
      } catch (err: any) {
        if (!alive) return;
        setServerError(err?.message || "Failed to load request lookups.");
      }
    }

    bootstrap();

    return () => {
      alive = false;
    };
  }, [mode]);

  useEffect(() => {
    if (!requestId || mode === "new") {
      setLoading(false);
      setLoadFailed(false);
      return;
    }

    let alive = true;

    async function loadRecord() {
      setLoading(true);
      setServerError(null);
      setLoadFailed(false);

      try {
        const res = await fetch(`/api/design-workflow/${encodeURIComponent(requestId || "")}`, {
          cache: "no-store",
          credentials: "include",
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load design request.");
        }

        if (!alive) return;

        const row = data as RequestRecord;
        setRecord(row);
        setSuggestedSalesOrderNumber("");

        setForm({
          requestNumber: row.requestNumber || "",
          salesOrderNumber: row.salesOrderDisplay || row.salesOrderNumber || "",
          poNumber: row.poNumber || "",
          tapeName: row.tapeName || "",
          dueDate: toDateInputValue(row.dueDate),
          customerCode: row.customerCode || "",
          customerName: row.customerName || "",
          binCode: row.binCode || "",
          digitizerUserId: row.digitizerUserId || "",
          digitizerName: row.digitizerName || "",
          designerUserId: row.designerUserId || "",
          designerName: row.designerName || "",
          statusId: String(row.statusId),
          instructions: row.instructions || "",
          additionalInstructions: row.additionalInstructions || "",
          colorwaysText: row.colorwaysText || "",
          tapeNumber: row.tapeNumber || "",
          rush: !!row.rush,
          styleCode: row.styleCode || "",
          sampleSoNumber: row.sampleSoNumber || "",
          stitchCount: row.stitchCount != null ? String(row.stitchCount) : "",
          artProof: !!row.artProof,
        });
      } catch (err: any) {
        if (!alive) return;
        setServerError(err?.message || "Failed to load design request.");
        setLoadFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadRecord();

    return () => {
      alive = false;
    };
  }, [mode, requestId]);

  useEffect(() => {
    if (!requestId || tab !== "history") return;

    let alive = true;

    async function loadHistoryForTab() {
      try {
        setHistoryLoading(true);

        const res = await fetch(
          `/api/design-workflow/${encodeURIComponent(requestId || "")}/status-history`,
          {
            cache: "no-store",
            credentials: "include",
          }
        );

        const data = await res.json().catch(() => ([]));
        if (!res.ok) {
          throw new Error((data as any)?.error || "Failed to load status history.");
        }

        if (!alive) return;
        setHistoryRows(Array.isArray(data) ? data : []);
      } catch (err: any) {
        if (!alive) return;
        setHistoryRows([]);
        setServerError(err?.message || "Failed to load status history.");
      } finally {
        if (alive) setHistoryLoading(false);
      }
    }

    loadHistoryForTab();

    return () => {
      alive = false;
    };
  }, [requestId, tab]);

  useEffect(() => {
    if (!isModal) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && onClose) {
        onClose();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isModal, onClose]);

  async function loadHistory() {
    if (!requestId) return;

    try {
      setHistoryLoading(true);
      const res = await fetch(
        `/api/design-workflow/${encodeURIComponent(requestId)}/status-history`,
        {
          cache: "no-store",
          credentials: "include",
        }
      );

      const data = await res.json().catch(() => ([]));
      if (!res.ok) {
        throw new Error((data as any)?.error || "Failed to load status history.");
      }

      setHistoryRows(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setHistoryRows([]);
      setServerError(err?.message || "Failed to load status history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  function openPreview(print = false) {
    const idToUse = requestId || record?.id;
    if (!idToUse) return;

    const url = `/design-workflow/${encodeURIComponent(idToUse)}/preview${
      print ? "?print=1" : ""
    }`;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function chooseDigitizer(userId: string) {
    const match = digitizers.find((u) => u.id === userId);
    setForm((prev) => ({
      ...prev,
      digitizerUserId: userId,
      digitizerName: match?.name || "",
    }));
  }

  function chooseDesigner(userId: string) {
    const match = designers.find((u) => u.id === userId);
    setForm((prev) => ({
      ...prev,
      designerUserId: userId,
      designerName: match?.name || "",
    }));
  }

  function chooseCustomer(code: string) {
    const match = customers.find((c) => c.code === code);
    setForm((prev) => ({
      ...prev,
      customerCode: code,
      customerName: match?.name || "",
    }));
  }

  async function onSubmit() {
    if (readOnly) return;

    setSaving(true);
    setServerError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        requestNumber: form.requestNumber.trim(),
        salesOrderNumber: form.salesOrderNumber.trim() || null,
        poNumber: form.poNumber.trim() || null,
        tapeName: form.tapeName.trim() || null,
        dueDate: form.dueDate || null,
        customerCode: form.customerCode || null,
        customerName: form.customerName || null,
        binCode: form.binCode.trim() || null,
        digitizerUserId: form.digitizerUserId || null,
        digitizerName: form.digitizerName || null,
        designerUserId: form.designerUserId || null,
        designerName: form.designerName || null,
        statusId: form.statusId ? Number(form.statusId) : null,
        instructions: form.instructions.trim() || null,
        additionalInstructions: form.additionalInstructions.trim() || null,
        colorwaysText: form.colorwaysText.trim() || null,
        tapeNumber: form.tapeNumber.trim() || null,
        rush: !!form.rush,
        styleCode: form.styleCode || null,
        sampleSoNumber: form.sampleSoNumber.trim() || null,
        stitchCount: form.stitchCount.trim() ? Number(form.stitchCount) : null,
        artProof: !!form.artProof,
      };

      if (!payload.requestNumber) {
        throw new Error("Request number is required.");
      }

      if (!payload.statusId) {
        throw new Error("Request status is required.");
      }

      const url =
        mode === "new"
          ? "/api/design-workflow"
          : `/api/design-workflow/${encodeURIComponent(requestId || "")}`;

      const method = mode === "new" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error((data as any)?.error || "Save failed.");
      }

      setSuccessMsg(mode === "new" ? "Design request created." : "Design request updated.");
      onSaved?.(data as RequestRecord | { id: string });

      if (isModal) {
        onClose?.();
        return;
      }

      if (mode === "new" && (data as any)?.id) {
        window.location.href = `/design-workflow/${encodeURIComponent((data as any).id)}`;
        return;
      }

      if ((data as any)?.id) {
        setRecord(data as RequestRecord);
      }
    } catch (err: any) {
      setServerError(err?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const notFoundShell =
    mode !== "new" && loadFailed ? (
      <div style={notFoundWrap}>
        <div className="alert alert-danger" style={{ marginBottom: 12 }}>
          {serverError || "Not found"}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    ) : null;

  const shell = notFoundShell ? (
    notFoundShell
  ) : (
    <>
      {serverError ? <div className="alert alert-danger">{serverError}</div> : null}
      {successMsg ? <div className="alert alert-success">{successMsg}</div> : null}

      {record?.isVoided ? (
        <div className="alert alert-danger">
          This design request is voided and is now read-only.
          {record.voidReason ? ` Reason: ${record.voidReason}` : ""}
        </div>
      ) : null}

      {!isModal ? (
        <div style={{ marginBottom: 12 }}>
          <Link href="/design-workflow" className="btn btn-secondary btn-sm">
            ← Back to List
          </Link>
        </div>
      ) : null}

      <div style={windowWrap}>
        <div style={toolStrip}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => openPreview(true)}
            disabled={!(requestId || record?.id)}
          >
            Print
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => openPreview(false)}
            disabled={!(requestId || record?.id)}
          >
            Preview
          </button>

          <button type="button" className="btn btn-secondary btn-sm" disabled>
            Email
          </button>
        </div>

        <div style={tabStrip}>
          <TabButton active={tab === "general"} onClick={() => setTab("general")}>
            General
          </TabButton>
          <TabButton active={tab === "additional"} onClick={() => setTab("additional")}>
            Additional Instructions
          </TabButton>
          <TabButton active={tab === "colorways"} onClick={() => setTab("colorways")}>
            Colorways
          </TabButton>
          <TabButton active={tab === "attachments"} onClick={() => setTab("attachments")}>
            Attachments
          </TabButton>
          <TabButton active={tab === "history"} onClick={() => setTab("history")}>
            History
          </TabButton>
        </div>

        <div style={windowBody}>
          {tab === "general" ? (
            <div style={generalGrid}>
              <div style={leftColumn}>
                <FieldRow label="Sales Order #">
                  <input
                    className="input"
                    value={form.salesOrderNumber}
                    onChange={(e) => updateField("salesOrderNumber", e.target.value)}
                    disabled={readOnly || !!record?.isVoided}
                  />
                  {mode === "new" ? (
                    <div className="field-help">
                      {suggestedSalesOrderNumber
                        ? "Suggested number. You may overwrite it if needed. Duplicate sales order numbers are not allowed."
                        : "You may enter a sales order number. Duplicate sales order numbers are not allowed."}
                    </div>
                  ) : (
                    <div className="field-help">Duplicate sales order numbers are not allowed.</div>
                  )}
                </FieldRow>

                <FieldRow label="PO #">
                  <input
                    className="input"
                    value={form.poNumber}
                    onChange={(e) => updateField("poNumber", e.target.value)}
                    disabled={readOnly || !!record?.isVoided}
                  />
                </FieldRow>

                <FieldRow label="Tape Name">
                  <input
                    className="input"
                    value={form.tapeName}
                    onChange={(e) => updateField("tapeName", e.target.value)}
                    disabled={readOnly || !!record?.isVoided}
                  />
                </FieldRow>

                <FieldRow label="Date Request Created">
                  <input className="input" value={createdDisplay} disabled />
                </FieldRow>

                <FieldRow label="Due Date">
                  <input
                    className="input"
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => updateField("dueDate", e.target.value)}
                    disabled={readOnly || !!record?.isVoided}
                  />
                </FieldRow>

                <FieldRow label="Customer">
                  <CustomerSearchCombobox
                    value={form.customerCode}
                    selectedName={form.customerName}
                    rows={customers}
                    disabled={readOnly || !!record?.isVoided}
                    onSelect={(row) => {
                      setForm((prev) => ({
                        ...prev,
                        customerCode: row.code,
                        customerName: row.name,
                      }));
                    }}
                    onTextChange={(text) => {
                      setForm((prev) => ({
                        ...prev,
                        customerCode: "",
                        customerName: text,
                      }));
                    }}
                  />
                </FieldRow>

                <FieldRow label="Bin #">
                  <select
                    className="select"
                    value={form.binCode}
                    onChange={(e) => updateField("binCode", e.target.value)}
                    disabled={readOnly || !!record?.isVoided}
                  >
                    <option value="">(Select)</option>
                    {bins.map((b) => (
                      <option key={b.id} value={b.code}>
                        {b.code}
                      </option>
                    ))}
                  </select>
                </FieldRow>

                <FieldRow label="Created By">
                  <input
                    className="input"
                    value={record?.createdByName || me?.displayName || me?.name || ""}
                    disabled
                  />
                </FieldRow>

                <FieldRow label="Digitizer">
                  <select
                    className="select"
                    value={form.digitizerUserId}
                    onChange={(e) => chooseDigitizer(e.target.value)}
                    disabled={readOnly || !!record?.isVoided}
                  >
                    <option value="">(Unspecified)</option>
                    {digitizers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </FieldRow>

                <FieldRow label="Designer">
                  <select
                    className="select"
                    value={form.designerUserId}
                    onChange={(e) => chooseDesigner(e.target.value)}
                    disabled={readOnly || !!record?.isVoided}
                  >
                    <option value="">(Unspecified)</option>
                    {designers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </FieldRow>

                <FieldRow label="Request Status">
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select
                      className="select"
                      value={form.statusId}
                      onChange={(e) => updateField("statusId", e.target.value)}
                      disabled={readOnly || !!record?.isVoided}
                      style={{ flex: 1 }}
                    >
                      <option value="">(Select)</option>
                      {statuses.map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={!requestId}
                      onClick={async () => {
                        setHistoryOpen(true);
                        await loadHistory();
                      }}
                    >
                      History
                    </button>
                  </div>
                </FieldRow>
              </div>

              <div style={rightColumn}>
                <FieldStack label="Instructions">
                  <textarea
                    className="textarea"
                    rows={7}
                    value={form.instructions}
                    onChange={(e) => updateField("instructions", e.target.value)}
                    disabled={readOnly || !!record?.isVoided}
                  />
                </FieldStack>

                <FieldRow label="Tape Number">
                  <input
                    className="input"
                    value={form.tapeNumber}
                    onChange={(e) => updateField("tapeNumber", e.target.value)}
                    disabled={readOnly || !!record?.isVoided}
                  />
                </FieldRow>

                <FieldRow label="Rush">
                  <label style={checkboxRow}>
                    <input
                      type="checkbox"
                      checked={form.rush}
                      onChange={(e) => updateField("rush", e.target.checked)}
                      disabled={readOnly || !!record?.isVoided}
                    />
                    <span>No</span>
                  </label>
                </FieldRow>

                <FieldRow label="Style">
                  <StyleSearchCombobox
                    value={form.styleCode}
                    rows={styles}
                    disabled={readOnly || !!record?.isVoided}
                    onSelect={(row) => updateField("styleCode", row.code)}
                    onTextChange={(text) => updateField("styleCode", text)}
                  />
                </FieldRow>

                <FieldRow label="Sample SO Number">
                  <input
                    className="input"
                    value={form.sampleSoNumber}
                    onChange={(e) => updateField("sampleSoNumber", e.target.value)}
                    disabled={readOnly || !!record?.isVoided}
                  />
                </FieldRow>

                <FieldRow label="Stitch Count">
                  <input
                    className="input"
                    value={form.stitchCount}
                    onChange={(e) => updateField("stitchCount", e.target.value)}
                    disabled={readOnly || !!record?.isVoided}
                  />
                </FieldRow>

                <FieldRow label="ART PROOF">
                  <label style={checkboxRow}>
                    <input
                      type="checkbox"
                      checked={form.artProof}
                      onChange={(e) => updateField("artProof", e.target.checked)}
                      disabled={readOnly || !!record?.isVoided}
                    />
                    <span>No</span>
                  </label>
                </FieldRow>

                {record ? (
                  <div style={metaBox}>
                    <div><strong>Current Status:</strong> {record.statusLabel}</div>
                    <div><strong>Created:</strong> {fmtDateTime(record.createdAt)}</div>
                    <div><strong>Updated:</strong> {fmtDateTime(record.updatedAt)}</div>
                  </div>
                ) : selectedStatusLabel ? (
                  <div style={metaBox}>
                    <div><strong>Selected Status:</strong> {selectedStatusLabel}</div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "additional" ? (
            <div style={singlePane}>
              <textarea
                className="textarea"
                rows={18}
                value={form.additionalInstructions}
                onChange={(e) => updateField("additionalInstructions", e.target.value)}
                disabled={readOnly || !!record?.isVoided}
                placeholder="Additional instructions..."
              />
            </div>
          ) : null}

          {tab === "colorways" ? (
            <div style={singlePane}>
              <textarea
                className="textarea"
                rows={18}
                value={form.colorwaysText}
                onChange={(e) => updateField("colorwaysText", e.target.value)}
                disabled={readOnly || !!record?.isVoided}
                placeholder="Colorways..."
              />
            </div>
          ) : null}

          {tab === "attachments" ? (
            <div style={singlePane}>
              {requestId ? (
                <AttachmentsPanel entityType="design_workflow" entityId={requestId} />
              ) : (
                <div className="alert alert-info">
                  Save the request first before adding attachments.
                </div>
              )}
            </div>
          ) : null}

          {tab === "history" ? (
            <div style={{ padding: 12, display: "grid", gap: 14 }}>
              {!requestId ? (
                <div className="alert alert-info">
                  Save the request first before viewing history or comments.
                </div>
              ) : (
                <>
                  <div className="card">
                    <div style={{ marginBottom: 10, fontWeight: 700 }}>Status History</div>

                    {historyLoading ? (
                      <div className="text-soft">Loading status history…</div>
                    ) : historyRows.length === 0 ? (
                      <div className="text-soft">No status history yet.</div>
                    ) : (
                      <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                        <table className="table-clean" style={{ width: "100%" }}>
                          <thead>
                            <tr>
                              <th>Date / Time</th>
                              <th>User</th>
                              <th>Event</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyRows.map((row) => (
                              <tr key={row.id}>
                                <td>{fmtDateTime(row.changedAt)}</td>
                                <td>{row.changedByName || row.changedByUserId || ""}</td>
                                <td>{row.statusLabel}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <CommentsPanel entityType="design_workflow" entityId={requestId} />
                  <ActivityHistoryPanel
                    entityType="design_workflow"
                    entityId={requestId}
                    defaultExpanded={true}
                  />
                </>
              )}
            </div>
          ) : null}

          <div style={footerBar}>
            <label style={checkboxRow}>
              <input type="checkbox" disabled />
              <span>Include Letterhead</span>
            </label>

            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {!readOnly ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saving || !!record?.isVoided}
                  onClick={onSubmit}
                >
                  {saving ? "Saving..." : "OK"}
                </button>
              ) : (
                requestId && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => onSaved?.({ id: requestId })}
                  >
                    Edit
                  </button>
                )
              )}

              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>

              <button type="button" className="btn btn-secondary" disabled>
                Help
              </button>
            </div>
          </div>
        </div>
      </div>

      {historyOpen ? (
        <div style={historyOverlay}>
          <div style={historyWindow}>
            <div style={historyTitleBar}>
              <div style={{ fontWeight: 700 }}>Design Request Status History</div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                style={closeBtn}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div style={{ padding: 16 }}>
              <div style={{ marginBottom: 12, fontWeight: 700 }}>
                -- Design Request Status History --
              </div>

              {historyLoading ? (
                <div className="text-soft">Loading status history…</div>
              ) : historyRows.length === 0 ? (
                <div className="text-soft">No status history yet.</div>
              ) : (
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  <table className="table-clean" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th>Date / Time</th>
                        <th>User</th>
                        <th>Event</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRows.map((row) => (
                        <tr key={row.id}>
                          <td>{fmtDateTime(row.changedAt)}</td>
                          <td>{row.changedByName || row.changedByUserId || ""}</td>
                          <td>{row.statusLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={historyFooter}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setHistoryOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  if (loading) {
    const loadingShell = (
      <div className="card">
        <div className="text-soft">Loading design request…</div>
      </div>
    );

    if (isModal) {
      return renderModalWindow(loadingShell);
    }

    return <div className="page-shell-wide">{loadingShell}</div>;
  }

  if (isModal) {
    return renderModalWindow(shell);
  }

  return <div className="page-shell-wide">{shell}</div>;
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...tabBtn,
        ...(active ? tabBtnActive : tabBtnInactive),
      }}
    >
      {children}
    </button>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={fieldRow}>
      <label style={fieldLabel}>{label}</label>
      <div>{children}</div>
    </div>
  );
}

function FieldStack({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label style={fieldLabel}>{label}</label>
      <div>{children}</div>
    </div>
  );
}



const lookupMenu: React.CSSProperties = {
  position: "absolute",
  zIndex: 9999,
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  maxHeight: 260,
  overflowY: "auto",
  background: "var(--surface)",
  border: "1px solid var(--border-strong)",
  borderRadius: 10,
  boxShadow: "var(--shadow-md)",
};

const lookupItem: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "8px 10px",
  border: 0,
  borderBottom: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  cursor: "pointer",
  font: "inherit",
};

const lookupEmpty: React.CSSProperties = {
  padding: 10,
  color: "var(--text-soft)",
};

const lookupError: React.CSSProperties = {
  padding: 10,
  color: "var(--brand-red)",
  fontWeight: 700,
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(17,17,17,0.34)",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "42px 20px 20px",
  zIndex: 1000,
  overflow: "hidden",
};

function getModalWindowStyle(size: { width: number; height: number }): React.CSSProperties {
  return {
    width: Math.min(size.width, window.innerWidth - 40),
    height: Math.min(size.height, window.innerHeight - 64),
    maxWidth: "calc(100vw - 40px)",
    maxHeight: "calc(100vh - 64px)",
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
  };
}

const modalResizeRight: React.CSSProperties = {
  position: "absolute",
  top: 0,
  right: -2,
  width: 12,
  height: "100%",
  cursor: "ew-resize",
  zIndex: 5,
};

const modalResizeBottom: React.CSSProperties = {
  position: "absolute",
  left: 0,
  bottom: -2,
  width: "100%",
  height: 12,
  cursor: "ns-resize",
  zIndex: 5,
};

const modalResizeCorner: React.CSSProperties = {
  position: "absolute",
  right: 0,
  bottom: 0,
  width: 18,
  height: 18,
  cursor: "nwse-resize",
  zIndex: 6,
};

const notFoundWrap: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: 16,
  boxShadow: "var(--shadow-md)",
};

const windowWrap: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  boxShadow: "var(--shadow-md)",
  overflow: "hidden",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
};

const toolStrip: React.CSSProperties = {
  display: "flex",
  gap: 8,
  padding: "8px 10px",
  borderBottom: "1px solid var(--border)",
  background: "var(--surface-muted)",
};

const tabStrip: React.CSSProperties = {
  display: "flex",
  gap: 3,
  padding: "8px 8px 0 8px",
  borderBottom: "1px solid var(--border)",
  background: "#f3f3f3",
};

const tabBtn: React.CSSProperties = {
  padding: "6px 11px",
  borderTopLeftRadius: 4,
  borderTopRightRadius: 4,
  fontSize: 12,
  cursor: "pointer",
};

const tabBtnActive: React.CSSProperties = {
  background: "#fff",
  borderTop: "1px solid var(--border)",
  borderRight: "1px solid var(--border)",
  borderLeft: "1px solid var(--border)",
  borderBottom: "1px solid #fff",
  fontWeight: 700,
};

const tabBtnInactive: React.CSSProperties = {
  background: "#ececec",
  borderTop: "1px solid var(--border)",
  borderRight: "1px solid var(--border)",
  borderLeft: "1px solid var(--border)",
  borderBottom: "1px solid var(--border)",
};

const windowBody: React.CSSProperties = {
  display: "grid",
  gap: 0,
  flex: 1,
  minHeight: 0,
  overflow: "auto",
};

const generalGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 300px",
  gap: 18,
  padding: 12,
};

const leftColumn: React.CSSProperties = {
  display: "grid",
  gap: 8,
  alignContent: "start",
};

const rightColumn: React.CSSProperties = {
  display: "grid",
  gap: 10,
  alignContent: "start",
};

const singlePane: React.CSSProperties = {
  padding: 12,
};

const fieldRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "110px 1fr",
  gap: 8,
  alignItems: "center",
};

const fieldLabel: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 12,
  color: "var(--text)",
};

const checkboxRow: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 32,
  fontSize: 12,
};

const metaBox: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--surface-subtle)",
  padding: 10,
  display: "grid",
  gap: 5,
  fontSize: 12,
};

const footerBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: 12,
  borderTop: "1px solid var(--border)",
  background: "var(--surface-muted)",
};

const historyOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(17,17,17,0.28)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1100,
  padding: 24,
};

const historyWindow: React.CSSProperties = {
  width: "min(760px, 100%)",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  boxShadow: "0 16px 40px rgba(0,0,0,0.22)",
  overflow: "hidden",
};

const historyTitleBar: React.CSSProperties = {
  background: "var(--brand-blue)",
  color: "#fff",
  padding: "10px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const historyFooter: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  padding: 14,
  borderTop: "1px solid var(--border)",
  background: "var(--surface-muted)",
};

const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: 22,
  lineHeight: 1,
  cursor: "pointer",
};