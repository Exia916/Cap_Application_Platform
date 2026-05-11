"use client";

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import type { WilcomDesign, WilcomDesignSearchResponse } from "./types";
import DesignLookupResults from "./DesignLookupResults";
import DesignLookupModal from "./DesignLookupModal";

function userFriendlyFetchError(status: number, fallback: string) {
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have access to Design Lookup.";
  return fallback || "Failed to search Wilcom designs.";
}

export default function DesignLookupClient() {
  const [design, setDesign] = useState("");
  const [rows, setRows] = useState<WilcomDesign[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<WilcomDesign | null>(null);

  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSearch = useMemo(() => design.trim().length > 0, [design]);

  async function runSearch(e?: FormEvent) {
    e?.preventDefault();

    if (!canSearch) {
      setError("Enter a design, description, customer, or keyword to search.");
      setRows([]);
      setHasSearched(false);
      return;
    }

    const qs = new URLSearchParams();

    if (design.trim()) {
      qs.set("name", design.trim());
    }

    qs.set("limit", "50");

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const res = await fetch(`/api/wilcom/designs/search?${qs.toString()}`, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });

      const data = (await res.json().catch(() => ({}))) as Partial<
        WilcomDesignSearchResponse & { error: string }
      >;

      if (!res.ok) {
        throw new Error(userFriendlyFetchError(res.status, data?.error || ""));
      }

      setRows(Array.isArray(data.results) ? data.results : []);
    } catch (err: any) {
      setRows([]);
      setError(err?.message || "Failed to search Wilcom designs.");
    } finally {
      setLoading(false);
    }
  }

  function clearSearch() {
    setDesign("");
    setRows([]);
    setError(null);
    setHasSearched(false);
    setSelectedDesign(null);
  }

  return (
    <div className="page-shell-wide">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Design Lookup</h1>
          <p className="page-subtitle">
            Search Wilcom designs by design, description, customer, or keyword.
            Double-click a result or use View to open read-only details.
          </p>
        </div>
      </div>

      <div className="section-stack">
        <form className="card" onSubmit={runSearch}>
          <div style={searchGrid}>
            <div>
              <label className="field-label">Design Search</label>
              <input
                className="input"
                value={design}
                onChange={(e) => setDesign(e.target.value)}
                placeholder="Example: F245668, tiger, marathon"
                autoComplete="off"
              />
            </div>

            <div style={buttonGroup}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !canSearch}
              >
                {loading ? "Searching..." : "Search"}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={clearSearch}
                disabled={loading && !rows.length}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="field-help" style={{ marginTop: 10 }}>
            Search uses the Wilcom design/name lookup and supports broader design-style
            keyword matching from the Wilcom endpoint.
          </div>
        </form>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <DesignLookupResults
            rows={rows}
            loading={loading}
            error={error}
            hasSearched={hasSearched}
            onView={setSelectedDesign}
          />
        </div>
      </div>

      <DesignLookupModal
        open={!!selectedDesign}
        design={selectedDesign}
        onClose={() => setSelectedDesign(null)}
      />
    </div>
  );
}

const searchGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 1fr) auto",
  gap: 12,
  alignItems: "end",
};

const buttonGroup: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};