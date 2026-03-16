// components/home/SalesOrderLookupCard.tsx
"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function SalesOrderLookupCard() {
  const router = useRouter();
  const [salesOrder, setSalesOrder] = useState("");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = salesOrder.trim();
    if (!value) return;
    router.push(`/sales-orders?so=${encodeURIComponent(value)}`);
  }

  return (
    <div className="card card-lg">
      <div className="section-card-header">
        <div>
          <div className="master-card-title">Sales Order Lookup</div>
          <div className="master-card-description">
            Search SBT by Sales Order number and open a print-friendly decorated order view.
          </div>
        </div>

        <Link href="/sales-orders" className="btn btn-secondary">
          Open Full Lookup
        </Link>
      </div>

      <form onSubmit={onSubmit} className="so-lookup-form">
        <div className="so-lookup-input-wrap">
          <label className="field-label" htmlFor="homeSalesOrderLookup">
            Sales Order Number
          </label>
          <input
            id="homeSalesOrderLookup"
            className="input"
            value={salesOrder}
            onChange={(e) => setSalesOrder(e.target.value)}
            placeholder="Enter sales order"
            autoComplete="off"
          />
        </div>

        <div className="so-lookup-button-wrap">
          <button type="submit" className="btn btn-primary btn-lg">
            Search
          </button>
        </div>
      </form>
    </div>
  );
}