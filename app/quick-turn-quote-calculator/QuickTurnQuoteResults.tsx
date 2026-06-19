// app/quick-turn-quote-calculator/QuickTurnQuoteResults.tsx

import type { ReactNode } from "react";
import type {
  QuickTurnCalculatedItem,
  QuickTurnCalculationResult,
  SavedQuickTurnQuoteDetail,
} from "./types";
import { QUICK_TURN_FINAL_BREAK_LABEL } from "./types";
import { fmtDateOnly, fmtDateTime, fmtMoney, fmtMoneyPrecise } from "./format";

function itemLabel(item: QuickTurnCalculatedItem, index: number) {
  return `${index + 1}. ${item.isCustomCap ? "Custom Cap" : item.baseItem.itemCode}`;
}

function managementNoteNeeded(label: string, explicit?: boolean) {
  return explicit || label === QUICK_TURN_FINAL_BREAK_LABEL;
}

function RateMeta({ label, value }: { label: string; value: string }) {
  return (
    <span className="record-pill record-pill-neutral">
      {label}: {value}
    </span>
  );
}

function humanizeInputKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function humanizeInputValue(key: string, value: unknown): string {
  const raw = String(value ?? "").trim();
  if (key === "embroideryType" || key === "embroideryAccessoryCode") {
    if (raw === "FLAT_EMBROIDERY") return "Flat Embroidery";
    if (raw === "3_D_EMBROIDERY" || raw === "THREE_D_EMBROIDERY") return "3-D Embroidery";
  }
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace("3 D", "3-D");
}

function formatInputs(value: unknown): string {
  if (!value || typeof value !== "object") return "—";

  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => {
    return v !== null && v !== undefined && String(v).trim() !== "";
  });

  if (!entries.length) return "—";

  return entries.map(([key, v]) => `${humanizeInputKey(key)}: ${humanizeInputValue(key, v)}`).join("; ");
}

function inputNumber(value: unknown, keys: string[]): number | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  for (const key of keys) {
    const raw = row[key];
    if (raw !== null && raw !== undefined && raw !== "") {
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

function round6(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function thousandStitchBlocks(stitchCount: number): number {
  return Math.floor(stitchCount / 1000);
}

function thousandStitchFormula(stitches: number, unit: number): string {
  const blocks = thousandStitchBlocks(stitches);
  return `${stitches.toLocaleString()} stitches = ${blocks.toLocaleString()} thousand-stitch blocks × ${unit}`;
}

type AccessoryBreakdownSource = {
  pricingMethod: string;
  unitPrice: number;
  calculatedUnitPrice: number;
  inputValues: unknown;
};

function accessoryBreakdownRows(accessory: AccessoryBreakdownSource): Array<{ label: string; amount: number; formula?: string }> {
  const unit = Number(accessory.unitPrice || 0);
  const calculated = Number(accessory.calculatedUnitPrice || 0);
  const extra = round6(calculated - unit);
  const stitchCount = inputNumber(accessory.inputValues, ["stitchCount", "stitches"]);
  const colorCount = inputNumber(accessory.inputValues, ["colorCount", "colors"]);
  const panelCount = inputNumber(accessory.inputValues, ["panelCount", "panels"]);
  const rowCount = inputNumber(accessory.inputValues, ["rowCount", "rows", "pipingRows"]);

  switch (accessory.pricingMethod) {
    case "PER_1000_STITCHES":
      return [{
        label: "Stitch cost",
        amount: calculated,
        formula: stitchCount !== null ? thousandStitchFormula(stitchCount, unit) : undefined,
      }];
    case "BASE_PLUS_EMBROIDERY_STITCHES":
      return [{ label: "Base decoration", amount: unit }, {
        label: "Embroidery stitch add-on",
        amount: extra,
        formula: stitchCount !== null ? `${stitchCount.toLocaleString()} stitches = ${thousandStitchBlocks(stitchCount).toLocaleString()} thousand-stitch blocks` : undefined,
      }];
    case "PER_COLOR":
      return [{ label: "Color charge", amount: calculated, formula: colorCount !== null ? `${colorCount} colors × ${unit}` : undefined }];
    case "PRINTED_APPLIQUE": {
      const colorCharge = colorCount !== null ? round6(unit * colorCount) : unit;
      return [{ label: "Printed applique colors", amount: colorCharge, formula: colorCount !== null ? `${colorCount} colors × ${unit}` : undefined }, { label: "To apply applique", amount: round6(calculated - colorCharge) }];
    }
    case "PER_PANEL_PER_COLOR":
      return [{ label: "Panel/color charge", amount: calculated, formula: panelCount !== null && colorCount !== null ? `${panelCount} panels × ${colorCount} colors × ${unit}` : undefined }];
    case "PER_PANEL":
      return [{ label: "Panel charge", amount: calculated, formula: panelCount !== null ? `${panelCount} panels × ${unit}` : undefined }];
    case "PER_ROW":
      return [{ label: "Row charge", amount: calculated, formula: rowCount !== null ? `${rowCount} rows × ${unit}` : undefined }];
    case "FLAT_WITH_MERROWED":
      return [{ label: "Base decoration", amount: unit }, { label: "Merrowed edge add-on", amount: extra }];
    case "EMBROIDERY_WITH_MERROWED_AND_STITCHES":
      return [{ label: "Base decoration", amount: unit }, {
        label: "Merrowed / embroidery add-ons",
        amount: extra,
        formula: stitchCount !== null ? `${stitchCount.toLocaleString()} stitches = ${thousandStitchBlocks(stitchCount).toLocaleString()} thousand-stitch blocks, plus merrowed edge` : undefined,
      }];
    case "PRINTED_PATCH_WITH_MERROWED": {
      const colorCharge = colorCount !== null ? round6(unit * colorCount) : unit;
      return [{ label: "Printed patch colors", amount: colorCharge, formula: colorCount !== null ? `${colorCount} colors × ${unit}` : undefined }, { label: "Apply / merrowed add-ons", amount: round6(calculated - colorCharge) }];
    }
    case "FLAT_PER_UNIT":
    default:
      return [{ label: unit < 0 ? "Adjustment" : "Unit price", amount: calculated }];
  }
}

function AccessoryBreakdown({ accessory }: { accessory: AccessoryBreakdownSource }) {
  const rows = accessoryBreakdownRows(accessory).filter((row) => Math.abs(row.amount) > 0.0000001 || row.formula);
  if (!rows.length) return <>—</>;

  return (
    <div>
      {rows.map((row, index) => (
        <div key={`${row.label}-${index}`}>
          <strong>{row.label}:</strong> {fmtMoneyPrecise(row.amount)}
          {row.formula ? <div className="text-muted">{row.formula}</div> : null}
        </div>
      ))}
    </div>
  );
}

function AccessorySummary({ item }: { item: QuickTurnCalculatedItem }) {
  const decorations = item.accessories.filter((x) => x.category !== "CLOSURE");
  const closures = item.accessories.filter((x) => x.category === "CLOSURE");

  return (
    <div className="table-card">
      <div className="table-scroll">
        <table className="table-clean">
          <thead>
            <tr>
              <th>Component</th>
              <th>Name</th>
              <th>Inputs</th>
              <th>Price Breakdown</th>
              <th>Unit Price</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{item.isCustomCap ? "Custom Cap" : "Base Item"}</td>
              <td>
                <strong>{item.isCustomCap ? "Custom Cap" : item.baseItem.itemCode}</strong>
                <div className="text-muted">{item.customCapDescription || item.baseItem.fabricDescription || "No description"}</div>
              </td>
              <td>—</td>
              <td>{item.isCustomCap ? "Quote-specific custom cap cost" : "Base item price"}</td>
              <td>{fmtMoneyPrecise(item.baseItem.basePrice)}</td>
            </tr>

            {decorations.map((accessory) => (
              <tr key={accessory.id}>
                <td>Decoration</td>
                <td>{accessory.name}</td>
                <td>{formatInputs(accessory.inputValues)}</td>
                <td><AccessoryBreakdown accessory={accessory} /></td>
                <td>{fmtMoneyPrecise(accessory.calculatedUnitPrice)}</td>
              </tr>
            ))}

            {closures.map((accessory) => (
              <tr key={accessory.id}>
                <td>Closure</td>
                <td>{accessory.name}</td>
                <td>{formatInputs(accessory.inputValues)}</td>
                <td><AccessoryBreakdown accessory={accessory} /></td>
                <td>{fmtMoneyPrecise(accessory.calculatedUnitPrice)}</td>
              </tr>
            ))}

            {item.camoOption ? (
              <tr>
                <td>Camo</td>
                <td>
                  {item.camoOption.series}
                  <div className="text-muted">{item.camoOption.supplier}</div>
                </td>
                <td>Added after surcharge</td>
                <td>Not included in decorated item cost</td>
                <td>{fmtMoneyPrecise(item.camoOption.unitPrice)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function QuickTurnCalculatedResults({
  result,
  quoteName,
}: {
  result: QuickTurnCalculationResult;
  quoteName?: string | null;
}) {
  return (
    <div className="record-content">
      <section className="record-section-card">
        <div className="record-section-header">
          <div>
            <h2 className="record-section-title">Generated Quote Results</h2>
            <div className="text-muted">
              {quoteName ? `${quoteName} · ` : ""}
              Generated {fmtDateTime(result.generatedAt)} · Valid through {fmtDateOnly(result.validUntil)}
            </div>
          </div>
          <span className="record-pill record-pill-info">{result.program.name} / {result.factory.name}</span>
        </div>

        <div className="alert alert-warning" style={{ marginTop: 12 }}>
          {result.disclaimer}
        </div>
      </section>

      {result.items.map((item, index) => (
        <section key={item.clientItemId || index} className="record-section-card">
          <div className="record-section-header">
            <div>
              <h2 className="record-section-title">Quote Item {itemLabel(item, index)}</h2>
              <div className="text-muted">Decorated item cost excludes camo until after surcharge.</div>
            </div>
            <span className="record-pill record-pill-neutral">Decorated Cost: {fmtMoneyPrecise(item.decoratedUnitCost)}</span>
          </div>

          <div className="record-badge-row" style={{ marginBottom: 12 }}>
            <RateMeta label={item.isCustomCap ? "Custom Cap" : "Base"} value={fmtMoneyPrecise(item.baseUnitPrice)} />
            <RateMeta label="Decorations / Closure" value={fmtMoneyPrecise(item.accessoryUnitTotal)} />
            <RateMeta label="Camo After Surcharge" value={fmtMoneyPrecise(item.camoUnitPrice)} />
            <RateMeta label="One-Time Fees" value={fmtMoney(item.oneTimeFeeTotal)} />
          </div>

          <AccessorySummary item={item} />

          {item.fees.length ? (
            <OneTimeFeesTable fees={item.fees} />
          ) : null}

          <CalculatorResultsTable item={item} />
        </section>
      ))}
    </div>
  );
}

function OneTimeFeesTable({ fees }: { fees: Array<{ feeCode?: string; feeName: string; amount: number; notes: string | null }> }) {
  return (
    <div className="record-section-card" style={{ marginTop: 12 }}>
      <div className="record-section-header">
        <h3 className="record-section-title">One-Time Fees</h3>
      </div>
      <div className="table-card">
        <div className="table-scroll">
          <table className="table-clean">
            <thead>
              <tr>
                <th>Fee</th>
                <th>Amount</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((fee, feeIndex) => (
                <tr key={`${fee.feeCode || fee.feeName}-${feeIndex}`}>
                  <td>{fee.feeName}</td>
                  <td>{fmtMoney(fee.amount)}</td>
                  <td>{fee.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CalculatorResultsTable({ item }: { item: QuickTurnCalculatedItem }) {
  const labels = item.calculatorResults[0]?.breaks.map((b) => b.breakLabel) ?? [];

  return (
    <div className="record-section-card" style={{ marginTop: 12 }}>
      <div className="record-section-header">
        <h3 className="record-section-title">Calculator Results</h3>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="table-clean">
            <thead>
              <tr>
                <th>Calculator</th>
                {labels.map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {item.calculatorResults.map((calculatorResult) => (
                <tr key={calculatorResult.calculator.code}>
                  <td>
                    <strong>{calculatorResult.calculator.displayLabel || calculatorResult.calculator.name}</strong>
                    {calculatorResult.calculator.leadTimeNote ? (
                      <div className="text-muted">{calculatorResult.calculator.leadTimeNote}</div>
                    ) : null}
                  </td>
                  {calculatorResult.breaks.map((b) => (
                    <td key={b.quantityBreakId}>
                      <strong>{fmtMoney(b.unitPrice)}</strong>
                      {managementNoteNeeded(b.breakLabel, b.managementReviewRequired) ? (
                        <div className="text-muted">Upper management review recommended.</div>
                      ) : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function SavedQuickTurnQuoteResults({ row }: { row: SavedQuickTurnQuoteDetail }) {
  return (
    <div className="record-content">
      <section className="record-section-card">
        <div className="record-section-header">
          <div>
            <h2 className="record-section-title">Saved Quote Snapshot</h2>
            <div className="text-muted">
              Generated {fmtDateTime(row.generatedAt)} · Valid through {fmtDateOnly(row.validUntil)}
            </div>
          </div>
          <span className="record-pill record-pill-info">{row.programName} / {row.factoryName}</span>
        </div>

        <div className="alert alert-warning" style={{ marginTop: 12 }}>
          {row.disclaimer}
        </div>
      </section>

      {row.items.map((item, index) => (
        <section key={item.id} className="record-section-card">
          <div className="record-section-header">
            <div>
              <h2 className="record-section-title">Quote Item {index + 1}. {item.isCustomCap ? "Custom Cap" : item.baseItemCode}</h2>
              <div className="text-muted">Historical snapshot from saved quote.</div>
            </div>
            <span className="record-pill record-pill-neutral">Decorated Cost: {fmtMoneyPrecise(item.decoratedUnitCost)}</span>
          </div>

          <div className="table-card">
            <div className="table-scroll">
              <table className="table-clean">
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Name</th>
                    <th>Inputs</th>
                    <th>Price Breakdown</th>
                    <th>Unit Price</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{item.isCustomCap ? "Custom Cap" : "Base Item"}</td>
                    <td>
                      <strong>{item.isCustomCap ? "Custom Cap" : item.baseItemCode}</strong>
                      <div className="text-muted">{item.customCapDescription || item.baseItemDescription || "No description"}</div>
                    </td>
                    <td>—</td>
                    <td>{item.isCustomCap ? "Quote-specific custom cap cost" : "Base item price"}</td>
                    <td>{fmtMoneyPrecise(item.baseItemPrice)}</td>
                  </tr>

                  {item.accessories.map((accessory) => (
                    <tr key={accessory.id}>
                      <td>{accessory.category === "CLOSURE" ? "Closure" : "Decoration"}</td>
                      <td>{accessory.name}</td>
                      <td>{formatInputs(accessory.inputValues)}</td>
                      <td><AccessoryBreakdown accessory={accessory} /></td>
                      <td>{fmtMoneyPrecise(accessory.calculatedUnitPrice)}</td>
                    </tr>
                  ))}

                  {item.camoCode || item.camoSeries ? (
                    <tr>
                      <td>Camo</td>
                      <td>
                        {item.camoSeries || item.camoCode}
                        <div className="text-muted">{item.camoSupplier || "—"}</div>
                      </td>
                      <td>Added after surcharge</td>
                      <td>Not included in decorated item cost</td>
                      <td>{fmtMoneyPrecise(item.camoUnitPrice)}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {item.fees.length ? <OneTimeFeesTable fees={item.fees} /> : null}

          <SavedCalculatorResultsTable item={item} />
        </section>
      ))}
    </div>
  );
}

type SavedQuoteItem = SavedQuickTurnQuoteDetail["items"][number];

function SavedCalculatorResultsTable({ item }: { item: SavedQuoteItem }) {
  const groups = new Map<string, SavedQuoteItem["results"]>();

  for (const row of item.results) {
    const arr = groups.get(row.calculatorCode) ?? [];
    arr.push(row);
    groups.set(row.calculatorCode, arr);
  }

  const rows = Array.from(groups.entries()).map(([calculatorCode, resultRows]) => ({
    calculatorCode,
    calculatorName: resultRows[0]?.calculatorName ?? calculatorCode,
    breaks: [...resultRows].sort((a, b) => a.minQuantity - b.minQuantity),
  }));

  const labels = rows[0]?.breaks.map((b) => b.breakLabel) ?? [];

  return (
    <div className="record-section-card" style={{ marginTop: 12 }}>
      <div className="record-section-header">
        <h3 className="record-section-title">Calculator Results</h3>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="table-clean">
            <thead>
              <tr>
                <th>Calculator</th>
                {labels.map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((calculator) => (
                <tr key={calculator.calculatorCode}>
                  <td><strong>{calculator.calculatorName}</strong></td>
                  {calculator.breaks.map((b) => (
                    <td key={b.id}>
                      <strong>{fmtMoney(b.unitPrice)}</strong>
                      {managementNoteNeeded(b.breakLabel, b.managementReviewRequired) ? (
                        <div className="text-muted">Upper management review recommended.</div>
                      ) : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function fmtPercent(value?: number | string | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${(n * 100).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

export function SavedQuoteMeta({ row }: { row: SavedQuickTurnQuoteDetail }) {
  return (
    <div className="record-meta-grid">
      <MetaItem label="CAP Quote #" value={row.quoteNumber} />
      <MetaItem label="Customer Quote # / Quote Name" value={row.quoteName} />
      <MetaItem label="Status" value={row.quoteStatus === "DRAFT" ? "Draft" : "Published"} />
      <MetaItem label="Workflow SO / Reference #" value={row.workflowSalesOrderNumber} />
      <MetaItem label="OS Customer Service" value={row.overseasCustomerServiceNameSnapshot} />
      <MetaItem label="Rebate" value={fmtPercent(row.quoteRebateRate)} />
      <MetaItem label="Quote Prepared For" value={row.quotePreparedForDisplay || row.preparedForCustomerNameSnapshot} />
      <MetaItem label="Program Logo Text" value={row.programLogoText} />
      <MetaItem label="FOB / Destination" value={row.fob} />
      <MetaItem label="Revision" value={row.revisionNumber ? `Rev ${row.revisionNumber}` : "Original"} />
      <MetaItem label="Source Quote" value={row.sourceQuoteNumber} />
      <MetaItem label="Program" value={row.programName} />
      <MetaItem label="Factory" value={row.factoryName} />
      <MetaItem label="Generated" value={fmtDateTime(row.generatedAt)} />
      <MetaItem label="Valid Through" value={fmtDateOnly(row.validUntil)} />
      <MetaItem label="Published" value={row.publishedAt ? fmtDateTime(row.publishedAt) : null} />
      <MetaItem label="Published By" value={row.publishedBy} />
      <MetaItem label="Created By" value={row.createdBy} />
      <MetaItem label="Created" value={fmtDateTime(row.createdAt)} />
      <MetaItem label="Items" value={row.itemCount} />
      <MetaItem label="Notes" value={row.notes} full pre />
      {row.isVoided ? <MetaItem label="Void Reason" value={row.voidReason} full pre /> : null}
    </div>
  );
}

function MetaItem({
  label,
  value,
  full,
  pre,
}: {
  label: string;
  value: ReactNode;
  full?: boolean;
  pre?: boolean;
}) {
  return (
    <div className={full ? "record-meta-item record-meta-item-full" : "record-meta-item"}>
      <div className="record-meta-label">{label}</div>
      <div className={pre ? "record-meta-value record-meta-value-pre" : "record-meta-value"}>
        {value || "—"}
      </div>
    </div>
  );
}
