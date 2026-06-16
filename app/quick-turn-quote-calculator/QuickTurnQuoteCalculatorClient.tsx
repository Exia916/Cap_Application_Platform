// app/quick-turn-quote-calculator/QuickTurnQuoteCalculatorClient.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import type {
  QuickTurnAccessory,
  QuickTurnCalculatePayload,
  QuickTurnCalculationResult,
  QuickTurnLookupPayload,
  QuickTurnQuoteInputAccessory,
  QuickTurnQuoteInputFee,
  QuickTurnQuoteInputItem,
} from "./types";
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

function buildPayload(programId: string, factoryId: string, items: UiQuoteItem[]): QuickTurnCalculatePayload {
  return {
    programId: programId || null,
    factoryId: factoryId || null,
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
        baseItemId: item.baseItemId,
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
  const [lookups, setLookups] = useState<QuickTurnLookupPayload>(EMPTY_LOOKUPS);
  const [programId, setProgramId] = useState("");
  const [factoryId, setFactoryId] = useState("");
  const [items, setItems] = useState<UiQuoteItem[]>([createEmptyItem()]);
  const [quoteName, setQuoteName] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [result, setResult] = useState<QuickTurnCalculationResult | null>(null);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [savedQuoteNumber, setSavedQuoteNumber] = useState<string | null>(null);
  const [canMaintainSetup, setCanMaintainSetup] = useState(false);

  const selectedProgramId = programId || String(lookups.programs[0]?.id || "");
  const selectedFactoryId = factoryId || String(lookups.factories[0]?.id || "");

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
      } catch (err: any) {
        setError(err?.message || "Failed to load Quick Turn setup data.");
      } finally {
        setLoading(false);
      }
    }

    loadLookups();
  }, []);

  function updateItem(itemId: string, updater: (item: UiQuoteItem) => UiQuoteItem) {
    setItems((prev) => prev.map((item) => (item.id === itemId ? updater(item) : item)));
    setResult(null);
    setSavedQuoteId(null);
    setSavedQuoteNumber(null);
    setSaveMessage(null);
  }

  function removeItem(itemId: string) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item.id !== itemId)));
    setResult(null);
  }

  async function generateQuote() {
    try {
      setCalculating(true);
      setError(null);
      setSaveMessage(null);
      setSavedQuoteId(null);
      setSavedQuoteNumber(null);

      const payload = buildPayload(selectedProgramId, selectedFactoryId, items);
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

  async function saveQuote() {
    if (!quoteName.trim()) {
      setError("Quote name is required before saving.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSaveMessage(null);

      const payload = {
        ...buildPayload(selectedProgramId, selectedFactoryId, items),
        quoteName: quoteName.trim(),
        notes: quoteNotes.trim() || null,
      };

      const res = await fetch("/api/quick-turn-quote-calculator/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save Quick Turn quote.");
      }

      setResult(data.calculation as QuickTurnCalculationResult);
      setSavedQuoteId(data.id || null);
      setSavedQuoteNumber(data.quoteNumber || null);
      setSaveMessage(`Saved ${data.quoteNumber || "Quick Turn quote"}.`);
    } catch (err: any) {
      setError(err?.message || "Failed to save Quick Turn quote.");
    } finally {
      setSaving(false);
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
            disabled={calculating || saving}
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
            <span>Quote Name</span>
            <input
              className="input"
              value={quoteName}
              onChange={(e) => setQuoteName(e.target.value)}
              placeholder="Required only when saving"
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
        <button type="button" className="btn btn-secondary" onClick={() => setItems((prev) => [...prev, createEmptyItem()])}>
          Add Quote Item
        </button>
        <button type="button" className="btn btn-primary" onClick={generateQuote} disabled={calculating || saving}>
          {calculating ? "Generating…" : "Generate Quote"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={saveQuote} disabled={saving || calculating}>
          {saving ? "Saving…" : "Save Quote"}
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
  const itemPricePreview = buildQuickTurnItemPricePreview({
    baseItem: selectedBaseItem ?? null,
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
            Select a base item, decorations/accessories, optional closure, optional camo, and item-level fees.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span className="record-pill record-pill-neutral" title="Base item + decorations/accessories + closure. Camo is not included here.">
            Item Total: {selectedBaseItem ? fmtMoneyPrecise(itemPricePreview.decoratedUnitCost) : "—"}
          </span>
          <span className="record-pill record-pill-neutral">
            Add-ons: {fmtMoneyPrecise(itemPricePreview.accessoryUnitTotal)}
          </span>
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
            onChange={(e) => onChange((prev) => ({ ...prev, baseItemId: e.target.value }))}
          >
            <option value="">Select base item…</option>
            {baseItems.map((baseItem) => (
              <option key={baseItem.id} value={baseItem.id}>
                {baseItem.itemCode} — {baseItem.fabricDescription || "No description"} ({fmtMoneyPrecise(baseItem.basePrice)})
              </option>
            ))}
          </select>
          {selectedBaseItem ? (
            <div className="text-muted" style={{ marginTop: 4 }}>
              Base price: {fmtMoneyPrecise(selectedBaseItem.basePrice)} · Current item total before surcharge: {fmtMoneyPrecise(itemPricePreview.decoratedUnitCost)}
              {itemPricePreview.missingInputs.length ? ` · Pending inputs: ${itemPricePreview.missingInputs.join(", ")}` : ""}
            </div>
          ) : null}
        </label>

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
