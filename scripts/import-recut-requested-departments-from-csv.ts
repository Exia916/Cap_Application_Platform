import fs from "fs/promises";
import path from "path";
import { db } from "../lib/db";

function normalizeCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/&/g, "AND")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

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
  const filePath = path.join(process.cwd(), "RequestedDepartment.csv");
  const raw = await fs.readFile(filePath, "utf8");
  const labels = parseSimpleCsvSingleColumn(raw);

  if (labels.length === 0) {
    throw new Error("No requested departments found in RequestedDepartment.csv");
  }

  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i];
    const code = normalizeCode(label);
    const sortOrder = i + 1;

    await db.query(
      `
      INSERT INTO public.recut_requested_departments (
        code,
        label,
        sort_order,
        is_active
      )
      VALUES ($1, $2, $3, true)
      ON CONFLICT (label)
      DO UPDATE SET
        code = EXCLUDED.code,
        sort_order = EXCLUDED.sort_order,
        is_active = true
      `,
      [code, label, sortOrder]
    );
  }

  console.log(`Imported ${labels.length} requested departments.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to import requested departments:", err);
  process.exit(1);
});