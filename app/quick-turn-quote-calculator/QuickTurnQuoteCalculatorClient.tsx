// app/quick-turn-quote-calculator/QuickTurnQuoteCalculatorClient.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  QuickTurnAccessory,
  QuickTurnCalculatePayload,
  QuickTurnCalculationResult,
  QuickTurnLookupPayload,
  QuickTurnCustomerOption,
  QuickTurnOverseasCustomerServiceUser,
  QuickTurnQuoteInputAccessory,
  QuickTurnQuoteInputFee,
  QuickTurnQuoteInputItem,
  SavedQuickTurnQuoteDetail,
} from "./types";
import { QUICK_TURN_CUSTOM_CAP_BASE_ITEM_ID } from "./types";
import { QuickTurnCalculatedResults } from "./QuickTurnQuoteResults";
import { fmtMoneyPrecise } from "./format";
import {
  buildQuickTurnItemPricePreview,
  calculateAccessoryPricePreview,
  type QuickTurnAccessoryPricePreview,
} from "./quickTurnQuotePreview";

type UiAccessoryRow = {
  id: string;
  accessoryId: string;
  inputValues: Record<string, string>;
};

type UiFeeRow = {
  id: string;
  feeTypeId: string;
  amount: string;
  notes: string;
};

type UiQuoteItem = {
  id: string;
  baseItemId: string;
  customCapCost: string;
  customCapDescription: string;
  baseItemDescription: string;
  accessories: UiAccessoryRow[];
  closureAccessoryId: string;
  closureInputValues: Record<string, string>;
  camoOptionId: string;
  fees: UiFeeRow[];
  notes: string;
};

const EMPTY_LOOKUPS: QuickTurnLookupPayload = {
  programs: [],
  factories: [],
  baseItems: [],
  accessories: [],
  camoOptions: [],
  calculators: [],
  feeTypes: [],
};

function newId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEmptyItem(): UiQuoteItem {
  return {
    id: newId("item"),
    baseItemId: "",
    customCapCost: "",
    customCapDescription: "",
    baseItemDescription: "",
    accessories: [],
    closureAccessoryId: "",
    closureInputValues: {},
    camoOptionId: "",
    fees: [],
    notes: "",
  };
}

function createAccessoryRow(): UiAccessoryRow {
  return {
    id: newId("accessory"),
    accessoryId: "",
    inputValues: {},
  };
}

function createFeeRow(): UiFeeRow {
  return {
    id: newId("fee"),
    feeTypeId: "",
    amount: "",
    notes: "",
  };
}

function inputConfig(accessory?: QuickTurnAccessory | null) {
  return accessory?.inputConfig || {};
}

function needs(config: Record<string, unknown>, key: string) {
  return config[key] === true;
}

function sortByName<T extends { name?: string; itemCode?: string; series?: string }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const av = a.itemCode || a.name || a.series || "";
    const bv = b.itemCode || b.name || b.series || "";
    return av.localeCompare(bv);
  });
}

function isCustomCap(item: UiQuoteItem) {
  return item.baseItemId === QUICK_TURN_CUSTOM_CAP_BASE_ITEM_ID;
}

function buildPayload(
  programId: string,
  factoryId: string,
  workflowSalesOrderNumber: string,
  overseasCustomerServiceUserId: string,
  rebatePercent: string,
  customerHeader: {
    preparedForCustomerId: string;
    preparedForCustomerCodeSnapshot: string;
    preparedForCustomerNameSnapshot: string;
    quotePreparedForDisplay: string;
    programLogoText: string;
    fob: string;
  },
  items: UiQuoteItem[]
): QuickTurnCalculatePayload {
  return {
    programId: programId || null,
    factoryId: factoryId || null,
    workflowSalesOrderNumber: workflowSalesOrderNumber.trim() || null,
    overseasCustomerServiceUserId: overseasCustomerServiceUserId || null,
    rebatePercent: rebatePercent === "" ? null : rebatePercent,
    preparedForCustomerId: customerHeader.preparedForCustomerId || null,
    preparedForCustomerCodeSnapshot: customerHeader.preparedForCustomerCodeSnapshot || null,
    preparedForCustomerNameSnapshot: customerHeader.preparedForCustomerNameSnapshot || null,
    quotePreparedForDisplay: customerHeader.quotePreparedForDisplay.trim() || null,
    programLogoText: customerHeader.programLogoText.trim() || null,
    fob: customerHeader.fob.trim() || "1 U.S. Final Destination",
    items: items.map((item, itemIndex) => {
      const accessories: QuickTurnQuoteInputAccessory[] = item.accessories
        .filter((row) => row.accessoryId)
        .map((row, accessoryIndex) => ({
          accessoryId: row.accessoryId,
          inputValues: row.inputValues,
          sortOrder: accessoryIndex * 10 + 10,
        }));

      const closure = item.closureAccessoryId
        ? {
            accessoryId: item.closureAccessoryId,
            inputValues: item.closureInputValues,
            sortOrder: 9000,
          }
        : null;

      const fees: QuickTurnQuoteInputFee[] = item.fees
        .filter((fee) => fee.feeTypeId || fee.amount)
        .map((fee, feeIndex) => ({
          feeTypeId: fee.feeTypeId || null,
          amount: fee.amount || 0,
          notes: fee.notes || null,
          sortOrder: feeIndex * 10 + 10,
        }));

      const payloadItem: QuickTurnQuoteInputItem = {
        clientItemId: item.id,
        baseItemId: item.baseItemId || null,
        isCustomCap: isCustomCap(item),
        customCapCost: isCustomCap(item) ? item.customCapCost : null,
        customCapDescription: isCustomCap(item) ? item.customCapDescription.trim() || null : null,
        baseItemDescription: isCustomCap(item) ? null : item.baseItemDescription.trim() || null,
        baseItemDescriptionOverride: isCustomCap(item) ? null : item.baseItemDescription.trim() || null,
        accessories,
        closure,
        camoOptionId: item.camoOptionId || null,
        fees,
        notes: item.notes || null,
        sortOrder: itemIndex * 10 + 10,
      };

      return payloadItem;
    }),
  };
}

function safeInputValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    out[key] = raw === null || raw === undefined ? "" : String(raw);
  }
  return out;
}

function snapshotInput(row: SavedQuickTurnQuoteDetail): any {
  const direct = row.inputSnapshot as any;
  if (direct && typeof direct === "object" && Array.isArray(direct.items)) return direct;
  const result = row.resultSnapshot as any;
  if (result?.input && typeof result.input === "object" && Array.isArray(result.input.items)) return result.input;
  return null;
}

function snapshotResultItems(row: SavedQuickTurnQuoteDetail): any[] {
  const result = row.resultSnapshot as any;
  return Array.isArray(result?.items) ? result.items : [];
}

function uiItemsFromSavedQuote(row: SavedQuickTurnQuoteDetail): UiQuoteItem[] {
  const input = snapshotInput(row);
  const rawItems = Array.isArray(input?.items) ? input.items : [];
  const resultItems = snapshotResultItems(row);

  if (!rawItems.length) return [createEmptyItem()];

  return rawItems.map((rawItem: any, itemIndex: number) => {
    const custom = rawItem?.isCustomCap === true || rawItem?.baseItemId === QUICK_TURN_CUSTOM_CAP_BASE_ITEM_ID;
    const closure = rawItem?.closure || null;
    const accessories = Array.isArray(rawItem?.accessories) ? rawItem.accessories : [];
    const fees = Array.isArray(rawItem?.fees) ? rawItem.fees : [];
    const resultItem = resultItems[itemIndex] ?? null;
    const savedBaseDescription =
      rawItem?.baseItemDescription ??
      rawItem?.baseItemDescriptionOverride ??
      resultItem?.baseItem?.fabricDescription ??
      "";

    return {
      id: String(rawItem?.clientItemId || `item-${itemIndex + 1}-${newId("loaded")}`),
      baseItemId: custom ? QUICK_TURN_CUSTOM_CAP_BASE_ITEM_ID : String(rawItem?.baseItemId || ""),
      customCapCost: rawItem?.customCapCost === null || rawItem?.customCapCost === undefined ? "" : String(rawItem.customCapCost),
      customCapDescription: String(rawItem?.customCapDescription || ""),
      baseItemDescription: String(savedBaseDescription || ""),
      accessories: accessories
        .filter((x: any) => x?.accessoryId)
        .map((x: any, index: number) => ({
          id: newId(`loaded-accessory-${index}`),
          accessoryId: String(x.accessoryId),
          inputValues: safeInputValues(x.inputValues),
        })),
      closureAccessoryId: String(closure?.accessoryId || rawItem?.closureAccessoryId || ""),
      closureInputValues: safeInputValues(closure?.inputValues || rawItem?.closureInputValues),
      camoOptionId: String(rawItem?.camoOptionId || ""),
      fees: fees.map((fee: any, index: number) => ({
        id: newId(`loaded-fee-${index}`),
        feeTypeId: fee?.feeTypeId === null || fee?.feeTypeId === undefined ? "" : String(fee.feeTypeId),
        amount: fee?.amount === null || fee?.amount === undefined ? "" : String(fee.amount),
        notes: String(fee?.notes || ""),
      })),
      notes: String(rawItem?.notes || ""),
    };
  });
}

function accessoryInputFields(
  accessory: QuickTurnAccessory | undefined,
  values: Record<string, string>,
  onChange: (next: Record<string, string>) => void
) {
  if (!accessory) return null;

  const config = inputConfig(accessory);
  const fields: ReactNode[] = [];

  if (needs(config, "requiresStitchCount")) {
    fields.push(
      <label key="stitchCount">
        <span>Stitch Count</span>
        <input
          className="input"
          type="number"
          min="0"
          step="1"
          value={values.stitchCount || ""}
          onChange={(e) => onChange({ ...values, stitchCount: e.target.value })}
          placeholder="Example: 8000"
        />
      </label>
    );
  }

  if (needs(config, "requiresEmbroideryType")) {
    fields.push(
      <label key="embroideryType">
        <span>Embroidery Type</span>
        <select
          className="select"
          value={values.embroideryType || ""}
          onChange={(e) => onChange({ ...values, embroideryType: e.target.value })}
        >
          <option value="">Select embroidery type…</option>
          <option value="FLAT_EMBROIDERY">Flat Embroidery</option>
          <option value="3_D_EMBROIDERY">3-D Embroidery</option>
        </select>
      </label>
    );
  }

  if (needs(config, "requiresColorCount")) {
    fields.push(
      <label key="colorCount">
        <span>Color Count</span>
        <input
          className="input"
          type="number"
          min="0"
          step="1"
          value={values.colorCount || ""}
          onChange={(e) => onChange({ ...values, colorCount: e.target.value })}
          placeholder="Number of colors"
        />
      </label>
    );
  }

  if (needs(config, "requiresPanelCount")) {
    fields.push(
      <label key="panelCount">
        <span>Panel Count</span>
        <input
          className="input"
          type="number"
          min="0"
          step="1"
          value={values.panelCount || ""}
          onChange={(e) => onChange({ ...values, panelCount: e.target.value })}
          placeholder="Number of panels"
        />
      </label>
    );
  }

  if (needs(config, "requiresRowCount")) {
    fields.push(
      <label key="rowCount">
        <span>Row Count</span>
        <input
          className="input"
          type="number"
          min="0"
          step="1"
          value={values.rowCount || ""}
          onChange={(e) => onChange({ ...values, rowCount: e.target.value })}
          placeholder="Number of rows"
        />
      </label>
    );
  }

  if (!fields.length) return null;

  return <div className="record-meta-grid" style={{ marginTop: 8 }}>{fields}</div>;
}

function PricePreviewBox({
  title,
  preview,
}: {
  title: string;
  preview: QuickTurnAccessoryPricePreview;
}) {
  if (!preview.components.length && !preview.missingInputs.length) return null;

  return (
    <div className="muted-box" style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <strong>{title}</strong>
        <strong>{preview.isReady && preview.total !== null ? fmtMoneyPrecise(preview.total) : "Enter required inputs"}</strong>
      </div>

      {preview.missingInputs.length ? (
        <div className="text-muted" style={{ marginTop: 4 }}>
          Missing: {preview.missingInputs.join(", ")}
        </div>
      ) : null}

      {preview.components.length ? (
        <div className="record-badge-row" style={{ marginTop: 8 }}>
          {preview.components.map((row, index) => (
            <span key={`${row.label}-${index}`} className="record-pill record-pill-neutral" title={row.formula || undefined}>
              {row.label}: {row.amount === null ? "—" : fmtMoneyPrecise(row.amount)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function QuickTurnQuoteCalculatorClient() {
  const router = useRouter();
  const [lookups, setLookups] = useState<QuickTurnLookupPayload>(EMPTY_LOOKUPS);
  const [programId, setProgramId] = useState("");
  const [factoryId, setFactoryId] = useState("");
  const [workflowSalesOrderNumber, setWorkflowSalesOrderNumber] = useState("");
  const [overseasCustomerServiceUsers, setOverseasCustomerServiceUsers] = useState<QuickTurnOverseasCustomerServiceUser[]>([]);
  const [overseasCustomerServiceUserId, setOverseasCustomerServiceUserId] = useState("");
  const [quoteRebatePercent, setQuoteRebatePercent] = useState("");
  const [preparedForCustomerId, setPreparedForCustomerId] = useState("");
  const [preparedForCustomerCodeSnapshot, setPreparedForCustomerCodeSnapshot] = useState("");
  const [preparedForCustomerNameSnapshot, setPreparedForCustomerNameSnapshot] = useState("");
  const [quotePreparedForDisplay, setQuotePreparedForDisplay] = useState("");
  const [programLogoText, setProgramLogoText] = useState("");
  const [fob, setFob] = useState("1 U.S. Final Destination");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOptions, setCustomerOptions] = useState<QuickTurnCustomerOption[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [items, setItems] = useState<UiQuoteItem[]>([createEmptyItem()]);
  const [quoteName, setQuoteName] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [result, setResult] = useState<QuickTurnCalculationResult | null>(null);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [savedQuoteNumber, setSavedQuoteNumber] = useState<string | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editingDraftNumber, setEditingDraftNumber] = useState<string | null>(null);
  const [sourceQuoteNumber, setSourceQuoteNumber] = useState<string | null>(null);
  const [canMaintainSetup, setCanMaintainSetup] = useState(false);

  const selectedProgramId = programId || String(lookups.programs[0]?.id || "");
  const selectedFactoryId = factoryId || String(lookups.factories[0]?.id || "");
  const customerHeader = {
    preparedForCustomerId,
    preparedForCustomerCodeSnapshot,
    preparedForCustomerNameSnapshot,
    quotePreparedForDisplay,
    programLogoText,
    fob,
  };

  const decorations = useMemo(
    () => sortByName(lookups.accessories.filter((x) => x.category === "DECORATION")),
    [lookups.accessories]
  );
  const closures = useMemo(
    () => sortByName(lookups.accessories.filter((x) => x.category === "CLOSURE")),
    [lookups.accessories]
  );
  const baseItems = useMemo(() => sortByName(lookups.baseItems), [lookups.baseItems]);
  const camoOptions = useMemo(
    () => [...lookups.camoOptions].sort((a, b) => a.series.localeCompare(b.series)),
    [lookups.camoOptions]
  );

  const accessoryById = useMemo(() => {
    return new Map(lookups.accessories.map((x) => [x.id, x]));
  }, [lookups.accessories]);

  async function loadDraftForEdit(id: string) {
    const res = await fetch(`/api/quick-turn-quote-calculator/quotes/${encodeURIComponent(id)}?includeVoided=true`, {
      cache: "no-store",
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Failed to load Quick Turn draft.");

    const row = data?.row as SavedQuickTurnQuoteDetail | null;
    if (!row) throw new Error("Quick Turn draft not found.");
    if (row.isVoided) throw new Error("Voided Quick Turn quotes cannot be edited.");
    if (row.quoteStatus !== "DRAFT") {
      throw new Error("Published Quick Turn quotes are locked. Use Duplicate/Revise to make changes.");
    }

    const input = snapshotInput(row);
    setQuoteName(row.quoteName || "");
    setQuoteNotes(row.notes || "");
    setWorkflowSalesOrderNumber(row.workflowSalesOrderNumber || input?.workflowSalesOrderNumber || "");
    setOverseasCustomerServiceUserId(row.overseasCustomerServiceUserId || input?.overseasCustomerServiceUserId || "");
    const savedRebateRate = row.quoteRebateRate ?? input?.quoteRebateRate ?? null;
    const savedRebatePercent = input?.rebatePercent ?? (savedRebateRate === null || savedRebateRate === undefined ? "" : Number(savedRebateRate) * 100);
    setQuoteRebatePercent(savedRebatePercent === null || savedRebatePercent === undefined ? "" : String(savedRebatePercent));
    setPreparedForCustomerId(row.preparedForCustomerId || input?.preparedForCustomerId || "");
    setPreparedForCustomerCodeSnapshot(row.preparedForCustomerCodeSnapshot || input?.preparedForCustomerCodeSnapshot || "");
    setPreparedForCustomerNameSnapshot(row.preparedForCustomerNameSnapshot || input?.preparedForCustomerNameSnapshot || "");
    setQuotePreparedForDisplay(row.quotePreparedForDisplay || input?.quotePreparedForDisplay || "");
    setProgramLogoText(row.programLogoText || input?.programLogoText || "");
    setFob(row.fob || input?.fob || "1 U.S. Final Destination");
    setCustomerSearch(row.quotePreparedForDisplay || row.preparedForCustomerNameSnapshot || "");
    setProgramId(input?.programId ? String(input.programId) : "");
    setFactoryId(input?.factoryId ? String(input.factoryId) : "");
    setItems(uiItemsFromSavedQuote(row));
    setResult((row.resultSnapshot as QuickTurnCalculationResult) || null);
    setSavedQuoteId(row.id);
    setSavedQuoteNumber(row.quoteNumber);
    setEditingDraftId(row.id);
    setEditingDraftNumber(row.quoteNumber);
    setSourceQuoteNumber(row.sourceQuoteNumber || null);
    setSaveMessage(`Editing draft ${row.quoteNumber}.`);
  }

  useEffect(() => {
    async function loadLookups() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/quick-turn-quote-calculator/lookups", {
          cache: "no-store",
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load Quick Turn setup data.");
        }

        setLookups({ ...EMPTY_LOOKUPS, ...data });
        setProgramId(String(data?.programs?.[0]?.id || ""));
        setFactoryId(String(data?.factories?.[0]?.id || ""));

        const setupAccessRes = await fetch("/api/quick-turn-quote-calculator/setup/access", {
          cache: "no-store",
          credentials: "include",
        });
        const setupAccess = await setupAccessRes.json().catch(() => ({}));
        setCanMaintainSetup(setupAccessRes.ok && setupAccess?.canMaintain === true);

        const osCsRes = await fetch("/api/quick-turn-quote-calculator/overseas-cs-users", {
          cache: "no-store",
          credentials: "include",
        });
        const osCsData = await osCsRes.json().catch(() => ({}));
        setOverseasCustomerServiceUsers(osCsRes.ok && Array.isArray(osCsData?.rows) ? osCsData.rows : []);

        const editId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("edit") : null;
        if (editId) await loadDraftForEdit(editId);
      } catch (err: any) {
        setError(err?.message || "Failed to load Quick Turn setup data.");
      } finally {
        setLoading(false);
      }
    }

    loadLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    const search = customerSearch.trim();
    let cancelled = false;

    async function run() {
      try {
        setLoadingCustomers(true);
        const params = new URLSearchParams();
        if (search) params.set("q", search);
        const res = await fetch(`/api/quick-turn-quote-calculator/customers?${params.toString()}`, {
          cache: "no-store",
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setCustomerOptions(Array.isArray(data?.rows) ? data.rows : []);
      } catch {
        if (!cancelled) setCustomerOptions([]);
      } finally {
        if (!cancelled) setLoadingCustomers(false);
      }
    }

    const t = window.setTimeout(run, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [customerSearch]);

  function chooseCustomer(customer: QuickTurnCustomerOption) {
    setPreparedForCustomerId(customer.id);
    setPreparedForCustomerCodeSnapshot(customer.code);
    setPreparedForCustomerNameSnapshot(customer.name);
    setQuotePreparedForDisplay((current) => current || customer.label);
    setCustomerSearch(customer.label);
    setSaveMessage(null);
  }

  function clearCustomerSelection() {
    setPreparedForCustomerId("");
    setPreparedForCustomerCodeSnapshot("");
    setPreparedForCustomerNameSnapshot("");
    setQuotePreparedForDisplay("");
    setCustomerSearch("");
    setSaveMessage(null);
  }

  function clearSavedState() {
    setResult(null);
    setSavedQuoteId(null);
    setSavedQuoteNumber(null);
    setSaveMessage(null);
  }

  function updateItem(itemId: string, updater: (item: UiQuoteItem) => UiQuoteItem) {
    setItems((prev) => prev.map((item) => (item.id === itemId ? updater(item) : item)));
    clearSavedState();
  }

  function removeItem(itemId: string) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item.id !== itemId)));
    clearSavedState();
  }

  function addItem() {
    setItems((prev) => [...prev, createEmptyItem()]);
    clearSavedState();
  }

  async function generateQuote() {
    try {
      setCalculating(true);
      setError(null);
      setSaveMessage(null);
      if (!editingDraftId) {
        setSavedQuoteId(null);
        setSavedQuoteNumber(null);
      }
      if (!overseasCustomerServiceUserId) {
        throw new Error("OS Customer Service is required before generating.");
      }

      const payload = buildPayload(selectedProgramId, selectedFactoryId, workflowSalesOrderNumber, overseasCustomerServiceUserId, quoteRebatePercent, customerHeader, items);
      const res = await fetch("/api/quick-turn-quote-calculator/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to generate Quick Turn quote.");
      }

      setResult(data as QuickTurnCalculationResult);
    } catch (err: any) {
      setError(err?.message || "Failed to generate Quick Turn quote.");
      setResult(null);
    } finally {
      setCalculating(false);
    }
  }

  async function saveDraft(options: { quiet?: boolean } = {}) {
    if (!quoteName.trim()) {
      throw new Error("Customer Quote # / Quote Name is required before saving.");
    }
    if (!overseasCustomerServiceUserId) {
      throw new Error("OS Customer Service is required before saving.");
    }

    setSaving(true);
    setError(null);
    if (!options.quiet) setSaveMessage(null);

    try {
      const payload = {
        ...buildPayload(selectedProgramId, selectedFactoryId, workflowSalesOrderNumber, overseasCustomerServiceUserId, quoteRebatePercent, customerHeader, items),
        quoteName: quoteName.trim(),
        notes: quoteNotes.trim() || null,
      };

      const url = editingDraftId
        ? `/api/quick-turn-quote-calculator/quotes/${encodeURIComponent(editingDraftId)}`
        : "/api/quick-turn-quote-calculator/quotes";
      const method = editingDraftId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save Quick Turn draft.");
      }

      setResult(data.calculation as QuickTurnCalculationResult);
      setSavedQuoteId(data.id || null);
      setSavedQuoteNumber(data.quoteNumber || null);
      setEditingDraftId(data.id || null);
      setEditingDraftNumber(data.quoteNumber || null);
      if (!options.quiet) setSaveMessage(`Draft saved: ${data.quoteNumber || "Quick Turn quote"}.`);
      return data as { id: string; quoteNumber: string; calculation: QuickTurnCalculationResult };
    } finally {
      setSaving(false);
    }
  }

  async function onSaveDraft() {
    try {
      await saveDraft();
    } catch (err: any) {
      setError(err?.message || "Failed to save Quick Turn draft.");
    }
  }

  async function publishQuote() {
    try {
      setPublishing(true);
      setError(null);
      setSaveMessage(null);

      const saved = await saveDraft({ quiet: true });
      const quoteId = saved.id;

      const res = await fetch(`/api/quick-turn-quote-calculator/quotes/${encodeURIComponent(quoteId)}/publish`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to publish Quick Turn quote.");
      }

      setSaveMessage(`Published ${saved.quoteNumber}.`);
      router.push(`/quick-turn-quote-calculator/saved/${encodeURIComponent(quoteId)}`);
    } catch (err: any) {
      setError(err?.message || "Failed to publish Quick Turn quote.");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <main className="page-shell-wide">
        <div className="card">Loading Quick Turn Quote Calculator…</div>
      </main>
    );
  }

  return (
    <main className="page-shell-wide">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Quick Turn Quote Calculator</h1>
          <p className="page-subtitle">
            Generate Quick Turn pricing across Standard QT, DDP MO Air QT, and DDP Direct Air QT.
          </p>
          <div className="record-badge-row" style={{ marginTop: 8 }}>
            {editingDraftId ? <span className="record-pill record-pill-warning">Editing Draft {editingDraftNumber}</span> : null}
            {sourceQuoteNumber ? <span className="record-pill record-pill-neutral">Revision from {sourceQuoteNumber}</span> : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/quick-turn-quote-calculator/saved" className="btn btn-secondary">
            Saved Quotes
          </Link>
          {canMaintainSetup ? (
            <Link href="/quick-turn-quote-calculator/setup" className="btn btn-secondary">
              Setup
            </Link>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.print()}
            disabled={!result}
          >
            Print Results
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={generateQuote}
            disabled={calculating || saving || publishing}
          >
            {calculating ? "Generating…" : "Generate Quote"}
          </button>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {saveMessage ? <div className="alert alert-success">{saveMessage}</div> : null}

      <section className="section-card">
        <div className="record-section-header">
          <h2 className="record-section-title">Quote Setup</h2>
        </div>

        <div className="record-meta-grid">
          <label>
            <span>Program</span>
            <select className="select" value={selectedProgramId} onChange={(e) => setProgramId(e.target.value)}>
              {lookups.programs.map((program) => (
                <option key={program.id} value={String(program.id)}>
                  {program.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Factory</span>
            <select className="select" value={selectedFactoryId} onChange={(e) => setFactoryId(e.target.value)}>
              {lookups.factories.map((factory) => (
                <option key={factory.id} value={String(factory.id)}>
                  {factory.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Customer Quote # / Quote Name</span>
            <input
              className="input"
              value={quoteName}
              onChange={(e) => setQuoteName(e.target.value)}
              placeholder="Example: CM-26047"
            />
          </label>

          <label>
            <span>Workflow SO / Reference #</span>
            <input
              className="input"
              value={workflowSalesOrderNumber}
              onChange={(e) => setWorkflowSalesOrderNumber(e.target.value)}
              placeholder="Example: 181474"
            />
          </label>

          <label>
            <span>OS Customer Service *</span>
            <select
              className="select"
              value={overseasCustomerServiceUserId}
              onChange={(e) => setOverseasCustomerServiceUserId(e.target.value)}
              required
            >
              <option value="">Select Overseas CS user…</option>
              {overseasCustomerServiceUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName}{user.email ? ` — ${user.email}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Rebate %</span>
            <input
              className="input"
              type="number"
              min="0"
              max="99.999"
              step="0.001"
              value={quoteRebatePercent}
              onChange={(e) => setQuoteRebatePercent(e.target.value)}
              placeholder="Example: 7"
            />
            <div className="text-muted" style={{ marginTop: 4 }}>
              Adds to each configured break margin. Example: 7% + 43% = 50%.
            </div>
          </label>

          <label>
            <span>Program Logo Text</span>
            <input
              className="input"
              value={programLogoText}
              onChange={(e) => setProgramLogoText(e.target.value)}
              placeholder="Example: ACI"
            />
          </label>

          <label>
            <span>FOB / Destination</span>
            <input
              className="input"
              value={fob}
              onChange={(e) => setFob(e.target.value)}
              placeholder="1 U.S. Final Destination"
            />
          </label>

          <label>
            <span>Customer Search</span>
            <input
              className="input"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Search Workflow customer list"
            />
            {loadingCustomers ? <small>Loading customers…</small> : null}
          </label>

          <label>
            <span>Select Customer</span>
            <select
              className="select"
              value={preparedForCustomerId}
              onChange={(e) => {
                const selected = customerOptions.find((x) => x.id === e.target.value);
                if (selected) chooseCustomer(selected);
                if (!e.target.value) clearCustomerSelection();
              }}
            >
              <option value="">Select customer…</option>
              {customerOptions.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.label}
                </option>
              ))}
            </select>
          </label>

          <label className="record-meta-item-full">
            <span>Quote Prepared For Display</span>
            <input
              className="input"
              value={quotePreparedForDisplay}
              onChange={(e) => setQuotePreparedForDisplay(e.target.value)}
              placeholder="Customer-facing prepared-for text"
            />
          </label>

          <label className="record-meta-item-full">
            <span>Quote Notes</span>
            <textarea
              className="textarea"
              value={quoteNotes}
              onChange={(e) => setQuoteNotes(e.target.value)}
              placeholder="Optional internal note for saved quote"
              rows={3}
            />
          </label>
        </div>
      </section>

      <div className="record-content">
        {items.map((item, itemIndex) => (
          <QuoteItemEditor
            key={item.id}
            index={itemIndex}
            item={item}
            baseItems={baseItems}
            decorations={decorations}
            closures={closures}
            camoOptions={camoOptions}
            feeTypes={lookups.feeTypes}
            accessoryById={accessoryById}
            onChange={(updater) => updateItem(item.id, updater)}
            onRemove={() => removeItem(item.id)}
            canRemove={items.length > 1}
          />
        ))}
      </div>

      <div className="card" style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-secondary" onClick={addItem}>
          Add Quote Item
        </button>
        <button type="button" className="btn btn-primary" onClick={generateQuote} disabled={calculating || saving || publishing}>
          {calculating ? "Generating…" : "Generate Quote"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onSaveDraft} disabled={saving || calculating || publishing}>
          {saving ? "Saving…" : "Save Draft"}
        </button>
        <button type="button" className="btn btn-primary" onClick={publishQuote} disabled={saving || calculating || publishing}>
          {publishing ? "Publishing…" : "Publish"}
        </button>
        {savedQuoteId ? (
          <Link href={`/quick-turn-quote-calculator/saved/${encodeURIComponent(savedQuoteId)}`} className="btn btn-secondary">
            View {savedQuoteNumber || "Saved Quote"}
          </Link>
        ) : null}
      </div>

      {result ? <QuickTurnCalculatedResults result={result} quoteName={quoteName || null} /> : null}
    </main>
  );
}

function QuoteItemEditor({
  index,
  item,
  baseItems,
  decorations,
  closures,
  camoOptions,
  feeTypes,
  accessoryById,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  item: UiQuoteItem;
  baseItems: QuickTurnLookupPayload["baseItems"];
  decorations: QuickTurnAccessory[];
  closures: QuickTurnAccessory[];
  camoOptions: QuickTurnLookupPayload["camoOptions"];
  feeTypes: QuickTurnLookupPayload["feeTypes"];
  accessoryById: Map<string, QuickTurnAccessory>;
  onChange: (updater: (item: UiQuoteItem) => UiQuoteItem) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const selectedBaseItem = baseItems.find((x) => x.id === item.baseItemId);
  const selectedClosure = accessoryById.get(item.closureAccessoryId);
  const selectedCamo = camoOptions.find((x) => x.id === item.camoOptionId);
  const allAccessories = useMemo(() => Array.from(accessoryById.values()), [accessoryById]);
  const custom = isCustomCap(item);
  const itemPricePreview = buildQuickTurnItemPricePreview({
    baseItem: custom ? null : selectedBaseItem ?? null,
    customCapCost: custom ? item.customCapCost : null,
    accessoryRows: item.accessories,
    closureAccessory: selectedClosure ?? null,
    closureInputValues: item.closureInputValues,
    camoOption: selectedCamo ?? null,
    accessoryById,
    allAccessories,
  });

  return (
    <section className="record-section-card">
      <div className="record-section-header">
        <div>
          <h2 className="record-section-title">Quote Item {index + 1}</h2>
          <div className="text-muted">
            Select a base item, Custom Cap, decorations/accessories, optional closure, optional camo, and item-level fees.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span className="record-pill record-pill-neutral" title="Base item + decorations/accessories + closure. Camo is not included here.">
            Item Total: {selectedBaseItem || custom ? fmtMoneyPrecise(itemPricePreview.decoratedUnitCost) : "—"}
          </span>
          <span className="record-pill record-pill-neutral">
            Add-ons: {fmtMoneyPrecise(itemPricePreview.accessoryUnitTotal)}
          </span>
          {custom ? <span className="record-pill record-pill-info">Custom Cap</span> : null}
          {itemPricePreview.camoUnitPrice > 0 ? (
            <span className="record-pill record-pill-info">
              Camo After Surcharge: {fmtMoneyPrecise(itemPricePreview.camoUnitPrice)}
            </span>
          ) : null}
          {canRemove ? (
            <button type="button" className="btn btn-danger btn-sm" onClick={onRemove}>
              Remove Item
            </button>
          ) : null}
        </div>
      </div>

      <div className="record-meta-grid">
        <label className="record-meta-item-full">
          <span>Base Item</span>
          <select
            className="select"
            value={item.baseItemId}
            onChange={(e) => {
              const nextBaseItemId = e.target.value;
              const nextBaseItem = baseItems.find((x) => x.id === nextBaseItemId);
              onChange((prev) => ({
                ...prev,
                baseItemId: nextBaseItemId,
                baseItemDescription:
                  nextBaseItemId && nextBaseItemId !== QUICK_TURN_CUSTOM_CAP_BASE_ITEM_ID
                    ? nextBaseItem?.fabricDescription || ""
                    : prev.baseItemDescription,
              }));
            }}
          >
            <option value="">Select base item…</option>
            <option value={QUICK_TURN_CUSTOM_CAP_BASE_ITEM_ID}>Custom Cap — quote-specific manual cost</option>
            {baseItems.map((baseItem) => (
              <option key={baseItem.id} value={baseItem.id}>
                {baseItem.itemCode} — {baseItem.fabricDescription || "No description"} ({fmtMoneyPrecise(baseItem.basePrice)})
              </option>
            ))}
          </select>
          {custom ? (
            <div className="text-muted" style={{ marginTop: 4 }}>
              Custom Cap is saved only on this quote. It does not create or update setup base item records.
            </div>
          ) : selectedBaseItem ? (
            <div className="text-muted" style={{ marginTop: 4 }}>
              Base price: {fmtMoneyPrecise(selectedBaseItem.basePrice)} · Current item total before surcharge: {fmtMoneyPrecise(itemPricePreview.decoratedUnitCost)}
              {itemPricePreview.missingInputs.length ? ` · Pending inputs: ${itemPricePreview.missingInputs.join(", ")}` : ""}
            </div>
          ) : null}
        </label>

        {custom ? (
          <>
            <label>
              <span>Custom Cap Cost / Piece</span>
              <input
                className="input"
                type="number"
                min="0"
                step="0.000001"
                value={item.customCapCost}
                onChange={(e) => onChange((prev) => ({ ...prev, customCapCost: e.target.value }))}
                placeholder="0.000000"
              />
            </label>
            <label className="record-meta-item-full">
              <span>Custom Cap Description</span>
              <textarea
                className="textarea"
                value={item.customCapDescription}
                rows={3}
                onChange={(e) => onChange((prev) => ({ ...prev, customCapDescription: e.target.value }))}
                placeholder="Describe the cap being quoted so CSR, Art, and the customer understand the option."
              />
            </label>
          </>
        ) : selectedBaseItem ? (
          <label className="record-meta-item-full">
            <span>Item Description</span>
            <textarea
              className="textarea"
              value={item.baseItemDescription}
              rows={3}
              onChange={(e) => onChange((prev) => ({ ...prev, baseItemDescription: e.target.value }))}
              placeholder="Description to save with this quote item."
            />
            <div className="text-muted" style={{ marginTop: 4 }}>
              Defaults from the selected base item and can be edited for this quote without changing setup data.
            </div>
          </label>
        ) : null}

        <label className="record-meta-item-full">
          <span>Item Notes</span>
          <textarea
            className="textarea"
            value={item.notes}
            rows={2}
            onChange={(e) => onChange((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Optional note for this item"
          />
        </label>
      </div>

      <div className="record-section-card" style={{ marginTop: 12 }}>
        <div className="record-section-header">
          <h3 className="record-section-title">Decorations / Accessories</h3>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onChange((prev) => ({ ...prev, accessories: [...prev.accessories, createAccessoryRow()] }))}
          >
            Add Decoration
          </button>
        </div>

        {item.accessories.length === 0 ? (
          <div className="muted-box">No decorations selected.</div>
        ) : (
          item.accessories.map((row) => {
            const accessory = accessoryById.get(row.accessoryId);
            const pricePreview = calculateAccessoryPricePreview(accessory, row.inputValues, allAccessories);

            return (
              <div key={row.id} className="card" style={{ marginBottom: 10 }}>
                <div className="record-meta-grid">
                  <label className="record-meta-item-full">
                    <span>Decoration</span>
                    <select
                      className="select"
                      value={row.accessoryId}
                      onChange={(e) => {
                        const nextAccessoryId = e.target.value;
                        onChange((prev) => ({
                          ...prev,
                          accessories: prev.accessories.map((a) =>
                            a.id === row.id ? { ...a, accessoryId: nextAccessoryId, inputValues: {} } : a
                          ),
                        }));
                      }}
                    >
                      <option value="">Select decoration…</option>
                      {decorations.map((decoration) => (
                        <option key={decoration.id} value={decoration.id}>
                          {decoration.name} ({fmtMoneyPrecise(decoration.unitPrice)})
                        </option>
                      ))}
                    </select>
                    {accessory?.notes ? <div className="text-muted" style={{ marginTop: 4 }}>{accessory.notes}</div> : null}
                  </label>
                </div>

                {accessoryInputFields(accessory, row.inputValues, (nextValues) => {
                  onChange((prev) => ({
                    ...prev,
                    accessories: prev.accessories.map((a) =>
                      a.id === row.id ? { ...a, inputValues: nextValues } : a
                    ),
                  }));
                })}

                {accessory ? <PricePreviewBox title="Calculated decoration price" preview={pricePreview} /> : null}

                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() =>
                      onChange((prev) => ({
                        ...prev,
                        accessories: prev.accessories.filter((a) => a.id !== row.id),
                      }))
                    }
                  >
                    Remove Decoration
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="record-section-card" style={{ marginTop: 12 }}>
        <div className="record-section-header">
          <h3 className="record-section-title">Optional Closure / Camo</h3>
        </div>

        <div className="record-meta-grid">
          <label>
            <span>Closure</span>
            <select
              className="select"
              value={item.closureAccessoryId}
              onChange={(e) => onChange((prev) => ({ ...prev, closureAccessoryId: e.target.value, closureInputValues: {} }))}
            >
              <option value="">No closure</option>
              {closures.map((closure) => (
                <option key={closure.id} value={closure.id}>
                  {closure.name} ({fmtMoneyPrecise(closure.unitPrice)})
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Camo</span>
            <select
              className="select"
              value={item.camoOptionId}
              onChange={(e) => onChange((prev) => ({ ...prev, camoOptionId: e.target.value }))}
            >
              <option value="">No camo</option>
              {camoOptions.map((camo) => (
                <option key={camo.id} value={camo.id}>
                  {camo.series} — {camo.supplier} ({fmtMoneyPrecise(camo.unitPrice)})
                </option>
              ))}
            </select>
            <div className="text-muted" style={{ marginTop: 4 }}>
              Camo is added after surcharge and does not change the decorated item subtotal.
            </div>
          </label>
        </div>

        {accessoryInputFields(selectedClosure, item.closureInputValues, (nextValues) => {
          onChange((prev) => ({ ...prev, closureInputValues: nextValues }));
        })}

        {selectedClosure ? (
          <PricePreviewBox
            title="Calculated closure price"
            preview={calculateAccessoryPricePreview(selectedClosure, item.closureInputValues, allAccessories)}
          />
        ) : null}
      </div>

      <div className="record-section-card" style={{ marginTop: 12 }}>
        <div className="record-section-header">
          <h3 className="record-section-title">One-Time Fees</h3>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onChange((prev) => ({ ...prev, fees: [...prev.fees, createFeeRow()] }))}
          >
            Add Fee
          </button>
        </div>

        {item.fees.length === 0 ? (
          <div className="muted-box">No one-time fees selected.</div>
        ) : (
          <div className="table-card">
            <div className="table-scroll">
              <table className="table-clean">
                <thead>
                  <tr>
                    <th>Fee Type</th>
                    <th>Amount</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {item.fees.map((fee) => (
                    <tr key={fee.id}>
                      <td>
                        <select
                          className="select"
                          value={fee.feeTypeId}
                          onChange={(e) =>
                            onChange((prev) => ({
                              ...prev,
                              fees: prev.fees.map((f) =>
                                f.id === fee.id ? { ...f, feeTypeId: e.target.value } : f
                              ),
                            }))
                          }
                        >
                          <option value="">Select fee type…</option>
                          {feeTypes.map((feeType) => (
                            <option key={feeType.id} value={String(feeType.id)}>
                              {feeType.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={fee.amount}
                          onChange={(e) =>
                            onChange((prev) => ({
                              ...prev,
                              fees: prev.fees.map((f) =>
                                f.id === fee.id ? { ...f, amount: e.target.value } : f
                              ),
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          value={fee.notes}
                          onChange={(e) =>
                            onChange((prev) => ({
                              ...prev,
                              fees: prev.fees.map((f) =>
                                f.id === fee.id ? { ...f, notes: e.target.value } : f
                              ),
                            }))
                          }
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() =>
                            onChange((prev) => ({
                              ...prev,
                              fees: prev.fees.filter((f) => f.id !== fee.id),
                            }))
                          }
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
      </div>
    </section>
  );
}
