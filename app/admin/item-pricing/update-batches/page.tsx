"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "../itemPricingUi.module.css";

type PriceBook = { id: string; code: string; name: string };
type RuleSet = { id: number; code: string; name: string };
type Batch = {
  id: string;
  batchNumber: string;
  priceBookCode: string;
  name: string;
  updateType: string;
  adjustmentType: string;
  adjustmentValue: number | null;
  status: string;
  rowCount: number;
  validRowCount: number;
  warningRowCount: number;
  errorRowCount: number;
  appliedRowCount: number;
  createdAt: string;
};

const defaultCsv = "item_code,new_blank_eqp\nX200,2.95";

function money(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function rowsFromApi<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

export default function ItemPricingUpdateBatchesPage() {
  const [priceBooks, setPriceBooks] = useState<PriceBook[]>([]);
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [priceBookId, setPriceBookId] = useState("");
  const [name, setName] = useState("Blank EQP Update Preview");
  const [updateType, setUpdateType] = useState("INDIVIDUAL_ITEM");
  const [adjustmentType, setAdjustmentType] = useState("ADD_AMOUNT");
  const [adjustmentValue, setAdjustmentValue] = useState("0.10");
  const [ruleSetId, setRuleSetId] = useState("");
  const [itemCodeStartsWith, setItemCodeStartsWith] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [singleItemCode, setSingleItemCode] = useState("");
  const [singleNewPrice, setSingleNewPrice] = useState("");
  const [csvText, setCsvText] = useState(defaultCsv);
  const [notes, setNotes] = useState("");

  const isDirectRows = updateType === "INDIVIDUAL_ITEM";
  const isCsv = updateType === "CSV_UPLOAD";
  const isFiltered = updateType === "FILTERED_ITEMS";
  const isWholeBook = updateType === "WHOLE_PRICE_BOOK";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [pbRes, rsRes, batchRes] = await Promise.all([
        fetch("/api/admin/item-pricing/price-books?limit=250", { cache: "no-store" }),
        fetch("/api/admin/item-pricing/rule-sets?limit=250", { cache: "no-store" }),
        fetch("/api/admin/item-pricing/update-batches?limit=50", { cache: "no-store" }),
      ]);

      const [pbJson, rsJson, batchJson] = await Promise.all([pbRes.json(), rsRes.json(), batchRes.json()]);
      if (!pbRes.ok) throw new Error(pbJson?.error || "Failed to load price books.");
      if (!rsRes.ok) throw new Error(rsJson?.error || "Failed to load rule sets.");
      if (!batchRes.ok) throw new Error(batchJson?.error || "Failed to load update batches.");

      const pbs = rowsFromApi<PriceBook>(pbJson);
      setPriceBooks(pbs);
      setRuleSets(rowsFromApi<RuleSet>(rsJson));
      setBatches(rowsFromApi<Batch>(batchJson));
      if (!priceBookId && pbs[0]) setPriceBookId(pbs[0].id);
    } catch (err: any) {
      setError(err?.message || "Failed to load update batch setup.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const helperText = useMemo(() => {
    if (isDirectRows) return "Create a one-row preview for a specific item and new Blank EQP.";
    if (isCsv) return "Paste CSV with item_code,new_blank_eqp to preview exact item updates.";
    if (isFiltered) return "Preview a batch update for items matching a rule set, prefix, and active filter.";
    return "Preview an update for all active items in the selected price book.";
  }, [isCsv, isDirectRows, isFiltered]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        priceBookId,
        name,
        updateType,
        adjustmentType,
        adjustmentValue,
        criteria: {
          ruleSetId: ruleSetId || null,
          includeInactive,
          itemCodeStartsWith: itemCodeStartsWith || null,
        },
        notes,
      };

      if (isDirectRows) {
        payload.rows = [{ itemCode: singleItemCode, newBlankEqp: singleNewPrice }];
      }

      if (isCsv) {
        payload.csvText = csvText;
      }

      const res = await fetch("/api/admin/item-pricing/update-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create update batch.");
      window.location.href = `/admin/item-pricing/update-batches/${json.id}`;
    } catch (err: any) {
      setError(err?.message || "Failed to create update batch.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={`page-shell-wide ${styles.pageStack}`}>
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Item Pricing Update Batches</h1>
          <p className="page-subtitle">Preview Blank EQP changes before applying them to a price book.</p>
        </div>
        <div className="page-header-actions">
          <Link href="/admin/item-pricing" className="btn btn-secondary btn-sm">Back to Setup</Link>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <section className="section-card">
        <div className="record-section-header">
          <div>
            <h2 className="record-section-title">Create Update Preview</h2>
            <p className="page-subtitle">{helperText}</p>
          </div>
        </div>

        <form onSubmit={submit} className={styles.tableSection}>
          <div className={styles.formGrid}>
            <label>
              Price Book
              <select className="select" value={priceBookId} onChange={(e) => setPriceBookId(e.target.value)} required>
                {priceBooks.map((pb) => <option key={pb.id} value={pb.id}>{pb.code} — {pb.name}</option>)}
              </select>
            </label>
            <label>
              Batch Name
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Update Type
              <select className="select" value={updateType} onChange={(e) => setUpdateType(e.target.value)}>
                <option value="INDIVIDUAL_ITEM">Individual Item</option>
                <option value="CSV_UPLOAD">CSV Upload</option>
                <option value="FILTERED_ITEMS">Filtered Items</option>
                <option value="WHOLE_PRICE_BOOK">Whole Price Book</option>
              </select>
            </label>
          </div>

          {(isFiltered || isWholeBook) ? (
            <div className={styles.formGrid}>
              <label>
                Adjustment Type
                <select className="select" value={adjustmentType} onChange={(e) => setAdjustmentType(e.target.value)}>
                  <option value="ADD_AMOUNT">Add Amount</option>
                  <option value="PERCENT_CHANGE">Percent Change</option>
                </select>
              </label>
              <label>
                Adjustment Value
                <input className="input" value={adjustmentValue} onChange={(e) => setAdjustmentValue(e.target.value)} placeholder="0.10 or 3" required />
              </label>
              {isFiltered ? (
                <>
                  <label>
                    Rule Set Filter
                    <select className="select" value={ruleSetId} onChange={(e) => setRuleSetId(e.target.value)}>
                      <option value="">All rule sets</option>
                      {ruleSets.map((rs) => <option key={rs.id} value={rs.id}>{rs.name}</option>)}
                    </select>
                  </label>
                  <label>
                    Item Code Starts With
                    <input className="input" value={itemCodeStartsWith} onChange={(e) => setItemCodeStartsWith(e.target.value)} placeholder="Optional" />
                  </label>
                  <label className={styles.checkboxRow}>
                    <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
                    Include inactive items
                  </label>
                </>
              ) : null}
            </div>
          ) : null}

          {isDirectRows ? (
            <div className={styles.formGrid}>
              <label>
                Item Code
                <input className="input" value={singleItemCode} onChange={(e) => setSingleItemCode(e.target.value)} placeholder="X200" required />
              </label>
              <label>
                New Blank EQP
                <input className="input" value={singleNewPrice} onChange={(e) => setSingleNewPrice(e.target.value)} placeholder="2.95" required />
              </label>
            </div>
          ) : null}

          {isCsv ? (
            <label>
              CSV Rows
              <textarea className={`textarea ${styles.csvTextarea}`} value={csvText} onChange={(e) => setCsvText(e.target.value)} />
            </label>
          ) : null}

          <label>
            Notes
            <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional review notes" />
          </label>

          <div className={styles.formActions}>
            <button className="btn btn-primary" type="submit" disabled={saving || loading}>{saving ? "Creating..." : "Create Preview Batch"}</button>
            <button className="btn btn-secondary" type="button" onClick={load}>Refresh</button>
          </div>
        </form>
      </section>

      <section className="section-card">
        <div className="record-section-header">
          <div>
            <h2 className="record-section-title">Recent Update Batches</h2>
            <p className="page-subtitle">Review rows and apply from the batch detail page.</p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Batch</th>
                <th>Name</th>
                <th>Price Book</th>
                <th>Type</th>
                <th>Status</th>
                <th>Rows</th>
                <th>Errors</th>
                <th>Applied</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td>{batch.batchNumber}</td>
                  <td>{batch.name}</td>
                  <td>{batch.priceBookCode}</td>
                  <td>{batch.updateType}</td>
                  <td><span className="badge">{batch.status}</span></td>
                  <td>{batch.rowCount}</td>
                  <td>{batch.errorRowCount}</td>
                  <td>{batch.appliedRowCount}</td>
                  <td><Link href={`/admin/item-pricing/update-batches/${batch.id}`} className="btn btn-secondary btn-sm">Open</Link></td>
                </tr>
              ))}
              {!loading && batches.length === 0 ? (
                <tr><td colSpan={9}>No update batches yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
