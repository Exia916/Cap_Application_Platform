import fs from "fs/promises";
import path from "path";
import { db } from "../lib/db";

function parseSimpleCsvSingleColumn(text: string): string[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) return [];

  return lines
    .slice(1)
    .map((line) => line.replace(/^"|"$/g, "").trim())
    .filter(Boolean);
}

async function main() {
  const filePath = path.join(process.cwd(), "items.csv");
  const raw = await fs.readFile(filePath, "utf8");
  const itemCodes = parseSimpleCsvSingleColumn(raw);

  if (itemCodes.length === 0) {
    throw new Error("No items found in items.csv");
  }

  for (let i = 0; i < itemCodes.length; i += 1) {
    const itemCode = itemCodes[i];
    const sortOrder = i + 1;

    await db.query(
      `
      INSERT INTO public.recut_items (
        item_code,
        description,
        sort_order,
        is_active
      )
      VALUES ($1, NULL, $2, true)
      ON CONFLICT (item_code)
      DO UPDATE SET
        sort_order = EXCLUDED.sort_order,
        is_active = true
      `,
      [itemCode, sortOrder]
    );
  }

  console.log(`Imported ${itemCodes.length} recut items.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to import recut items:", err);
  process.exit(1);
});