"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";

import styles from "../itemPricingUi.module.css";
type RuleSet = { id: number; code: string; name: string };
type ItemRow = {
  id: string;
  itemCode: string;
  itemDescription: string | null;
  productFamily: string | null;
  ruleSetId: number;
  ruleSetCode: string;
  ruleSetName: string;
  active: boolean;
  allows3dEmb: boolean;
  blankEqpPrice?: number | null;
  updatedAt: string;
};

function fmtMoney(v?: number | null) {
  return v == null ? "" : Number(v).toFixed(2);
}

export default function ItemPricingItemsPage() {
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [ruleSetId, setRuleSetId] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [sortBy, setSortBy] = useState("itemCode");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pageSize, setPageSize] = useState(25);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ itemCode: "", itemDescription: "", productFamily: "", ruleSetId: "", active: true });

  useEffect(() => {
    async function loadRuleSets() {
      const res = await fetch("/api/admin/item-pricing/rule-sets?includeInactive=true", { cache: "no-store", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setRuleSets(Array.isArray(data?.rows) ? data.rows : []);
    }
    loadRuleSets();
  }, []);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("limit", String(pageSize));
    sp.set("offset", String(pageIndex * pageSize));
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);
    if (q.trim()) sp.set("q", q.trim());
    if (ruleSetId) sp.set("ruleSetId", ruleSetId);
    if (includeInactive) sp.set("includeInactive", "true");
    return sp.toString();
  }, [includeInactive, pageIndex, pageSize, q, ruleSetId, sortBy, sortDir]);

  async function loadRows() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/item-pricing/items?${queryString}`, { cache: "no-store", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load items.");
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotal(Number(data?.total || 0));
    } catch (err: any) {
      setError(err?.message || "Failed to load items.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, [queryString]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const res = await fetch("/api/admin/item-pricing/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to create item.");
      setForm({ itemCode: "", itemDescription: "", productFamily: "", ruleSetId: "", active: true });
      await loadRows();
    } catch (err: any) {
      setError(err?.message || "Failed to create item.");
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<ItemRow>[] = [
    { key: "itemCode", header: "Item Code", sortable: true, render: (r) => r.itemCode, getSearchText: (r) => r.itemCode },
    { key: "itemDescription", header: "Description", sortable: true, render: (r) => r.itemDescription || "", getSearchText: (r) => r.itemDescription || "" },
    { key: "productFamily", header: "Family", sortable: true, render: (r) => r.productFamily || "", getSearchText: (r) => r.productFamily || "" },
    { key: "ruleSet", header: "Rule Set", sortable: true, render: (r) => r.ruleSetName, getSearchText: (r) => r.ruleSetName },
    { key: "active", header: "Active", sortable: true, render: (r) => <span className={r.active ? "badge badge-success" : "badge badge-neutral"}>{r.active ? "Yes" : "No"}</span>, getSearchText: (r) => r.active ? "Yes" : "No" },
    { key: "allows3dEmb", header: "Allows 3D", render: (r) => r.allows3dEmb ? "Yes" : "No", getSearchText: (r) => r.allows3dEmb ? "Yes" : "No" },
    { key: "blankEqpPrice", header: "Blank EQP", sortable: true, render: (r) => fmtMoney(r.blankEqpPrice), getSearchText: (r) => fmtMoney(r.blankEqpPrice) },
    { key: "actions", header: "Actions", render: (r) => <Link className="btn btn-secondary btn-sm" href={`/admin/item-pricing/calculate?itemId=${encodeURIComponent(r.id)}`}>Preview</Link> },
  ];

  return (
    <main className={`page-shell-wide ${styles.pageStack}`}>
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Item Pricing Items</h1>
          <p className="page-subtitle">Maintain item/style setup and rule set assignment.</p>
        </div>
        <Link href="/admin/item-pricing" className="btn btn-secondary">Back to Setup</Link>
      </div>

      <section className="section-card">
        <div className="record-section-header"><h2 className="record-section-title">New Item</h2></div>
        <form onSubmit={submit} className={styles.formGrid}>
          <label>Item Code<input className="input" value={form.itemCode} onChange={(e) => setForm((p) => ({ ...p, itemCode: e.target.value }))} /></label>
          <label>Description<input className="input" value={form.itemDescription} onChange={(e) => setForm((p) => ({ ...p, itemDescription: e.target.value }))} /></label>
          <label>Family<input className="input" value={form.productFamily} onChange={(e) => setForm((p) => ({ ...p, productFamily: e.target.value }))} /></label>
          <label>Rule Set<select className="select" value={form.ruleSetId} onChange={(e) => setForm((p) => ({ ...p, ruleSetId: e.target.value }))}><option value="">Select…</option>{ruleSets.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <label>Active<select className="select" value={String(form.active)} onChange={(e) => setForm((p) => ({ ...p, active: e.target.value === "true" }))}><option value="true">Yes</option><option value="false">No</option></select></label>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Create"}</button>
        </form>
      </section>

      <section className="section-card">
        <div className={styles.filterGrid}>
          <input className="input" value={q} onChange={(e) => { setQ(e.target.value); setPageIndex(0); }} placeholder="Search items…" />
          <select className="select" value={ruleSetId} onChange={(e) => { setRuleSetId(e.target.value); setPageIndex(0); }}>
            <option value="">All rule sets</option>
            {ruleSets.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <label className={styles.checkboxRow}><input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} /> Include inactive</label>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          sortBy={sortBy}
          sortDir={sortDir}
          onToggleSort={(key) => { if (sortBy !== key) { setSortBy(key); setSortDir("asc"); } else setSortDir((d) => d === "asc" ? "desc" : "asc"); }}
          // provide filters/onFilterChange to satisfy DataTable Props
          filters={{}}
          onFilterChange={() => {}}
          totalCount={total}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={setPageSize}
          rowKey={(r) => r.id}
          emptyText="No item pricing items found."
          enableCsvExport
          csvFilename="item_pricing_items.csv"
          rowToCsv={(r) => ({ "Item Code": r.itemCode, Description: r.itemDescription, Family: r.productFamily, "Rule Set": r.ruleSetName, Active: r.active ? "Yes" : "No", "Allows 3D": r.allows3dEmb ? "Yes" : "No", "Blank EQP": fmtMoney(r.blankEqpPrice) })}
        />
      </section>
    </main>
  );
}
