"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import styles from "../itemPricingUi.module.css";

type PriceBook = { id: string; code: string; name: string };
type Item = { id: string; itemCode: string; itemDescription: string | null; ruleSetName?: string | null };
type PriceLevel = { id: string; code: string; name: string; active: boolean };
type Preview = {
  baseCalculation: {
    item: { itemCode: string | null; itemDescription: string | null };
    ruleSet: { name: string; code: string };
    blankEqpPrice: number | null;
  };
  priceLevel: { code: string; name: string };
  methods: Array<{
    methodCode: string;
    methodName: string;
    prices: Array<{
      quantityBreakCode: string;
      quantityBreakLabel: string;
      basePrice: number;
      finalPrice: number;
      appliedRules: Array<{ label: string; before: number; after: number }>;
    }>;
  }>;
  warnings: string[];
  errors: string[];
};

function rowsFromApi<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return Number(value).toFixed(2);
}

export default function ItemPricingPriceLevelPreviewPage() {
  const [priceBooks, setPriceBooks] = useState<PriceBook[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [priceLevels, setPriceLevels] = useState<PriceLevel[]>([]);
  const [priceBookId, setPriceBookId] = useState("");
  const [itemId, setItemId] = useState("");
  const [priceLevelId, setPriceLevelId] = useState("");
  const [blankOverride, setBlankOverride] = useState("");
  const [requestedMethodCode, setRequestedMethodCode] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [pbRes, itemRes, plRes] = await Promise.all([
        fetch("/api/admin/item-pricing/price-books?limit=250", { cache: "no-store" }),
        fetch("/api/admin/item-pricing/items?limit=750", { cache: "no-store" }),
        fetch("/api/admin/item-pricing/price-levels?limit=250&includeInactive=true", { cache: "no-store" }),
      ]);
      const [pbJson, itemJson, plJson] = await Promise.all([pbRes.json(), itemRes.json(), plRes.json()]);
      if (!pbRes.ok) throw new Error(pbJson?.error || "Failed to load price books.");
      if (!itemRes.ok) throw new Error(itemJson?.error || "Failed to load items.");
      if (!plRes.ok) throw new Error(plJson?.error || "Failed to load price levels.");
      const pbs = rowsFromApi<PriceBook>(pbJson);
      const loadedItems = rowsFromApi<Item>(itemJson);
      const pls = rowsFromApi<PriceLevel>(plJson);
      setPriceBooks(pbs);
      setItems(loadedItems);
      setPriceLevels(pls);
      if (!priceBookId && pbs[0]) setPriceBookId(pbs[0].id);
      if (!itemId && loadedItems[0]) setItemId(loadedItems[0].id);
      const internal = pls.find((pl) => pl.code === "INTERNAL_NET") || pls[0];
      if (!priceLevelId && internal) setPriceLevelId(internal.id);
    } catch (err: any) {
      setError(err?.message || "Failed to load price-level preview data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function calculate(e: FormEvent) {
    e.preventDefault();
    setCalculating(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch("/api/admin/item-pricing/price-level-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceBookId,
          itemId,
          priceLevelId,
          blankEqpPriceOverride: blankOverride || null,
          requestedMethodCode: requestedMethodCode || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to calculate price-level preview.");
      setPreview(json);
    } catch (err: any) {
      setError(err?.message || "Failed to calculate price-level preview.");
    } finally {
      setCalculating(false);
    }
  }

  return (
    <main className={`page-shell-wide ${styles.pageStack}`}>
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Item Pricing Price-Level Preview</h1>
          <p className="page-subtitle">
            Preview base pricing plus price-level adjustment rules before building the customer service pricing configurator.
          </p>
        </div>
        <div className="page-header-actions">
          <Link href="/admin/item-pricing/price-levels" className="btn btn-secondary btn-sm">Price Levels</Link>
          <Link href="/admin/item-pricing" className="btn btn-secondary btn-sm">Back to Setup</Link>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <section className="section-card">
        <form onSubmit={calculate} className={styles.tableSection}>
          <div className={styles.formGrid}>
            <label>Price Book<select className="select" value={priceBookId} onChange={(e) => setPriceBookId(e.target.value)} required>{priceBooks.map((pb) => <option key={pb.id} value={pb.id}>{pb.code} — {pb.name}</option>)}</select></label>
            <label>Item<select className="select" value={itemId} onChange={(e) => setItemId(e.target.value)} required>{items.map((item) => <option key={item.id} value={item.id}>{item.itemCode} — {item.itemDescription || item.ruleSetName || "No description"}</option>)}</select></label>
            <label>Price Level<select className="select" value={priceLevelId} onChange={(e) => setPriceLevelId(e.target.value)} required>{priceLevels.map((pl) => <option key={pl.id} value={pl.id}>{pl.code} — {pl.name}{pl.active ? "" : " (Inactive)"}</option>)}</select></label>
            <label>Blank EQP Override<input className="input" value={blankOverride} onChange={(e) => setBlankOverride(e.target.value)} placeholder="Optional test value" /></label>
            <label>Method<select className="select" value={requestedMethodCode} onChange={(e) => setRequestedMethodCode(e.target.value)}><option value="">All allowed</option><option value="BLANK">Blank</option><option value="FLAT_EMB">Flat Embroidery</option><option value="THREE_D_EMB">3D Embroidery</option><option value="KNIT_IN">Knit In</option></select></label>
          </div>
          <div className={styles.formActions}><button className="btn btn-primary" disabled={loading || calculating}>{calculating ? "Calculating..." : "Calculate Price Level"}</button></div>
        </form>
      </section>

      {preview ? (
        <>
          <section className="card">
            <div className="record-meta-grid">
              <div className="record-meta-item"><span className="record-meta-label">Item</span><span className="record-meta-value">{preview.baseCalculation.item.itemCode}</span></div>
              <div className="record-meta-item"><span className="record-meta-label">Rule Set</span><span className="record-meta-value">{preview.baseCalculation.ruleSet.name}</span></div>
              <div className="record-meta-item"><span className="record-meta-label">Blank EQP</span><span className="record-meta-value">{money(preview.baseCalculation.blankEqpPrice)}</span></div>
              <div className="record-meta-item"><span className="record-meta-label">Price Level</span><span className="record-meta-value">{preview.priceLevel.code} — {preview.priceLevel.name}</span></div>
            </div>
          </section>

          {preview.errors?.length ? <div className="alert alert-danger">{preview.errors.join(" ")}</div> : null}
          {preview.warnings?.length ? <div className="alert alert-warning">{preview.warnings.join(" ")}</div> : null}

          <div className={styles.priceGrid}>
            {preview.methods.map((method) => (
              <section className={`section-card ${styles.priceMethodCard}`} key={method.methodCode}>
                <div className={styles.priceMethodHeader}><h2 className={styles.priceMethodTitle}>{method.methodName}</h2></div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>Qty Break</th><th>Base Price</th><th>Final Price</th><th>Applied Rules</th></tr></thead>
                    <tbody>
                      {method.prices.map((price) => (
                        <tr key={price.quantityBreakCode}>
                          <td>{price.quantityBreakLabel}</td>
                          <td>{money(price.basePrice)}</td>
                          <td><strong>{money(price.finalPrice)}</strong></td>
                          <td>{price.appliedRules.length ? price.appliedRules.map((r) => r.label).join("; ") : "No price-level adjustment"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}
