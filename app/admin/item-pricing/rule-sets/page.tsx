"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import styles from "../itemPricingUi.module.css";
type RuleSet = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  allowsBlank: boolean;
  allowsFlatEmb: boolean;
  allows3dEmb: boolean;
  allowsKnitIn: boolean;
  active: boolean;
};

type RuleRow = {
  id: string;
  decorationMethodCode: string;
  decorationMethodName: string;
  quantityBreakCode: string;
  quantityBreakLabel: string;
  baseReference: string;
  priorQuantityBreakLabel: string | null;
  adderAmount: number;
  calculationOrder: number;
  active: boolean;
  notes: string | null;
};

type RuleSetDetail = RuleSet & { ruleRows: RuleRow[] };

function fmtAdder(n: number) {
  return Number(n || 0).toFixed(2);
}

function formulaLabel(row: RuleRow) {
  if (row.baseReference === "PRIOR_BREAK") {
    return `${row.priorQuantityBreakLabel || "Prior Break"} + ${fmtAdder(row.adderAmount)}`;
  }
  return `${row.baseReference.replaceAll("_", " ")} + ${fmtAdder(row.adderAmount)}`;
}

export default function ItemPricingRuleSetsPage() {
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<RuleSetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRuleSets() {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/item-pricing/rule-sets?includeInactive=true", { cache: "no-store", credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to load rule sets.");
        const rows = Array.isArray(data?.rows) ? data.rows : [];
        setRuleSets(rows);
        if (rows[0]) setSelectedId(String(rows[0].id));
      } catch (err: any) {
        setError(err?.message || "Failed to load rule sets.");
      } finally {
        setLoading(false);
      }
    }
    loadRuleSets();
  }, []);

  useEffect(() => {
    async function loadDetail() {
      if (!selectedId) return;
      try {
        setError(null);
        const res = await fetch(`/api/admin/item-pricing/rule-sets/${encodeURIComponent(selectedId)}`, { cache: "no-store", credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to load rule set.");
        setDetail(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load rule set.");
        setDetail(null);
      }
    }
    loadDetail();
  }, [selectedId]);

  const rowsByMethod = useMemo(() => {
    const map = new Map<string, RuleRow[]>();
    for (const row of detail?.ruleRows || []) {
      if (!row.active) continue;
      const current = map.get(row.decorationMethodName) || [];
      current.push(row);
      map.set(row.decorationMethodName, current);
    }
    for (const [key, rows] of map) {
      map.set(key, rows.sort((a, b) => a.calculationOrder - b.calculationOrder));
    }
    return Array.from(map.entries());
  }, [detail]);

  return (
    <main className={`page-shell-wide ${styles.pageStack}`}>
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Item Pricing Rule Sets</h1>
          <p className="page-subtitle">Review the seeded base quantity break rules used by the calculation engine.</p>
        </div>
        <Link href="/admin/item-pricing" className="btn btn-secondary">Back to Setup</Link>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <section className="section-card">
        <label>Rule Set<select className="select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} disabled={loading}><option value="">Select…</option>{ruleSets.map((rs) => <option key={rs.id} value={rs.id}>{rs.name}</option>)}</select></label>
      </section>

      {detail ? (
        <>
          <section className="card">
            <div className="record-meta-grid">
              <div className="record-meta-item"><span className="record-meta-label">Code</span><span className="record-meta-value">{detail.code}</span></div>
              <div className="record-meta-item"><span className="record-meta-label">Active</span><span className="record-meta-value">{detail.active ? "Yes" : "No"}</span></div>
              <div className="record-meta-item"><span className="record-meta-label">Allowed Methods</span><span className="record-meta-value">{[detail.allowsBlank && "Blank", detail.allowsFlatEmb && "Flat", detail.allows3dEmb && "3D", detail.allowsKnitIn && "Knit In"].filter(Boolean).join(", ")}</span></div>
              <div className="record-meta-item"><span className="record-meta-label">Description</span><span className="record-meta-value">{detail.description || ""}</span></div>
            </div>
          </section>

          {rowsByMethod.map(([methodName, rows]) => (
            <section className="section-card" key={methodName}>
              <div className="record-section-header"><h2 className="record-section-title">{methodName}</h2></div>
              <div className={styles.tableScroll}>
                <table className="data-table">
                  <thead><tr><th>Qty Break</th><th>Base Reference</th><th>Adder</th><th>Formula</th><th>Notes</th></tr></thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.quantityBreakLabel}</td>
                        <td>{row.baseReference}</td>
                        <td>{fmtAdder(row.adderAmount)}</td>
                        <td>{formulaLabel(row)}</td>
                        <td>{row.notes || ""}</td>
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
