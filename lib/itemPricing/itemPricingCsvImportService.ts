// lib/itemPricing/itemPricingCsvImportService.ts

import type { ParsedItemPricingImportRow } from "@/lib/itemPricing/importTypes";

export const ITEM_PRICING_IMPORT_TEMPLATE_COLUMNS = [
  "item_code",
  "item_description",
  "rule_set_code",
  "blank_eqp_2500",
  "active",
  "product_family",
  "allows_blank_override",
  "allows_flat_emb_override",
  "allows_3d_override",
  "allows_knit_in_override",
  "notes",
];

export const ITEM_PRICING_IMPORT_TEMPLATE_CSV = `${ITEM_PRICING_IMPORT_TEMPLATE_COLUMNS.join(",")}\nTEST-CAP-280,Test Cap,IN_STOCK_CAPS,2.80,true,In Stock Caps,,,,,Example row\nTEST-PREM-280,Test Premium,PREMIUM_LINE,2.80,true,Premium Line,,,,,Example row\n`;

function normalizeHeader(value: string): string {
  return String(value || "")
    .trim()
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[\s\-]+/g, "_");
}

function readField(row: Record<string, string>, aliases: string[]): string | null {
  for (const alias of aliases) {
    const normalized = normalizeHeader(alias);
    if (Object.prototype.hasOwnProperty.call(row, normalized)) {
      const value = String(row[normalized] ?? "").trim();
      return value ? value : null;
    }
  }
  return null;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields.map((field) => field.trim());
}

export function parseItemPricingCsv(csvText: string | null | undefined): ParsedItemPricingImportRow[] {
  const text = String(csvText || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text) throw new Error("CSV content is required.");

  const physicalLines = text.split("\n");
  if (physicalLines.length < 2) throw new Error("CSV must include a header row and at least one data row.");

  const headers = parseCsvLine(physicalLines[0]).map(normalizeHeader);
  const missingCore = ["item_code", "rule_set_code", "blank_eqp_2500"].filter(
    (core) => !headers.includes(core) && !(core === "blank_eqp_2500" && (headers.includes("blank_eqp") || headers.includes("blank_eqp_price")))
  );

  if (missingCore.length > 0) {
    throw new Error(`CSV is missing required column(s): ${missingCore.join(", ")}.`);
  }

  const rows: ParsedItemPricingImportRow[] = [];

  for (let index = 1; index < physicalLines.length; index += 1) {
    const line = physicalLines[index];
    if (!line || !line.trim()) continue;

    const values = parseCsvLine(line);
    const raw: Record<string, string> = {};
    headers.forEach((header, headerIndex) => {
      raw[header] = values[headerIndex] ?? "";
    });

    rows.push({
      rowNumber: index + 1,
      itemCode: readField(raw, ["item_code", "style", "style_code", "item"]),
      itemDescription: readField(raw, ["item_description", "description", "item_desc"]),
      productFamily: readField(raw, ["product_family", "family", "category"]),
      ruleSetCode: readField(raw, ["rule_set_code", "rule_set", "pricing_family", "product_pricing_family"]),
      blankEqpPriceRaw: readField(raw, ["blank_eqp_2500", "blank_eqp", "blank_eqp_price", "eqp", "blank_2500"]),
      activeRaw: readField(raw, ["active", "is_active"]),
      allowsBlankOverrideRaw: readField(raw, ["allows_blank_override", "allow_blank", "allows_blank"]),
      allowsFlatEmbOverrideRaw: readField(raw, ["allows_flat_emb_override", "allow_flat", "allows_flat_emb"]),
      allows3dEmbOverrideRaw: readField(raw, ["allows_3d_override", "allows_3d_emb_override", "allow_3d", "allows_3d"]),
      allowsKnitInOverrideRaw: readField(raw, ["allows_knit_in_override", "allow_knit_in", "allows_knit_in"]),
      notes: readField(raw, ["notes", "note"]),
    });
  }

  if (rows.length === 0) throw new Error("CSV did not contain any data rows.");
  return rows;
}
