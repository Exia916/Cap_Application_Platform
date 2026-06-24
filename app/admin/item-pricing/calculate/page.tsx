"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import styles from "../itemPricingUi.module.css";
type PriceBook = { id: string; code: string; name: string; isDefault: boolean };
type Item = { id: string; itemCode: string; itemDescription: string | null; ruleSetName: string; blankEqpPrice?: number | null };
type CalcPrice = { quantityBreakCode: string; quantityBreakLabel: string; calculatedPrice: number; trace: { formulaLabel: string; baseReference: string; baseAmount: number; adderAmount: number; result: number } };
type CalcMethod = { methodCode: string; methodName: string; prices: CalcPrice[] };
type CalcResult = {
  item: { itemCode: string | null; itemDescription: string | null; active: boolean };
  ruleSet: { code: string; name: string; active: boolean };
  blankEqpPrice: number | null;
  flatEqpPrice: number | null;
  threeDEqpPrice: number | null;
  methods: CalcMethod[];
  warnings: string[];
  errors: string[];
};

function fmtMoney(v?: number | null) {
  return v == null ? "" : Number(v).toFixed(2);
}

export default function ItemPricingCalculatePage() {
  const [priceBooks, setPriceBooks] = useState<PriceBook[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [priceBookId, setPriceBookId] = useState("");
  const [itemId, setItemId] = useState("");
  const [blankOverride, setBlankOverride] = useState("");
  const [requestedMethodCode, setRequestedMethodCode] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSetup() {
      try {
        setLoadingSetup(true);
        const [pbRes, itemRes] = await Promise.all([
          fetch("/api/admin/item-pricing/price-books?limit=100", { cache: "no-store", credentials: "include" }),
          fetch("/api/admin/item-pricing/items?limit=1000&includeInactive=true", { cache: "no-store", credentials: "include" }),
        ]);
        const pbData = await pbRes.json().catch(() => ({}));
        const itemData = await itemRes.json().catch(() => ({}));
        const pbs = Array.isArray(pbData?.rows) ? pbData.rows : [];
        const itemRows = Array.isArray(itemData?.rows) ? itemData.rows : [];
        setPriceBooks(pbs);
        setItems(itemRows);
        const urlParams = new URLSearchParams(window.location.search);
        const urlPriceBookId = urlParams.get("priceBookId") || "";
        const urlItemId = urlParams.get("itemId") || "";
        if (urlPriceBookId) setPriceBookId(urlPriceBookId);
        else {
          const defaultPb = pbs.find((x: PriceBook) => x.isDefault) || pbs[0];
          if (defaultPb) setPriceBookId(defaultPb.id);
        }
        if (urlItemId) setItemId(urlItemId);
      } catch (err: any) {
        setError(err?.message || "Failed to load setup data.");
      } finally {
        setLoadingSetup(false);
      }
    }
    loadSetup();
  }, []);

  const selectedItem = useMemo(() => items.find((i) => i.id === itemId) || null, [itemId, items]);

  async function calculate(e?: FormEvent) {
    e?.preventDefault();
    if (!itemId) {
      setError("Select an item before calculating.");
      return;
    }

    try {
      setCalculating(true);
      setError(null);
      setResult(null);
      const res = await fetch("/api/admin/item-pricing/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          priceBookId,
          itemId,
          blankEqpPriceOverride: blankOverride,
          requestedMethodCode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to calculate preview.");
      setResult(data);
    } catch (err: any) {
      setError(err?.message || "Failed to calculate preview.");
    } finally {
      setCalculating(false);
    }
  }

  return (
    <main className={`page-shell-wide ${styles.pageStack}`}>
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Item Pricing Calculation Preview</h1>
          <p className="page-subtitle">Validate base Blank / Flat / 3D / Knit In pricing before customer price-level logic is added.</p>
        </div>
        <Link href="/admin/item-pricing" className="btn btn-secondary">Back to Setup</Link>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <section className="section-card">
        <form onSubmit={calculate} className={styles.formGrid}>
          <label>Price Book<select className="select" value={priceBookId} disabled={loadingSetup} onChange={(e) => setPriceBookId(e.target.value)}><option value="">Default</option>{priceBooks.map((pb) => <option key={pb.id} value={pb.id}>{pb.code}</option>)}</select></label>
          <label>Item<select className="select" value={itemId} disabled={loadingSetup} onChange={(e) => setItemId(e.target.value)}><option value="">Select…</option>{items.map((i) => <option key={i.id} value={i.id}>{i.itemCode} — {i.itemDescription || i.ruleSetName}</option>)}</select></label>
          <label>Stored Rule Set<input className="input" value={selectedItem?.ruleSetName || ""} readOnly /></label>
          <label>Blank EQP Override<input className="input" type="number" min="0" step="0.01" value={blankOverride} onChange={(e) => setBlankOverride(e.target.value)} placeholder="Optional test value" /></label>
          <label>Method<select className="select" value={requestedMethodCode} onChange={(e) => setRequestedMethodCode(e.target.value)}><option value="">All allowed</option><option value="BLANK">Blank</option><option value="FLAT_EMB">Flat Embroidery</option><option value="THREE_D_EMB">3D Embroidery</option><option value="KNIT_IN">Knit In</option></select></label>
          <button type="submit" className="btn btn-primary" disabled={calculating || loadingSetup}>{calculating ? "Calculating…" : "Calculate"}</button>
        </form>
      </section>

      {result ? (
        <>
          <section className="card">
            <div className="record-meta-grid">
              <div className="record-meta-item"><span className="record-meta-label">Item</span><span className="record-meta-value">{result.item.itemCode}</span></div>
              <div className="record-meta-item"><span className="record-meta-label">Rule Set</span><span className="record-meta-value">{result.ruleSet.name}</span></div>
              <div className="record-meta-item"><span className="record-meta-label">Blank EQP</span><span className="record-meta-value">{fmtMoney(result.blankEqpPrice)}</span></div>
              <div className="record-meta-item"><span className="record-meta-label">Flat / 3D EQP</span><span className="record-meta-value">{fmtMoney(result.flatEqpPrice)} / {fmtMoney(result.threeDEqpPrice)}</span></div>
            </div>
          </section>

          {result.errors.length ? <div className="alert alert-danger">{result.errors.join(" ")}</div> : null}
          {result.warnings.length ? <div className="alert alert-warning">{result.warnings.join(" ")}</div> : null}

          {result.methods.map((method) => (
            <section className="section-card" key={method.methodCode}>
              <div className="record-section-header"><h2 className="record-section-title">{method.methodName}</h2></div>
              <div className={styles.tableScroll}>
                <table className="data-table">
                  <thead><tr><th>Qty Break</th><th>Calculated Price</th><th>Formula</th><th>Base</th><th>Adder</th></tr></thead>
                  <tbody>
                    {method.prices.map((price) => (
                      <tr key={`${method.methodCode}-${price.quantityBreakCode}`}>
                        <td>{price.quantityBreakLabel}</td>
                        <td>{fmtMoney(price.calculatedPrice)}</td>
                        <td>{price.trace.formulaLabel}</td>
                        <td>{fmtMoney(price.trace.baseAmount)}</td>
                        <td>{fmtMoney(price.trace.adderAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      ) : null}
    </main>
  );
}
