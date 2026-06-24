"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "../itemPricingUi.module.css";

type PriceBook = { id: string; code: string; name: string };
type RuleSet = { id: number; code: string; name: string };
type Item = { id: string; itemCode: string; itemDescription: string | null; ruleSetName?: string | null };
type ExportRun = {
  id: string;
  priceBookCode: string;
  priceBookName: string;
  exportType: string;
  fileName: string;
  fileFormat: string;
  rowCount: number;
  status: string;
  contentSizeBytes: number | null;
  errorMessage: string | null;
  createdAt: string;
  createdBy: string | null;
};

const exportTypeOptions = [
  { value: "BASE_PRICING_CSV", label: "Internal Base Pricing CSV", help: "Spreadsheet-style validation output." },
  { value: "BASE_PRICING_PDF", label: "Internal Base Pricing PDF", help: "Readable internal PDF with item pricing grids." },
  { value: "ITEM_DETAIL_PDF", label: "Item Detail PDF", help: "Single-item verification PDF with formula trace." },
  { value: "PRICE_BOOK_SUMMARY_PDF", label: "Price Book Summary PDF", help: "Management summary by rule set." },
];

function rowsFromApi<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function formatBytes(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadUrl(runId: string) {
  return `/api/admin/item-pricing/exports/download?id=${encodeURIComponent(runId)}`;
}

function exportTypeLabel(value: string) {
  return exportTypeOptions.find((option) => option.value === value)?.label || value;
}

export default function ItemPricingExportsPage() {
  const [priceBooks, setPriceBooks] = useState<PriceBook[]>([]);
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [exports, setExports] = useState<ExportRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRunId, setLastRunId] = useState<string | null>(null);

  const [priceBookId, setPriceBookId] = useState("");
  const [exportType, setExportType] = useState("BASE_PRICING_CSV");
  const [ruleSetId, setRuleSetId] = useState("");
  const [itemId, setItemId] = useState("");
  const [q, setQ] = useState("");
  const [itemCodeStartsWith, setItemCodeStartsWith] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [onlyWithBasePrice, setOnlyWithBasePrice] = useState(true);
  const [maxRows, setMaxRows] = useState("5000");

  const selectedExportType = useMemo(() => exportTypeOptions.find((option) => option.value === exportType), [exportType]);
  const isPdf = exportType.endsWith("PDF");
  const isItemDetail = exportType === "ITEM_DETAIL_PDF";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [pbRes, rsRes, itemsRes, expRes] = await Promise.all([
        fetch("/api/admin/item-pricing/price-books?limit=250", { cache: "no-store" }),
        fetch("/api/admin/item-pricing/rule-sets?limit=250", { cache: "no-store" }),
        fetch("/api/admin/item-pricing/items?limit=500", { cache: "no-store" }),
        fetch("/api/admin/item-pricing/exports?limit=75", { cache: "no-store" }),
      ]);

      const [pbJson, rsJson, itemsJson, expJson] = await Promise.all([pbRes.json(), rsRes.json(), itemsRes.json(), expRes.json()]);
      if (!pbRes.ok) throw new Error(pbJson?.error || "Failed to load price books.");
      if (!rsRes.ok) throw new Error(rsJson?.error || "Failed to load rule sets.");
      if (!itemsRes.ok) throw new Error(itemsJson?.error || "Failed to load items.");
      if (!expRes.ok) throw new Error(expJson?.error || "Failed to load exports.");

      const pbs = rowsFromApi<PriceBook>(pbJson);
      const loadedItems = rowsFromApi<Item>(itemsJson);
      setPriceBooks(pbs);
      setRuleSets(rowsFromApi<RuleSet>(rsJson));
      setItems(loadedItems);
      setExports(rowsFromApi<ExportRun>(expJson));
      if (!priceBookId && pbs[0]) setPriceBookId(pbs[0].id);
      if (!itemId && loadedItems[0]) setItemId(loadedItems[0].id);
    } catch (err: any) {
      setError(err?.message || "Failed to load item pricing exports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (exportType === "BASE_PRICING_PDF" && Number(maxRows) > 250) setMaxRows("250");
    if (exportType === "PRICE_BOOK_SUMMARY_PDF" && Number(maxRows) > 1000) setMaxRows("1000");
    if (exportType === "ITEM_DETAIL_PDF") setMaxRows("1");
  }, [exportType, maxRows]);

  async function generate(e: FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    setLastRunId(null);

    try {
      if (isItemDetail && !itemId) throw new Error("Choose an item before generating an Item Detail PDF.");

      const res = await fetch("/api/admin/item-pricing/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceBookId,
          exportType,
          filters: {
            q: q || null,
            ruleSetId: isItemDetail ? null : ruleSetId || null,
            itemId: isItemDetail ? itemId : null,
            itemCodeStartsWith: isItemDetail ? null : itemCodeStartsWith || null,
            includeInactive,
            onlyWithBasePrice,
            maxRows,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to generate export.");
      setLastRunId(json.id);
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to generate export.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className={`page-shell-wide ${styles.pageStack}`}>
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Item Pricing Exports</h1>
          <p className="page-subtitle">
            Generate internal CSV and PDF outputs from the current Blank EQP setup and structured quantity break rules.
          </p>
        </div>
        <div className="page-header-actions">
          <Link href="/admin/item-pricing" className="btn btn-secondary btn-sm">Back to Setup</Link>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {lastRunId ? (
        <div className="alert alert-success">
          Export generated. <a href={downloadUrl(lastRunId)}>Download the file</a>.
        </div>
      ) : null}

      <section className="section-card">
        <div className="record-section-header">
          <div>
            <h2 className="record-section-title">Generate Internal Export</h2>
            <p className="page-subtitle">
              Phase 6 adds internal PDF outputs only. Customer-facing PDFs, customer price levels, coded pricing, and quote saving are still deferred.
            </p>
          </div>
        </div>

        <form onSubmit={generate} className={styles.tableSection}>
          <div className={styles.formGrid}>
            <label>
              Price Book
              <select className="select" value={priceBookId} onChange={(e) => setPriceBookId(e.target.value)} required>
                {priceBooks.map((pb) => <option key={pb.id} value={pb.id}>{pb.code} — {pb.name}</option>)}
              </select>
            </label>
            <label>
              Export Type
              <select className="select" value={exportType} onChange={(e) => setExportType(e.target.value)} required>
                {exportTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            {isItemDetail ? (
              <label>
                Item
                <select className="select" value={itemId} onChange={(e) => setItemId(e.target.value)} required>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.itemCode} — {item.itemDescription || "No description"}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                Rule Set Filter
                <select className="select" value={ruleSetId} onChange={(e) => setRuleSetId(e.target.value)}>
                  <option value="">All rule sets</option>
                  {ruleSets.map((rs) => <option key={rs.id} value={rs.id}>{rs.name}</option>)}
                </select>
              </label>
            )}
            {!isItemDetail ? (
              <>
                <label>
                  Search
                  <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Item, description, rule set" />
                </label>
                <label>
                  Item Code Starts With
                  <input className="input" value={itemCodeStartsWith} onChange={(e) => setItemCodeStartsWith(e.target.value)} placeholder="Optional" />
                </label>
              </>
            ) : null}
            <label>
              Max Rows
              <input className="input" value={maxRows} onChange={(e) => setMaxRows(e.target.value)} disabled={isItemDetail} placeholder={isPdf ? "250" : "5000"} />
            </label>
          </div>

          <div className={styles.inlineSummary}>
            <span className="record-pill record-pill-info">{isPdf ? "PDF" : "CSV"}</span>
            <span className="page-subtitle">{selectedExportType?.help}</span>
          </div>

          <div className={styles.formActions}>
            <label className={styles.checkboxRow}>
              <input type="checkbox" checked={onlyWithBasePrice} onChange={(e) => setOnlyWithBasePrice(e.target.checked)} />
              Only items with Blank EQP
            </label>
            <label className={styles.checkboxRow}>
              <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
              Include inactive items
            </label>
          </div>

          <div className={styles.formActions}>
            <button className="btn btn-primary" type="submit" disabled={generating || loading}>{generating ? "Generating..." : `Generate ${isPdf ? "PDF" : "CSV"}`}</button>
            <button className="btn btn-secondary" type="button" onClick={load}>Refresh History</button>
          </div>
        </form>
      </section>

      <section className="section-card">
        <div className="record-section-header">
          <div>
            <h2 className="record-section-title">Recent Exports</h2>
            <p className="page-subtitle">Download previous internal item pricing exports.</p>
          </div>
        </div>

        <div className={styles.tableScroll}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Price Book</th>
                <th>Type</th>
                <th>File</th>
                <th>Rows</th>
                <th>Size</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {exports.map((run) => (
                <tr key={run.id}>
                  <td>{formatDate(run.createdAt)}</td>
                  <td>{run.priceBookCode}</td>
                  <td>{exportTypeLabel(run.exportType)}</td>
                  <td>{run.fileName}</td>
                  <td>{run.rowCount}</td>
                  <td>{formatBytes(run.contentSizeBytes)}</td>
                  <td><span className="record-pill record-pill-info">{run.status}</span></td>
                  <td>{run.errorMessage || "—"}</td>
                  <td><a className="btn btn-secondary btn-sm" href={downloadUrl(run.id)}>Download</a></td>
                </tr>
              ))}
              {!loading && exports.length === 0 ? (
                <tr>
                  <td colSpan={9}>No exports have been generated yet.</td>
                </tr>
              ) : null}
              {loading ? (
                <tr>
                  <td colSpan={9}>Loading...</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
