"use client";

import type { ReportSummaryCardConfig } from "@/lib/reports/reportTemplates";

type Props = {
  rows: Record<string, any>[];
  cards?: ReportSummaryCardConfig[];
  columns?: Array<{ key: string; label: string; type: string }>;
};

function asNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatValue(value: number, format?: "number" | "percent" | "hours") {
  if (format === "percent") {
    const pct = Math.abs(value) <= 1 ? value * 100 : value;
    return `${pct.toFixed(2)}%`;
  }

  if (format === "hours") {
    return `${value.toFixed(1)} hrs`;
  }

  if (!Number.isFinite(value)) return "0";

  if (Math.abs(value) < 1000 && !Number.isInteger(value)) {
    return value.toFixed(2);
  }

  return Math.round(value).toLocaleString();
}

function calcCardValue(rows: Record<string, any>[], card: ReportSummaryCardConfig) {
  if (card.function === "countRows") {
    return rows.length;
  }

  if (!card.sourceColumn) {
    return 0;
  }

  if (card.function === "countDistinct") {
    const set = new Set(
      rows
        .map((row) => row[card.sourceColumn!])
        .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
        .map((value) => String(value))
    );

    return set.size;
  }

  const values = rows
    .map((row) => asNumber(row[card.sourceColumn!]))
    .filter((value) => Number.isFinite(value));

  if (!values.length) return 0;

  if (card.function === "sum") {
    return values.reduce((sum, value) => sum + value, 0);
  }

  if (card.function === "avg") {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  if (card.function === "min") {
    return Math.min(...values);
  }

  if (card.function === "max") {
    return Math.max(...values);
  }

  return 0;
}

function buildFallbackCards(
  columns: Array<{ key: string; label: string; type: string }> | undefined
): ReportSummaryCardConfig[] {
  const numeric = (columns ?? []).filter((column) => column.type === "number").slice(0, 3);

  const cards: ReportSummaryCardConfig[] = [
    {
      key: "rows",
      label: "Rows",
      function: "countRows",
      format: "number",
    },
  ];

  for (const column of numeric) {
    cards.push({
      key: column.key,
      label: column.label,
      sourceColumn: column.key,
      function: "sum",
      format: "number",
    });
  }

  return cards;
}

export default function ReportSummaryCards({ rows, cards, columns }: Props) {
  const activeCards = cards && cards.length ? cards : buildFallbackCards(columns);

  if (!rows.length || !activeCards.length) {
    return null;
  }

  return (
    <div className="report-summary-grid">
      <style>{`
        .report-summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }

        .report-summary-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          box-shadow: var(--shadow-sm);
          padding: 14px 16px;
          min-height: 86px;
          display: grid;
          align-content: center;
          gap: 6px;
        }

        .report-summary-label {
          color: var(--text-soft);
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .report-summary-value {
          color: var(--text);
          font-size: 28px;
          line-height: 1.05;
          font-weight: 900;
        }
      `}</style>

      {activeCards.map((card) => {
        const value = calcCardValue(rows, card);

        return (
          <div key={card.key} className="report-summary-card">
            <div className="report-summary-label">{card.label}</div>
            <div className="report-summary-value">{formatValue(value, card.format)}</div>
          </div>
        );
      })}
    </div>
  );
}