"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import styles from "../itemPricingUi.module.css";

type PriceLevel = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  levelType: string;
  active: boolean;
  sortOrder: number;
  ruleCount?: number;
  activeRuleCount?: number;
  updatedAt: string;
};

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

export default function ItemPricingPriceLevelsPage() {
  const [rows, setRows] = useState<PriceLevel[]>([]);
  const [q, setQ] = useState("");
  const [includeInactive, setIncludeInactive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", levelType: "CUSTOMER_GROUP", sortOrder: "200", description: "" });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "250", includeInactive: String(includeInactive), q });
      const res = await fetch(`/api/admin/item-pricing/price-levels?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load price levels.");
      setRows(rowsFromApi<PriceLevel>(json));
    } catch (err: any) {
      setError(err?.message || "Failed to load price levels.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive]);

  async function createLevel(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/item-pricing/price-levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, active: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create price level.");
      setForm({ code: "", name: "", levelType: "CUSTOMER_GROUP", sortOrder: "200", description: "" });
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to create price level.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={`page-shell-wide ${styles.pageStack}`}>
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Item Pricing Price Levels</h1>
          <p className="page-subtitle">
            Set up internal/customer group price levels separately from base Blank/Flat/3D pricing rules.
          </p>
        </div>
        <div className="page-header-actions">
          <Link href="/admin/item-pricing/price-level-preview" className="btn btn-secondary btn-sm">Preview</Link>
          <Link href="/admin/item-pricing" className="btn btn-secondary btn-sm">Back to Setup</Link>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <section className="section-card">
        <div className={styles.filterGrid}>
          <input className="input" placeholder="Search price levels..." value={q} onChange={(e) => setQ(e.target.value)} />
          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
            Include inactive
          </label>
          <button type="button" className="btn btn-secondary" onClick={load}>Refresh</button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Rules</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}>Loading price levels...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7}>No price levels found.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.code}</strong></td>
                  <td>{row.name}<br /><small>{row.description || "—"}</small></td>
                  <td>{row.levelType}</td>
                  <td><span className={`record-pill ${row.active ? "record-pill-success" : "record-pill-neutral"}`}>{row.active ? "Active" : "Inactive"}</span></td>
                  <td>{row.activeRuleCount ?? 0} active / {row.ruleCount ?? 0} total</td>
                  <td>{formatDate(row.updatedAt)}</td>
                  <td><Link href={`/admin/item-pricing/price-levels/${row.id}`} className="btn btn-secondary btn-sm">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-card">
        <div className="record-section-header">
          <div>
            <h2 className="record-section-title">Create Price Level</h2>
            <p className="page-subtitle">Create setup shells here. Customer-specific assignments and customer-facing outputs are still deferred.</p>
          </div>
        </div>
        <form onSubmit={createLevel} className={styles.tableSection}>
          <div className={styles.formGrid}>
            <label>Code<input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CUSTOM_LEVEL" required /></label>
            <label>Name<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label>Type<select className="select" value={form.levelType} onChange={(e) => setForm({ ...form, levelType: e.target.value })}><option value="INTERNAL">Internal</option><option value="CUSTOMER_GROUP">Customer Group</option><option value="RETAIL">Retail</option><option value="SPECIAL">Special</option></select></label>
            <label>Sort Order<input className="input" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></label>
          </div>
          <label>Description<textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <div className={styles.formActions}><button className="btn btn-primary" disabled={saving}>{saving ? "Creating..." : "Create Price Level"}</button></div>
        </form>
      </section>
    </main>
  );
}
