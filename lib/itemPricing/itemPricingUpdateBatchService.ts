// lib/itemPricing/itemPricingUpdateBatchService.ts

import type { ItemPricingUpdateInputRow } from "@/lib/itemPricing/updateTypes";

export function parseItemPricingUpdateCsv(csvText: string | null | undefined): ItemPricingUpdateInputRow[] {
  const raw = String(csvText || "").trim();
  if (!raw) return [];

  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];

  const parseLine = (line: string) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      const next = line[i + 1];

      if (ch === '"' && inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }

    cells.push(current.trim());
    return cells;
  };

  const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  const itemCodeIndex = headers.findIndex((h) => ["item_code", "style", "style_code", "item"].includes(h));
  const priceIndex = headers.findIndex((h) => ["new_blank_eqp", "new_blank_eqp_price", "blank_eqp_2500", "blank_eqp_price", "blank_eqp"].includes(h));

  if (itemCodeIndex < 0 || priceIndex < 0) {
    throw new Error("CSV must include item_code and new_blank_eqp columns.");
  }

  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    return {
      itemCode: cells[itemCodeIndex] || null,
      newBlankEqp: cells[priceIndex] || null,
    };
  });
}

export function itemPricingUpdateTemplateCsv() {
  return [
    "item_code,new_blank_eqp",
    "X200,2.95",
    "I8507,4.10",
  ].join("\n");
}
