import type { VoidMode } from "./repoTypes";

export function buildVoidedWhereClause(
  tableAlias?: string,
  mode: VoidMode = "exclude"
): string {
  const col = tableAlias ? `${tableAlias}.is_voided` : "is_voided";

  switch (mode) {
    case "include":
      return "1=1";
    case "only":
      return `COALESCE(${col}, false) = true`;
    case "exclude":
    default:
      return `COALESCE(${col}, false) = false`;
  }
}

export function pushWhere(where: string[], clause?: string | null) {
  if (clause && clause.trim()) where.push(clause);
}

export function joinWhere(where: string[]) {
  return where.length ? `WHERE ${where.join(" AND ")}` : "";
}