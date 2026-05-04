// app/api/admin/global-search/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireGlobalSearchAccess } from "../_shared/adminAuth";

export const runtime = "nodejs";

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function GET(req: Request) {
  const auth = await requireGlobalSearchAccess();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(req.url);

  const q = (searchParams.get("q") || "").trim();
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const showAll = searchParams.get("all") === "1";

  const limit = clamp(toInt(searchParams.get("limit"), 50), 5, 200);

  if (!q) {
    return NextResponse.json({
      q,
      start,
      end,
      all: showAll,
      limit,
      sections: [
        { key: "daily", title: "Daily Production", count: 0, rows: [] },
        { key: "qc", title: "QC Daily Production", count: 0, rows: [] },
        { key: "emblem", title: "Emblem Production", count: 0, rows: [] },
        { key: "laser", title: "Laser Production", count: 0, rows: [] },
        { key: "sampleEmbroidery", title: "Sample Embroidery", count: 0, rows: [] },
        { key: "knitProduction", title: "Knit Production", count: 0, rows: [] },
        { key: "knitQc", title: "Knit QC", count: 0, rows: [] },
        { key: "recut", title: "Recut Requests", count: 0, rows: [] },
        { key: "workOrders", title: "CMMS Work Orders", count: 0, rows: [] },
        { key: "designWorkflow", title: "Design Workflow", count: 0, rows: [] },
      ],
    });
  }

  const like = `%${q}%`;

  const dateClause = (fieldSql: string) => {
    const parts: string[] = [];
    const params: any[] = [];

    if (!showAll) {
      if (start) {
        parts.push(`${fieldSql} >= $${params.length + 1}::date`);
        params.push(start);
      }
      if (end) {
        parts.push(`${fieldSql} <= $${params.length + 1}::date`);
        params.push(end);
      }
      if (!start && !end) {
        parts.push(`${fieldSql} >= (CURRENT_DATE - INTERVAL '30 days')`);
      }
    }

    return { sql: parts.length ? `AND ${parts.join(" AND ")}` : "", params };
  };

  // ---------------------------------------------------------------------------
  // Daily Production
  // NOTE: return submission_id, not line id
  // ---------------------------------------------------------------------------
  const dailyDate = dateClause("e.shift_date");

  const dailySql = `
    SELECT
      s.id AS submission_id,
      s.id AS id,
      s.entry_ts,
      e.shift_date AS entry_date,
      s.name,
      s.employee_number,
      s.shift,
      s.machine_number,
      s.sales_order,
      e.detail_number,
      e.embroidery_location,
      e.pieces,
      e.stitches,
      e.is_3d,
      e.is_knit,
      e.detail_complete,
      e.annex,
      e.jobber_samples_ran,
      e.notes
    FROM public.embroidery_daily_entries e
    JOIN public.embroidery_daily_submissions s
      ON s.id = e.submission_id
    WHERE
      (
        s.name ILIKE $1
        OR s.shift ILIKE $2
        OR COALESCE(e.embroidery_location, '') ILIKE $3
        OR COALESCE(e.notes, '') ILIKE $4
        OR COALESCE(s.notes, '') ILIKE $5
        OR CAST(s.employee_number AS text) ILIKE $6
        OR CAST(s.machine_number AS text) ILIKE $7
        OR CAST(s.sales_order AS text) ILIKE $8
        OR CAST(e.detail_number AS text) ILIKE $9
        OR CAST(e.shift_date AS text) ILIKE $10
        OR CAST(e.stitches AS text) ILIKE $11
        OR CAST(e.pieces AS text) ILIKE $12
      )
      ${dailyDate.sql}
    ORDER BY s.entry_ts DESC, e.id DESC
    LIMIT $${12 + dailyDate.params.length + 1}
  `;

  const dailyParams = [
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
    ...dailyDate.params,
    limit,
  ];

  // ---------------------------------------------------------------------------
  // QC Daily
  // NOTE: return submission_id, not line id
  // ---------------------------------------------------------------------------
  const qcDate = dateClause("q.entry_date");

  const qcSql = `
    SELECT
      s.id AS submission_id,
      s.id AS id,
      s.entry_ts,
      q.entry_date,
      s.name,
      s.employee_number,
      s.sales_order,
      q.detail_number,
      q.flat_or_3d,
      q.order_quantity,
      q.inspected_quantity,
      q.rejected_quantity,
      q.quantity_shipped,
      q.notes
    FROM public.qc_daily_entries q
    JOIN public.qc_daily_submissions s
      ON s.id = q.submission_id
    WHERE
      (
        s.name ILIKE $1
        OR COALESCE(q.flat_or_3d, '') ILIKE $2
        OR COALESCE(q.notes, '') ILIKE $3
        OR COALESCE(s.notes, '') ILIKE $4
        OR CAST(s.employee_number AS text) ILIKE $5
        OR CAST(s.sales_order AS text) ILIKE $6
        OR CAST(q.detail_number AS text) ILIKE $7
        OR CAST(q.order_quantity AS text) ILIKE $8
        OR CAST(q.inspected_quantity AS text) ILIKE $9
        OR CAST(q.rejected_quantity AS text) ILIKE $10
        OR CAST(q.quantity_shipped AS text) ILIKE $11
        OR CAST(q.entry_date AS text) ILIKE $12
      )
      ${qcDate.sql}
    ORDER BY s.entry_ts DESC, q.id DESC
    LIMIT $${12 + qcDate.params.length + 1}
  `;

  const qcParams = [
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
    ...qcDate.params,
    limit,
  ];

  // ---------------------------------------------------------------------------
  // Emblem
  // ---------------------------------------------------------------------------
  const emDate = dateClause("s.entry_date");

  const emblemSql = `
    SELECT
      s.id AS submission_id,
      s.id AS id,
      s.entry_ts,
      s.entry_date,
      s.name,
      s.employee_number,
      l.sales_order,
      l.detail_number,
      l.emblem_type,
      l.logo_name,
      l.pieces,
      l.line_notes AS notes
    FROM public.emblem_daily_submission_lines l
    JOIN public.emblem_daily_submissions s ON s.id = l.submission_id
    WHERE
      (
        s.name ILIKE $1
        OR CAST(s.employee_number AS text) ILIKE $2
        OR CAST(s.entry_date AS text) ILIKE $3
        OR CAST(l.sales_order AS text) ILIKE $4
        OR CAST(l.detail_number AS text) ILIKE $5
        OR COALESCE(l.emblem_type, '') ILIKE $6
        OR COALESCE(l.logo_name, '') ILIKE $7
        OR CAST(l.pieces AS text) ILIKE $8
        OR COALESCE(l.line_notes, '') ILIKE $9
        OR COALESCE(s.notes, '') ILIKE $10
      )
      ${emDate.sql}
    ORDER BY s.entry_ts DESC
    LIMIT $${10 + emDate.params.length + 1}
  `;

  const emblemParams = [
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
    ...emDate.params,
    limit,
  ];

  // ---------------------------------------------------------------------------
  // Laser
  // ---------------------------------------------------------------------------
  const lzDate = dateClause("l.entry_date");

  const laserSql = `
    SELECT
      l.id,
      l.entry_ts,
      l.entry_date,
      l.name,
      l.employee_number,
      l.sales_order,
      l.leather_style_color,
      l.pieces_cut,
      l.notes
    FROM public.laser_entries l
    WHERE
      (
        l.name ILIKE $1
        OR CAST(l.employee_number AS text) ILIKE $2
        OR CAST(l.entry_date AS text) ILIKE $3
        OR CAST(l.sales_order AS text) ILIKE $4
        OR COALESCE(l.leather_style_color, '') ILIKE $5
        OR CAST(l.pieces_cut AS text) ILIKE $6
        OR COALESCE(l.notes, '') ILIKE $7
      )
      ${lzDate.sql}
    ORDER BY l.entry_ts DESC
    LIMIT $${7 + lzDate.params.length + 1}
  `;

  const laserParams = [like, like, like, like, like, like, like, ...lzDate.params, limit];

    // ---------------------------------------------------------------------------
  // Sample Embroidery
  // ---------------------------------------------------------------------------
  const sampleEmbDate = dateClause("s.entry_date");

  const sampleEmbroiderySql = `
    SELECT
      s.id,
      s.entry_ts,
      s.entry_date,
      s.name,
      s.employee_number,
      s.sales_order,
      s.detail_count,
      s.quantity,
      s.notes
    FROM public.sample_embroidery_entries s
    WHERE
      (
        s.name ILIKE $1
        OR COALESCE(s.notes, '') ILIKE $2
        OR CAST(s.employee_number AS text) ILIKE $3
        OR CAST(s.sales_order AS text) ILIKE $4
        OR CAST(s.detail_count AS text) ILIKE $5
        OR CAST(s.quantity AS text) ILIKE $6
        OR CAST(s.entry_date AS text) ILIKE $7
      )
      ${sampleEmbDate.sql}
    ORDER BY s.entry_ts DESC, s.id DESC
    LIMIT $${7 + sampleEmbDate.params.length + 1}
  `;

  const sampleEmbroideryParams = [
    like,
    like,
    like,
    like,
    like,
    like,
    like,
    ...sampleEmbDate.params,
    limit,
  ];

  // ---------------------------------------------------------------------------
  // Knit Production
  // NOTE: return submission_id, not line id
  // ---------------------------------------------------------------------------
  const knitProdDate = dateClause("s.entry_date");

  const knitProductionSql = `
    SELECT
      s.id AS submission_id,
      s.id AS id,
      s.entry_ts,
      s.entry_date,
      s.name,
      s.employee_number,
      s.shift,
      COALESCE(s.sales_order_display, s.sales_order_base) AS sales_order,
      s.sales_order_base,
      s.sales_order_display,
      l.detail_number,
      l.item_style,
      l.logo,
      l.quantity,
      COALESCE(l.line_notes, s.notes) AS notes
    FROM public.knit_production_lines l
    JOIN public.knit_production_submissions s
      ON s.id = l.submission_id
    WHERE
      COALESCE(s.is_voided, false) = false
      AND (
        s.name ILIKE $1
        OR COALESCE(s.notes, '') ILIKE $2
        OR CAST(s.employee_number AS text) ILIKE $3
        OR COALESCE(s.sales_order_display, '') ILIKE $4
        OR COALESCE(s.sales_order_base, '') ILIKE $5
        OR CAST(s.entry_date AS text) ILIKE $6
        OR CAST(l.detail_number AS text) ILIKE $7
        OR COALESCE(l.item_style, '') ILIKE $8
        OR COALESCE(l.logo, '') ILIKE $9
        OR CAST(l.quantity AS text) ILIKE $10
        OR COALESCE(l.line_notes, '') ILIKE $11
      )
      ${knitProdDate.sql}
    ORDER BY s.entry_ts DESC, l.id DESC
    LIMIT $${11 + knitProdDate.params.length + 1}
  `;

  const knitProductionParams = [
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
    ...knitProdDate.params,
    limit,
  ];

  // ---------------------------------------------------------------------------
  // Knit QC
  // NOTE: return submission_id, not line id
  // ---------------------------------------------------------------------------
  const knitQcDate = dateClause("s.entry_date");

  const knitQcSql = `
    SELECT
      s.id AS submission_id,
      s.id AS id,
      s.entry_ts,
      s.entry_date,
      s.name,
      s.employee_number,
      s.shift,
      COALESCE(s.sales_order_display, s.sales_order_base) AS sales_order,
      s.sales_order_base,
      s.sales_order_display,
      l.detail_number,
      l.logo,
      l.order_quantity,
      l.inspected_quantity,
      l.rejected_quantity,
      l.reject_reason_id,
      l.qc_employee_number,
      COALESCE(l.line_notes, s.notes) AS notes
    FROM public.knit_qc_submission_lines l
    JOIN public.knit_qc_submissions s
      ON s.id = l.submission_id
    WHERE
      COALESCE(s.is_voided, false) = false
      AND (
        s.name ILIKE $1
        OR COALESCE(s.notes, '') ILIKE $2
        OR CAST(s.employee_number AS text) ILIKE $3
        OR COALESCE(s.sales_order_display, '') ILIKE $4
        OR COALESCE(s.sales_order_base, '') ILIKE $5
        OR CAST(s.entry_date AS text) ILIKE $6
        OR CAST(l.detail_number AS text) ILIKE $7
        OR COALESCE(l.logo, '') ILIKE $8
        OR CAST(l.order_quantity AS text) ILIKE $9
        OR CAST(l.inspected_quantity AS text) ILIKE $10
        OR CAST(l.rejected_quantity AS text) ILIKE $11
        OR CAST(l.reject_reason_id AS text) ILIKE $12
        OR CAST(l.qc_employee_number AS text) ILIKE $13
        OR COALESCE(l.line_notes, '') ILIKE $14
      )
      ${knitQcDate.sql}
    ORDER BY s.entry_ts DESC, l.id DESC
    LIMIT $${14 + knitQcDate.params.length + 1}
  `;

  const knitQcParams = [
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
    ...knitQcDate.params,
    limit,
  ];

// ---------------------------------------------------------------------------
  // Design Workflow
  // ---------------------------------------------------------------------------
  const designWorkflowDate = dateClause("dwr.date_request_created");

  const designWorkflowSql = `
    SELECT
      dwr.id,
      dwr.created_at AS entry_ts,
      dwr.date_request_created AS entry_date,
      COALESCE(dwr.created_by_name, '') AS name,
      NULL::int AS employee_number,

      dwr.request_number,
      dwr.sales_order_number AS sales_order,
      dwr.sales_order_base,
      dwr.po_number,
      dwr.tape_name,
      dwr.due_date,
      dwr.customer_name,
      dwr.customer_code,
      dwr.bin_code,
      dwr.digitizer_name,
      dwr.designer_name,
      COALESCE(dws.label, '') AS request_status,
      dwr.instructions,
      dwr.additional_instructions,
      dwr.colorways_text,
      dwr.tape_number,
      dwr.rush,
      dwr.style_code,
      dwr.sample_so_number,
      dwr.stitch_count,
      dwr.art_proof,
      COALESCE(
        NULLIF(dwr.instructions, ''),
        NULLIF(dwr.additional_instructions, ''),
        NULLIF(dwr.colorways_text, ''),
        ''
      ) AS notes
    FROM public.design_workflow_requests dwr
    LEFT JOIN public.design_workflow_statuses dws
      ON dws.id = dwr.status_id
    WHERE
      COALESCE(dwr.is_voided, false) = false
      AND (
        CAST(dwr.request_number AS text) ILIKE $1
        OR COALESCE(dwr.sales_order_number, '') ILIKE $2
        OR COALESCE(dwr.sales_order_base, '') ILIKE $3
        OR COALESCE(dwr.po_number, '') ILIKE $4
        OR COALESCE(dwr.tape_name, '') ILIKE $5
        OR CAST(dwr.date_request_created AS text) ILIKE $6
        OR CAST(dwr.due_date AS text) ILIKE $7
        OR COALESCE(dwr.customer_name, '') ILIKE $8
        OR COALESCE(dwr.customer_code, '') ILIKE $9
        OR COALESCE(dwr.bin_code, '') ILIKE $10
        OR COALESCE(dwr.created_by_name, '') ILIKE $11
        OR COALESCE(dwr.digitizer_name, '') ILIKE $12
        OR COALESCE(dwr.designer_name, '') ILIKE $13
        OR COALESCE(dws.label, '') ILIKE $14
        OR COALESCE(dwr.instructions, '') ILIKE $15
        OR COALESCE(dwr.additional_instructions, '') ILIKE $16
        OR COALESCE(dwr.colorways_text, '') ILIKE $17
        OR COALESCE(dwr.tape_number, '') ILIKE $18
        OR COALESCE(dwr.style_code, '') ILIKE $19
        OR COALESCE(dwr.sample_so_number, '') ILIKE $20
        OR CAST(dwr.stitch_count AS text) ILIKE $21
      )
      ${designWorkflowDate.sql}
    ORDER BY dwr.created_at DESC, dwr.request_number DESC
    LIMIT $${21 + designWorkflowDate.params.length + 1}
  `;

  const designWorkflowParams = [
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
    like,
    like,
    like,
    like,
    like,
    like,
    like,
    ...designWorkflowDate.params,
    limit,
  ];

  // ---------------------------------------------------------------------------
  // Recut
  // ---------------------------------------------------------------------------
  const recutDate = dateClause("r.requested_date");

  const recutSql = `
    SELECT
      r.id,
      r.requested_at AS entry_ts,
      r.requested_date AS entry_date,
      r.requested_by_name AS name,
      r.requested_by_employee_number AS employee_number,
      r.recut_id,
      r.requested_department,
      r.sales_order,
      r.design_name,
      r.recut_reason,
      r.detail_number,
      r.cap_style,
      r.pieces,
      r.operator,
      r.deliver_to,
      r.supervisor_approved,
      r.warehouse_printed,
      r.event,
      r.do_not_pull,
      r.notes
    FROM public.recut_requests r
    WHERE
      (
        COALESCE(r.requested_by_name, '') ILIKE $1
        OR COALESCE(r.requested_by_username, '') ILIKE $2
        OR COALESCE(r.requested_department, '') ILIKE $3
        OR COALESCE(r.sales_order, '') ILIKE $4
        OR COALESCE(r.design_name, '') ILIKE $5
        OR COALESCE(r.recut_reason, '') ILIKE $6
        OR COALESCE(r.cap_style, '') ILIKE $7
        OR COALESCE(r.operator, '') ILIKE $8
        OR COALESCE(r.deliver_to, '') ILIKE $9
        OR COALESCE(r.notes, '') ILIKE $10
        OR CAST(r.recut_id AS text) ILIKE $11
        OR CAST(r.requested_by_employee_number AS text) ILIKE $12
        OR CAST(r.detail_number AS text) ILIKE $13
        OR CAST(r.pieces AS text) ILIKE $14
        OR CAST(r.requested_date AS text) ILIKE $15
      )
      ${recutDate.sql}
    ORDER BY r.requested_at DESC
    LIMIT $${15 + recutDate.params.length + 1}
  `;

  const recutParams = [
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
    like,
    ...recutDate.params,
    limit,
  ];

  // ---------------------------------------------------------------------------
  // Work Orders
  // ---------------------------------------------------------------------------
  const woDate = dateClause("wo.requested_at::date");

  const workOrdersSql = `
    SELECT
      wo.work_order_id::int AS id,
      wo.work_order_id::int AS work_order_id,
      wo.requested_at AS entry_ts,
      wo.requested_at::date AS entry_date,
      COALESCE(wo.requested_by_name, '') AS name,
      NULL::int AS employee_number,
      d.name AS department,
      a.name AS asset,
      pr.name AS priority,
      wo.operator_initials,
      wt.name AS work_order_type,
      t.name AS tech,
      ic.name AS common_issue,
      st.name AS status,
      wo.issue_dialogue,
      wo.resolution,
      wo.down_time_recorded,
      COALESCE(wo.resolution, wo.issue_dialogue, '') AS notes
    FROM cmms.work_orders wo
    JOIN cmms.departments d ON d.id = wo.department_id
    JOIN cmms.assets a ON a.id = wo.asset_id
    JOIN cmms.priorities pr ON pr.id = wo.priority_id
    JOIN cmms.issue_catalog ic ON ic.id = wo.common_issue_id
    JOIN cmms.statuses st ON st.id = wo.status_id
    LEFT JOIN cmms.techs t ON t.id = wo.tech_id
    LEFT JOIN cmms.wo_types wt ON wt.id = wo.type_id
    WHERE
      (
        COALESCE(wo.requested_by_name, '') ILIKE $1
        OR COALESCE(wo.requested_by_user_id, '') ILIKE $2
        OR COALESCE(wo.operator_initials, '') ILIKE $3
        OR COALESCE(wo.issue_dialogue, '') ILIKE $4
        OR COALESCE(wo.resolution, '') ILIKE $5
        OR CAST(wo.down_time_recorded AS text) ILIKE $6
        OR COALESCE(d.name, '') ILIKE $7
        OR COALESCE(a.name, '') ILIKE $8
        OR COALESCE(pr.name, '') ILIKE $9
        OR COALESCE(ic.name, '') ILIKE $10
        OR COALESCE(st.name, '') ILIKE $11
        OR COALESCE(t.name, '') ILIKE $12
        OR COALESCE(wt.name, '') ILIKE $13
        OR CAST(wo.work_order_id AS text) ILIKE $14
        OR CAST(wo.requested_at::date AS text) ILIKE $15
      )
      ${woDate.sql}
    ORDER BY wo.requested_at DESC, wo.work_order_id DESC
    LIMIT $${15 + woDate.params.length + 1}
  `;

  const workOrdersParams = [
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
    like,
    ...woDate.params,
    limit,
  ];

  const [
    dailyRes,
    qcRes,
    emblemRes,
    laserRes,
    sampleEmbroideryRes,
    knitProductionRes,
    knitQcRes,
    designWorkflowRes,
    recutRes,
    workOrdersRes,
  ] = await Promise.all([
    db.query(dailySql, dailyParams),
    db.query(qcSql, qcParams),
    db.query(emblemSql, emblemParams),
    db.query(laserSql, laserParams),
    db.query(sampleEmbroiderySql, sampleEmbroideryParams),
    db.query(knitProductionSql, knitProductionParams),
    db.query(knitQcSql, knitQcParams),
    db.query(designWorkflowSql, designWorkflowParams),
    db.query(recutSql, recutParams),
    db.query(workOrdersSql, workOrdersParams),
  ]);

  return NextResponse.json({
    q,
    start,
    end,
    all: showAll,
    limit,
    sections: [
      { key: "daily", title: "Daily Production", count: dailyRes.rows.length, rows: dailyRes.rows },
      { key: "qc", title: "QC Daily Production", count: qcRes.rows.length, rows: qcRes.rows },
      { key: "emblem", title: "Emblem Production", count: emblemRes.rows.length, rows: emblemRes.rows },
      { key: "laser", title: "Laser Production", count: laserRes.rows.length, rows: laserRes.rows },
      {
        key: "sampleEmbroidery",
        title: "Sample Embroidery",
        count: sampleEmbroideryRes.rows.length,
        rows: sampleEmbroideryRes.rows,
      },
      {
        key: "knitProduction",
        title: "Knit Production",
        count: knitProductionRes.rows.length,
        rows: knitProductionRes.rows,
      },
      {
        key: "knitQc",
        title: "Knit QC",
        count: knitQcRes.rows.length,
        rows: knitQcRes.rows,
      },
      {
        key: "designWorkflow",
        title: "Design Workflow",
        count: designWorkflowRes.rows.length,
        rows: designWorkflowRes.rows,
      },
      { key: "recut", title: "Recut Requests", count: recutRes.rows.length, rows: recutRes.rows },
      { key: "workOrders", title: "CMMS Work Orders", count: workOrdersRes.rows.length, rows: workOrdersRes.rows },
    ],
  });
}