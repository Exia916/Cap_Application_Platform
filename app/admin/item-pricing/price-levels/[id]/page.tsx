"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import styles from "../../itemPricingUi.module.css";

type Lookup = { id: number; code: string; name?: string; label?: string };
type PriceLevelRule = {
  id: string;
  ruleSetId: number | null;
  ruleSetName: string | null;
  decorationMethodId: number | null;
  decorationMethodName: string | null;
  quantityBreakId: number | null;
  quantityBreakLabel: string | null;
  ruleType: string;
  multiplier: number | null;
  addAmount: number | null;
  percentValue: number | null;
  overridePrice: number | null;
  minimumPrice: number | null;
  maximumPrice: number | null;
  roundingMode: string;
  calculationOrder: number;
  active: boolean;
  notes: string | null;
};
type PriceLevel = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  levelType: string;
  active: boolean;
  sortOrder: number;
  rules: PriceLevelRule[];
};

function rowsFromApi<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function ruleValue(rule: PriceLevelRule) {
  if (rule.ruleType === "MULTIPLIER" || rule.ruleType === "CODED_MULTIPLIER") return rule.multiplier == null ? "—" : `× ${Number(rule.multiplier).toFixed(4)}`;
  if (rule.ruleType === "ADD_AMOUNT") return rule.addAmount == null ? "—" : `+ $${Number(rule.addAmount).toFixed(2)}`;
  if (rule.ruleType === "DISCOUNT_PERCENT") return rule.percentValue == null ? "—" : `${Number(rule.percentValue).toFixed(2)}% off`;
  if (rule.ruleType === "OVERRIDE_PRICE") return rule.overridePrice == null ? "—" : `$${Number(rule.overridePrice).toFixed(2)}`;
  return "—";
}

export default function ItemPricingPriceLevelRecordPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const [id, setId] = useState<string | null>(null);
  const [level, setLevel] = useState<PriceLevel | null>(null);
  const [ruleSets, setRuleSets] = useState<Lookup[]>([]);
  const [methods, setMethods] = useState<Lookup[]>([]);
  const [breaks, setBreaks] = useState<Lookup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState({
    ruleSetId: "",
    decorationMethodId: "",
    quantityBreakId: "",
    ruleType: "MULTIPLIER",
    multiplier: "1.0000",
    addAmount: "",
    percentValue: "",
    overridePrice: "",
    roundingMode: "HALF_UP_2",
    calculationOrder: "100",
    notes: "",
  });

  useEffect(() => {
    Promise.resolve(params).then((p) => setId(p.id));
  }, [params]);

  async function load(currentId = id) {
    if (!currentId) return;
    setLoading(true);
    setError(null);
    try {
      const [levelRes, rsRes, methodRes, breakRes] = await Promise.all([
        fetch(`/api/admin/item-pricing/price-levels/${currentId}`, { cache: "no-store" }),
        fetch("/api/admin/item-pricing/rule-sets?limit=250", { cache: "no-store" }),
        fetch("/api/admin/item-pricing/lookups/decoration-methods", { cache: "no-store" }),
        fetch("/api/admin/item-pricing/lookups/quantity-breaks", { cache: "no-store" }),
      ]);
      const [levelJson, rsJson, methodJson, breakJson] = await Promise.all([
        levelRes.json(),
        rsRes.json(),
        methodRes.json(),
        breakRes.json(),
      ]);
      if (!levelRes.ok) throw new Error(levelJson?.error || "Failed to load price level.");
      if (!rsRes.ok) throw new Error(rsJson?.error || "Failed to load rule sets.");
      if (!methodRes.ok) throw new Error(methodJson?.error || "Failed to load decoration methods.");
      if (!breakRes.ok) throw new Error(breakJson?.error || "Failed to load quantity breaks.");

      setLevel(levelJson);
      setRuleSets(rowsFromApi<Lookup>(rsJson));
      setMethods(rowsFromApi<Lookup>(methodJson));
      setBreaks(rowsFromApi<Lookup>(breakJson));
    } catch (err: any) {
      setError(err?.message || "Failed to load price level.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveLevel(e: FormEvent) {
    e.preventDefault();
    if (!id || !level) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/item-pricing/price-levels/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(level),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save price level.");
      setMessage("Price level saved.");
      await load(id);
    } catch (err: any) {
      setError(err?.message || "Failed to save price level.");
    } finally {
      setSaving(false);
    }
  }

  async function createRule(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/item-pricing/price-levels/${id}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...ruleForm,
          ruleSetId: ruleForm.ruleSetId || null,
          decorationMethodId: ruleForm.decorationMethodId || null,
          quantityBreakId: ruleForm.quantityBreakId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create rule.");
      setMessage("Price level rule created.");
      setRuleForm({ ...ruleForm, notes: "" });
      await load(id);
    } catch (err: any) {
      setError(err?.message || "Failed to create rule.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !level) {
    return <main className={`page-shell-wide ${styles.pageStack}`}><div className="card">Loading price level...</div></main>;
  }

  if (!level) {
    return <main className={`page-shell-wide ${styles.pageStack}`}><div className="alert alert-danger">{error || "Price level not found."}</div></main>;
  }

  return (
    <main className={`page-shell-wide ${styles.pageStack}`}>
      <div className="page-header">
        <div className="page-header-title-wrap">
          <p className="page-subtitle">Admin / Item Pricing / Price Levels</p>
          <h1 className="page-title">{level.code}</h1>
          <p className="page-subtitle">{level.name}</p>
        </div>
        <div className="page-header-actions">
          <Link href="/admin/item-pricing/price-level-preview" className="btn btn-secondary btn-sm">Preview</Link>
          <Link href="/admin/item-pricing/price-levels" className="btn btn-secondary btn-sm">Back</Link>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}

      <section className="section-card">
        <div className="record-section-header"><h2 className="record-section-title">Price Level Details</h2></div>
        <form onSubmit={saveLevel} className={styles.tableSection}>
          <div className={styles.formGrid}>
            <label>Code<input className="input" value={level.code} disabled /></label>
            <label>Name<input className="input" value={level.name} onChange={(e) => setLevel({ ...level, name: e.target.value })} /></label>
            <label>Type<select className="select" value={level.levelType} onChange={(e) => setLevel({ ...level, levelType: e.target.value })}><option value="INTERNAL">Internal</option><option value="CUSTOMER_GROUP">Customer Group</option><option value="RETAIL">Retail</option><option value="SPECIAL">Special</option></select></label>
            <label>Sort Order<input className="input" type="number" value={level.sortOrder} onChange={(e) => setLevel({ ...level, sortOrder: Number(e.target.value) || 0 })} /></label>
            <label className={styles.checkboxRow}><input type="checkbox" checked={level.active} onChange={(e) => setLevel({ ...level, active: e.target.checked })} /> Active</label>
          </div>
          <label>Description<textarea className="textarea" value={level.description || ""} onChange={(e) => setLevel({ ...level, description: e.target.value })} /></label>
          <div className={styles.formActions}><button className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Price Level"}</button></div>
        </form>
      </section>

      <section className="section-card">
        <div className="record-section-header">
          <div>
            <h2 className="record-section-title">Adjustment Rules</h2>
            <p className="page-subtitle">Blank scope fields mean “all.” More specific rows can be added by rule set, decoration method, and quantity break.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Scope</th><th>Type</th><th>Value</th><th>Min/Max</th><th>Rounding</th><th>Order</th><th>Status</th><th>Notes</th></tr></thead>
            <tbody>
              {level.rules.length === 0 ? <tr><td colSpan={8}>No adjustment rules yet. With no rules, the final price equals the base calculated price.</td></tr> : level.rules.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.ruleSetName || "All rule sets"} / {rule.decorationMethodName || "All methods"} / {rule.quantityBreakLabel || "All breaks"}</td>
                  <td>{rule.ruleType}</td>
                  <td>{ruleValue(rule)}</td>
                  <td>{rule.minimumPrice == null ? "—" : `$${Number(rule.minimumPrice).toFixed(2)}`} / {rule.maximumPrice == null ? "—" : `$${Number(rule.maximumPrice).toFixed(2)}`}</td>
                  <td>{rule.roundingMode}</td>
                  <td>{rule.calculationOrder}</td>
                  <td>{rule.active ? "Active" : "Inactive"}</td>
                  <td>{rule.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-card">
        <div className="record-section-header"><h2 className="record-section-title">Add Adjustment Rule</h2></div>
        <form onSubmit={createRule} className={styles.tableSection}>
          <div className={styles.formGrid}>
            <label>Rule Set<select className="select" value={ruleForm.ruleSetId} onChange={(e) => setRuleForm({ ...ruleForm, ruleSetId: e.target.value })}><option value="">All rule sets</option>{ruleSets.map((r) => <option key={r.id} value={r.id}>{r.name || r.code}</option>)}</select></label>
            <label>Method<select className="select" value={ruleForm.decorationMethodId} onChange={(e) => setRuleForm({ ...ruleForm, decorationMethodId: e.target.value })}><option value="">All methods</option>{methods.map((m) => <option key={m.id} value={m.id}>{m.name || m.code}</option>)}</select></label>
            <label>Qty Break<select className="select" value={ruleForm.quantityBreakId} onChange={(e) => setRuleForm({ ...ruleForm, quantityBreakId: e.target.value })}><option value="">All breaks</option>{breaks.map((b) => <option key={b.id} value={b.id}>{b.label || b.code}</option>)}</select></label>
            <label>Rule Type<select className="select" value={ruleForm.ruleType} onChange={(e) => setRuleForm({ ...ruleForm, ruleType: e.target.value })}><option value="MULTIPLIER">Multiplier</option><option value="ADD_AMOUNT">Add Amount</option><option value="DISCOUNT_PERCENT">Discount Percent</option><option value="OVERRIDE_PRICE">Override Price</option><option value="CODED_MULTIPLIER">Coded Multiplier</option></select></label>
            <label>Multiplier<input className="input" value={ruleForm.multiplier} onChange={(e) => setRuleForm({ ...ruleForm, multiplier: e.target.value })} placeholder="1.25" /></label>
            <label>Add Amount<input className="input" value={ruleForm.addAmount} onChange={(e) => setRuleForm({ ...ruleForm, addAmount: e.target.value })} placeholder="0.50" /></label>
            <label>Percent<input className="input" value={ruleForm.percentValue} onChange={(e) => setRuleForm({ ...ruleForm, percentValue: e.target.value })} placeholder="10" /></label>
            <label>Override Price<input className="input" value={ruleForm.overridePrice} onChange={(e) => setRuleForm({ ...ruleForm, overridePrice: e.target.value })} placeholder="8.99" /></label>
            <label>Rounding<select className="select" value={ruleForm.roundingMode} onChange={(e) => setRuleForm({ ...ruleForm, roundingMode: e.target.value })}><option value="HALF_UP_2">Round to 2 Decimals</option><option value="NONE">No Rounding</option><option value="CEILING_2">Round Up</option><option value="FLOOR_2">Round Down</option></select></label>
            <label>Order<input className="input" type="number" value={ruleForm.calculationOrder} onChange={(e) => setRuleForm({ ...ruleForm, calculationOrder: e.target.value })} /></label>
          </div>
          <label>Notes<textarea className="textarea" value={ruleForm.notes} onChange={(e) => setRuleForm({ ...ruleForm, notes: e.target.value })} /></label>
          <div className={styles.formActions}><button className="btn btn-primary" disabled={saving}>{saving ? "Adding..." : "Add Rule"}</button></div>
        </form>
      </section>
    </main>
  );
}
