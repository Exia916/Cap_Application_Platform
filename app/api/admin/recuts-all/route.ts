// app/api/admin/recuts-all/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireManagerOrAdmin } from "../_shared/adminAuth";

export const runtime = "nodejs";

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseBoolFilter(v: string | null): boolean | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return null;
}

function escCsv(val: any) {
  const s = val === null || val === undefined ? "" : String(val);
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const auth = await requireManagerOrAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);

  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const showAll = searchParams.get("all") === "1";

  const q = (searchParams.get("q") || "").trim();

  const recutId = searchParams.get("recutId");
  const requestedTime = searchParams.get("requestedTime");
  const requestedByUserId = searchParams.get("requestedByUserId");
  const requestedByUsername = searchParams.get("requestedByUsername");
  const requestedByName = searchParams.get("requestedByName");
  const requestedByEmployeeNumber = searchParams.get("requestedByEmployeeNumber");
  const requestedDepartment = searchParams.get("requestedDepartment");
  const salesOrder = searchParams.get("salesOrder");
  const salesOrderBase = searchParams.get("salesOrderBase");
  const salesOrderDisplay = searchParams.get("salesOrderDisplay");
  const designName = searchParams.get("designName");
  const recutReason = searchParams.get("recutReason");
  const detailNumber = searchParams.get("detailNumber");
  const capStyle = searchParams.get("capStyle");
  const pieces = searchParams.get("pieces");
  const operator = searchParams.get("operator");
  const deliverTo = searchParams.get("deliverTo");
  const notes = searchParams.get("notes");

  const event = parseBoolFilter(searchParams.get("event"));
  const supervisorApproved = parseBoolFilter(searchParams.get("supervisorApproved"));
  const warehousePrinted = parseBoolFilter(searchParams.get("warehousePrinted"));
  const doNotPull = parseBoolFilter(searchParams.get("doNotPull"));
  const isCompleted = parseBoolFilter(searchParams.get("isCompleted"));

  const format = searchParams.get("format");

  const page = clamp(toInt(searchParams.get("page"), 1), 1, 1_000_000);
  const pageSize = clamp(toInt(searchParams.get("pageSize"), 100), 10, 500);

  const sortFieldRaw = (searchParams.get("sort") || "requestedDate").trim();
  const sortDirRaw = (searchParams.get("dir") || "desc").toLowerCase();

  const sortFieldMap: Record<string, string> = {
    recutId: `r.recut_id`,
    requestedDate: `r.requested_date`,
    requestedTime: `r.requested_time`,
    requestedAt: `r.requested_at`,
    requestedByUserId: `r.requested_by_user_id`,
    requestedByUsername: `r.requested_by_username`,
    requestedByName: `r.requested_by_name`,
    requestedByEmployeeNumber: `r.requested_by_employee_number`,
    requestedDepartment: `r.requested_department`,
    salesOrder: `COALESCE(r.sales_order_display, r.sales_order)`,
    salesOrderBase: `r.sales_order_base`,
    salesOrderDisplay: `r.sales_order_display`,
    designName: `r.design_name`,
    recutReason: `r.recut_reason`,
    detailNumber: `r.detail_number`,
    capStyle: `r.cap_style`,
    pieces: `r.pieces`,
    operator: `r.operator`,
    deliverTo: `r.deliver_to`,
    notes: `r.notes`,
    event: `r.event`,
    supervisorApproved: `r.supervisor_approved`,
    supervisorApprovedAt: `r.supervisor_approved_at`,
    supervisorApprovedBy: `r.supervisor_approved_by`,
    warehousePrinted: `r.warehouse_printed`,
    warehousePrintedAt: `r.warehouse_printed_at`,
    warehousePrintedBy: `r.warehouse_printed_by`,
    isCompleted: `r.is_completed`,
    doNotPull: `r.do_not_pull`,
    doNotPullAt: `r.do_not_pull_at`,
    doNotPullBy: `r.do_not_pull_by`,
    createdAt: `r.created_at`,
    updatedAt: `r.updated_at`,
  };

  const sortField = sortFieldMap[sortFieldRaw] || `r.requested_date`;
  const sortDir = sortDirRaw === "asc" ? "ASC" : "DESC";

  const where: string[] = [`COALESCE(r.is_voided, false) = false`];
  const params: any[] = [];

  const add = (sql: string, value?: any) => {
    where.push(sql.replace("?", `$${params.length + 1}`));
    params.push(value);
  };

  if (!showAll) {
    if (start) add(`r.requested_date >= ?::date`, start);
    if (end) add(`r.requested_date <= ?::date`, end);
    if (!start && !end) {
      where.push(`r.requested_date >= (CURRENT_DATE - INTERVAL '30 days')`);
    }
  }

  if (q) {
    const like = `%${q}%`;
    const p1 = `$${params.length + 1}`;
    const p2 = `$${params.length + 2}`;
    const p3 = `$${params.length + 3}`;
    const p4 = `$${params.length + 4}`;
    const p5 = `$${params.length + 5}`;
    const p6 = `$${params.length + 6}`;
    const p7 = `$${params.length + 7}`;
    const p8 = `$${params.length + 8}`;
    const p9 = `$${params.length + 9}`;
    const p10 = `$${params.length + 10}`;
    const p11 = `$${params.length + 11}`;
    const p12 = `$${params.length + 12}`;
    const p13 = `$${params.length + 13}`;
    const p14 = `$${params.length + 14}`;
    const p15 = `$${params.length + 15}`;

    where.push(`(
      CAST(r.recut_id AS text) ILIKE ${p1}
      OR CAST(r.requested_date AS text) ILIKE ${p2}
      OR CAST(r.requested_time AS text) ILIKE ${p3}
      OR COALESCE(r.requested_by_user_id, '') ILIKE ${p4}
      OR COALESCE(r.requested_by_username, '') ILIKE ${p5}
      OR r.requested_by_name ILIKE ${p6}
      OR CAST(r.requested_by_employee_number AS text) ILIKE ${p7}
      OR r.requested_department ILIKE ${p8}
      OR COALESCE(r.sales_order_base, '') ILIKE ${p9}
      OR COALESCE(r.sales_order_display, r.sales_order, '') ILIKE ${p10}
      OR r.design_name ILIKE ${p11}
      OR r.recut_reason ILIKE ${p12}
      OR CAST(r.detail_number AS text) ILIKE ${p13}
      OR r.operator ILIKE ${p14}
      OR COALESCE(r.notes, '') ILIKE ${p15}
    )`);

    params.push(
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like
    );
  }

  if (recutId) add(`CAST(r.recut_id AS text) ILIKE ?`, `%${recutId}%`);
  if (requestedTime) add(`CAST(r.requested_time AS text) ILIKE ?`, `%${requestedTime}%`);
  if (requestedByUserId) add(`COALESCE(r.requested_by_user_id, '') ILIKE ?`, `%${requestedByUserId}%`);
  if (requestedByUsername) add(`COALESCE(r.requested_by_username, '') ILIKE ?`, `%${requestedByUsername}%`);
  if (requestedByName) add(`r.requested_by_name ILIKE ?`, `%${requestedByName}%`);
  if (requestedByEmployeeNumber) add(`CAST(r.requested_by_employee_number AS text) ILIKE ?`, `%${requestedByEmployeeNumber}%`);
  if (requestedDepartment) add(`r.requested_department ILIKE ?`, `%${requestedDepartment}%`);

  if (salesOrder) {
    add(
      `(COALESCE(r.sales_order_base, '') ILIKE ? OR COALESCE(r.sales_order_display, r.sales_order, '') ILIKE $${params.length + 1})`,
      `%${salesOrder}%`
    );
  }

  if (salesOrderBase) add(`COALESCE(r.sales_order_base, '') ILIKE ?`, `%${salesOrderBase}%`);
  if (salesOrderDisplay) add(`COALESCE(r.sales_order_display, '') ILIKE ?`, `%${salesOrderDisplay}%`);
  if (designName) add(`r.design_name ILIKE ?`, `%${designName}%`);
  if (recutReason) add(`r.recut_reason ILIKE ?`, `%${recutReason}%`);
  if (detailNumber) add(`CAST(r.detail_number AS text) ILIKE ?`, `%${detailNumber}%`);
  if (capStyle) add(`r.cap_style ILIKE ?`, `%${capStyle}%`);
  if (pieces) add(`CAST(r.pieces AS text) ILIKE ?`, `%${pieces}%`);
  if (operator) add(`r.operator ILIKE ?`, `%${operator}%`);
  if (deliverTo) add(`r.deliver_to ILIKE ?`, `%${deliverTo}%`);
  if (notes) add(`COALESCE(r.notes, '') ILIKE ?`, `%${notes}%`);

  if (typeof event === "boolean") add(`r.event = ?`, event);
  if (typeof supervisorApproved === "boolean") add(`r.supervisor_approved = ?`, supervisorApproved);
  if (typeof warehousePrinted === "boolean") add(`r.warehouse_printed = ?`, warehousePrinted);
  if (typeof isCompleted === "boolean") add(`r.is_completed = ?`, isCompleted);
  if (typeof doNotPull === "boolean") add(`r.do_not_pull = ?`, doNotPull);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const baseSelect = `
    SELECT
      r.id,
      r.recut_id AS "recutId",
      r.requested_at AS "requestedAt",
      r.requested_date AS "requestedDate",
      r.requested_time AS "requestedTime",

      r.requested_by_user_id AS "requestedByUserId",
      r.requested_by_username AS "requestedByUsername",
      r.requested_by_name AS "requestedByName",
      r.requested_by_employee_number AS "requestedByEmployeeNumber",

      r.requested_department AS "requestedDepartment",

      COALESCE(r.sales_order_display, r.sales_order) AS "salesOrder",
      r.sales_order_base AS "salesOrderBase",
      r.sales_order_display AS "salesOrderDisplay",

      r.design_name AS "designName",
      r.recut_reason AS "recutReason",
      r.detail_number AS "detailNumber",
      r.cap_style AS "capStyle",
      r.pieces,
      r.operator,
      r.deliver_to AS "deliverTo",
      r.notes,
      r.event,

      r.supervisor_approved AS "supervisorApproved",
      r.supervisor_approved_at AS "supervisorApprovedAt",
      r.supervisor_approved_by AS "supervisorApprovedBy",

      r.warehouse_printed AS "warehousePrinted",
      r.warehouse_printed_at AS "warehousePrintedAt",
      r.warehouse_printed_by AS "warehousePrintedBy",

      r.is_completed AS "isCompleted",

      r.do_not_pull AS "doNotPull",
      r.do_not_pull_at AS "doNotPullAt",
      r.do_not_pull_by AS "doNotPullBy",

      r.created_at AS "createdAt",
      r.updated_at AS "updatedAt"
    FROM public.recut_requests r
    ${whereSql}
    ORDER BY ${sortField} ${sortDir}, r.recut_id DESC
  `;

  if (format === "csv") {
    const { rows } = await db.query(baseSelect, params);

    const headers = [
      "requestedDate",
      "operator",
      "requestedByName",
      "salesOrder",
      "recutReason",
      "pieces",
      "recutId",
      "requestedAt",
      "requestedTime",
      "requestedByUserId",
      "requestedByUsername",
      "requestedByEmployeeNumber",
      "requestedDepartment",
      "salesOrderBase",
      "salesOrderDisplay",
      "designName",
      "detailNumber",
      "capStyle",
      "deliverTo",
      "notes",
      "event",
      "supervisorApproved",
      "supervisorApprovedAt",
      "supervisorApprovedBy",
      "warehousePrinted",
      "warehousePrintedAt",
      "warehousePrintedBy",
      "isCompleted",
      "doNotPull",
      "doNotPullAt",
      "doNotPullBy",
      "createdAt",
      "updatedAt",
    ];

    const lines = [
      headers.join(","),
      ...rows.map((r: any) => headers.map((h) => escCsv(r[h])).join(",")),
    ];

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="recuts-all.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const countSql = `SELECT COUNT(*)::int AS count FROM public.recut_requests r ${whereSql}`;
  const totalsSql = `
    SELECT COALESCE(SUM(r.pieces), 0)::bigint AS total_pieces
    FROM public.recut_requests r
    ${whereSql}
  `;

  const offset = (page - 1) * pageSize;
  const pagedSql = `${baseSelect} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const pagedParams = [...params, pageSize, offset];

  const [countRes, rowsRes, totalsRes] = await Promise.all([
    db.query(countSql, params),
    db.query(pagedSql, pagedParams),
    db.query(totalsSql, params),
  ]);

  const totalCount = countRes.rows?.[0]?.count ?? 0;

  return NextResponse.json({
    page,
    pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    rows: rowsRes.rows,
    totals: totalsRes.rows?.[0] ?? { total_pieces: 0 },
  });
}