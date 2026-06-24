"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";

import styles from "../itemPricingUi.module.css";
type PriceBook = { id: string; code: string; name: string; isDefault: boolean };
type Item = { id: string; itemCode: string; itemDescription: string | null; ruleSetName: string };
type BasePriceRow = {
  id: string;
  priceBookId: string;
  priceBookCode: string;
  itemId: string;
  itemCode: string;
  itemDescription: string | null;
  ruleSetName: string;
  blankEqpPrice: number;
  flatEqpPrice: number | null;
  threeDEqpPrice: number | null;
  updatedAt: string;
  updatedBy: string | null;
};

function fmtMoney(v?: number | null) {
  return v == null ? "" : Number(v).toFixed(2);
}

function fmtDate(v?: string | null) {
  return v ? String(v).slice(0, 10) : "";
}

export default function ItemPricingBasePricesPage() {
  const [priceBooks, setPriceBooks] = useState<PriceBook[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [priceBookId, setPriceBookId] = useState("");
  const [rows, setRows] = useState<BasePriceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("itemCode");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pageSize, setPageSize] = useState(25);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ itemId: "", blankEqpPrice: "", notes: "" });

  useEffect(() => {
    async function loadSetup() {
      const [pbRes, itemRes] = await Promise.all([
        fetch("/api/admin/item-pricing/price-books?limit=100", { cache: "no-store", credentials: "include" }),
        fetch("/api/admin/item-pricing/items?limit=500&includeInactive=true", { cache: "no-store", credentials: "include" }),
      ]);
      const pbData = await pbRes.json().catch(() => ({}));
      const itemData = await itemRes.json().catch(() => ({}));
      const pbs = Array.isArray(pbData?.rows) ? pbData.rows : [];
      setPriceBooks(pbs);
      setItems(Array.isArray(itemData?.rows) ? itemData.rows : []);
      const defaultPb = pbs.find((x: PriceBook) => x.isDefault) || pbs[0];
      if (defaultPb) setPriceBookId(defaultPb.id);
    }
    loadSetup();
  }, []);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("limit", String(pageSize));
    sp.set("offset", String(pageIndex * pageSize));
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);
    if (priceBookId) sp.set("priceBookId", priceBookId);
    if (q.trim()) sp.set("q", q.trim());
    return sp.toString();
  }, [pageIndex, pageSize, priceBookId, q, sortBy, sortDir]);

  async function loadRows() {
    if (!priceBookId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/item-pricing/base-prices?${queryString}`, { cache: "no-store", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load base prices.");
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotal(Number(data?.total || 0));
    } catch (err: any) {
      setError(err?.message || "Failed to load base prices.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, [queryString, priceBookId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const res = await fetch("/api/admin/item-pricing/base-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, priceBookId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save base price.");
      setForm({ itemId: "", blankEqpPrice: "", notes: "" });
      await loadRows();
    } catch (err: any) {
      setError(err?.message || "Failed to save base price.");
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<BasePriceRow>[] = [
    { key: "itemCode", header: "Item Code", sortable: true, render: (r) => r.itemCode, getSearchText: (r) => r.itemCode },
    { key: "itemDescription", header: "Description", sortable: true, render: (r) => r.itemDescription || "", getSearchText: (r) => r.itemDescription || "" },
    { key: "ruleSet", header: "Rule Set", sortable: true, render: (r) => r.ruleSetName, getSearchText: (r) => r.ruleSetName },
    { key: "blankEqpPrice", header: "Blank EQP", sortable: true, render: (r) => fmtMoney(r.blankEqpPrice), getSearchText: (r) => fmtMoney(r.blankEqpPrice) },
    { key: "flatEqpPrice", header: "Flat EQP", render: (r) => fmtMoney(r.flatEqpPrice), getSearchText: (r) => fmtMoney(r.flatEqpPrice) },
    { key: "threeDEqpPrice", header: "3D EQP", render: (r) => fmtMoney(r.threeDEqpPrice), getSearchText: (r) => fmtMoney(r.threeDEqpPrice) },
    { key: "updatedAt", header: "Updated", sortable: true, render: (r) => fmtDate(r.updatedAt), getSearchText: (r) => fmtDate(r.updatedAt) },
    { key: "actions", header: "Actions", render: (r) => <Link className="btn btn-secondary btn-sm" href={`/admin/item-pricing/calculate?priceBookId=${encodeURIComponent(r.priceBookId)}&itemId=${encodeURIComponent(r.itemId)}`}>Preview</Link> },
  ];

  return (
    <main className={`page-shell-wide ${styles.pageStack}`}>
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Item Pricing Base Prices</h1>
          <p className="page-subtitle">Maintain the source Blank EQP 2500+ values.</p>
        </div>
        <Link href="/admin/item-pricing" className="btn btn-secondary">Back to Setup</Link>
      </div>

      <section className="section-card">
        <div className="record-section-header"><h2 className="record-section-title">Save Blank EQP</h2></div>
        <form onSubmit={submit} className={styles.formGrid}>
          <label>Price Book<select className="select" value={priceBookId} onChange={(e) => { setPriceBookId(e.target.value); setPageIndex(0); }}><option value="">Select…</option>{priceBooks.map((pb) => <option key={pb.id} value={pb.id}>{pb.code} — {pb.name}</option>)}</select></label>
          <label>Item<select className="select" value={form.itemId} onChange={(e) => setForm((p) => ({ ...p, itemId: e.target.value }))}><option value="">Select…</option>{items.map((i) => <option key={i.id} value={i.id}>{i.itemCode} — {i.itemDescription || i.ruleSetName}</option>)}</select></label>
          <label>Blank EQP<input className="input" type="number" min="0" step="0.01" value={form.blankEqpPrice} onChange={(e) => setForm((p) => ({ ...p, blankEqpPrice: e.target.value }))} /></label>
          <label>Notes<input className="input" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></label>
          <button type="submit" className="btn btn-primary" disabled={saving || !priceBookId}>{saving ? "Saving…" : "Save"}</button>
        </form>
      </section>

      <section className="section-card">
        <div className={styles.filterGrid}>
          <input className="input" value={q} onChange={(e) => { setQ(e.target.value); setPageIndex(0); }} placeholder="Search base prices…" />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          sortBy={sortBy}
          sortDir={sortDir}
          onToggleSort={(key) => { if (sortBy !== key) { setSortBy(key); setSortDir("asc"); } else setSortDir((d) => d === "asc" ? "desc" : "asc"); }}
          totalCount={total}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={setPageSize}
          rowKey={(r) => r.id}
          emptyText="No base prices found."
          enableCsvExport
          csvFilename="item_pricing_base_prices.csv"
          rowToCsv={(r) => ({ "Price Book": r.priceBookCode, "Item Code": r.itemCode, Description: r.itemDescription, "Rule Set": r.ruleSetName, "Blank EQP": fmtMoney(r.blankEqpPrice), "Flat EQP": fmtMoney(r.flatEqpPrice), "3D EQP": fmtMoney(r.threeDEqpPrice), Updated: fmtDate(r.updatedAt) })}
        />
      </section>
    </main>
  );
}
