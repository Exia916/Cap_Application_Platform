import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type Resp =
  | {
      date: string;

      totalStitches: number;
      totalPieces: number;

      qcFlatInspected: number;
      qc3DInspected: number;
      qcTotalInspected: number;

      emblemSewPieces: number;
      emblemStickerPieces: number;
      emblemHeatSealPieces: number;
      emblemTotalPieces: number;

      laserTotalPieces: number;

      knitProductionSubmissionCount: number;
      knitProductionTotalQuantity: number;

      knitQcSubmissionCount: number;
      knitQcTotalInspected: number;
      knitQcTotalRejected: number;

      sampleEmbroideryEntryCount: number;
      sampleEmbroideryTotalQuantity: number;
      sampleEmbroideryTotalDetailCount: number;

      recutRequestCount: number;
      recutTotalPieces: number;
      recutDoNotPullCount: number;

      summary: {
        totalSubmissions: number;
        activeModules: number;
        inactiveModules: number;
        hasAnyActivity: boolean;
      };
    }
  | { error: string };

function isYmd(value: string | null | undefined) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "").trim());
}

function ymdChicago(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mm = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${yyyy}-${mm}-${dd}`;
}

function toNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyJwt(token);
    if (!payload) {
      return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
    }

    const employeeNumber =
      payload.employeeNumber != null ? Number(payload.employeeNumber) : null;

    if (!employeeNumber || !Number.isFinite(employeeNumber)) {
      return NextResponse.json<Resp>(
        { error: "Missing employee number in auth payload." },
        { status: 400 }
      );
    }

    const requestedDate = String(req.nextUrl.searchParams.get("date") ?? "").trim();
    const date = isYmd(requestedDate) ? requestedDate : ymdChicago(new Date());

    const [
      embroideryRes,
      qcRes,
      emblemRes,
      laserRes,
      knitProductionRes,
      knitQcRes,
      sampleEmbroideryRes,
      recutRes,
    ] = await Promise.all([
      db.query<{
        totalStitches: string | number;
        totalPieces: string | number;
        entryCount: string | number;
      }>(
        `
        SELECT
          COALESCE(SUM(COALESCE(stitches, 0) * COALESCE(pieces, 0)), 0) AS "totalStitches",
          COALESCE(SUM(COALESCE(pieces, 0)), 0) AS "totalPieces",
          COUNT(*) AS "entryCount"
        FROM public.embroidery_daily_entries
        WHERE employee_number = $1
          AND shift_date = $2::date
        `,
        [employeeNumber, date]
      ),

      db.query<{
        qcFlatInspected: string | number;
        qc3DInspected: string | number;
        qcTotalInspected: string | number;
        entryCount: string | number;
      }>(
        `
        SELECT
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(flat_or_3d, '')) = 'flat' THEN COALESCE(inspected_quantity, 0) ELSE 0 END), 0) AS "qcFlatInspected",
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(flat_or_3d, '')) = '3d' THEN COALESCE(inspected_quantity, 0) ELSE 0 END), 0) AS "qc3DInspected",
          COALESCE(SUM(COALESCE(inspected_quantity, 0)), 0) AS "qcTotalInspected",
          COUNT(*) AS "entryCount"
        FROM public.qc_daily_entries
        WHERE employee_number = $1
          AND entry_date = $2::date
        `,
        [employeeNumber, date]
      ),

      db.query<{
        emblemSewPieces: string | number;
        emblemStickerPieces: string | number;
        emblemHeatSealPieces: string | number;
        emblemTotalPieces: string | number;
        submissionCount: string | number;
      }>(
        `
        SELECT
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(l.emblem_type, '')) = 'sew' THEN COALESCE(l.pieces, 0) ELSE 0 END), 0) AS "emblemSewPieces",
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(l.emblem_type, '')) = 'sticker' THEN COALESCE(l.pieces, 0) ELSE 0 END), 0) AS "emblemStickerPieces",
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(l.emblem_type, '')) IN ('heat seal', 'heatseal') THEN COALESCE(l.pieces, 0) ELSE 0 END), 0) AS "emblemHeatSealPieces",
          COALESCE(SUM(COALESCE(l.pieces, 0)), 0) AS "emblemTotalPieces",
          COUNT(DISTINCT s.id) AS "submissionCount"
        FROM public.emblem_daily_submissions s
        LEFT JOIN public.emblem_daily_submission_lines l
          ON l.submission_id = s.id
        WHERE s.employee_number = $1
          AND s.entry_date = $2::date
        `,
        [employeeNumber, date]
      ),

      db.query<{
        laserTotalPieces: string | number;
        entryCount: string | number;
      }>(
        `
        SELECT
          COALESCE(SUM(COALESCE(pieces_cut, 0)), 0) AS "laserTotalPieces",
          COUNT(*) AS "entryCount"
        FROM public.laser_entries
        WHERE employee_number = $1
          AND entry_date = $2::date
        `,
        [employeeNumber, date]
      ),

      db.query<{
        submissionCount: string | number;
        totalQuantity: string | number;
      }>(
        `
        SELECT
          COUNT(DISTINCT s.id) AS "submissionCount",
          COALESCE(SUM(COALESCE(l.quantity, 0)), 0) AS "totalQuantity"
        FROM public.knit_production_submissions s
        LEFT JOIN public.knit_production_lines l
          ON l.submission_id = s.id
        WHERE s.employee_number = $1
          AND s.entry_date = $2::date
          AND COALESCE(s.is_voided, false) = false
        `,
        [employeeNumber, date]
      ),

      db.query<{
        submissionCount: string | number;
        totalInspected: string | number;
        totalRejected: string | number;
      }>(
        `
        SELECT
          COUNT(DISTINCT s.id) AS "submissionCount",
          COALESCE(SUM(COALESCE(l.inspected_quantity, 0)), 0) AS "totalInspected",
          COALESCE(SUM(COALESCE(l.rejected_quantity, 0)), 0) AS "totalRejected"
        FROM public.knit_qc_submissions s
        LEFT JOIN public.knit_qc_submission_lines l
          ON l.submission_id = s.id
        WHERE s.employee_number = $1
          AND s.entry_date = $2::date
          AND COALESCE(s.is_voided, false) = false
        `,
        [employeeNumber, date]
      ),

      db.query<{
        entryCount: string | number;
        totalQuantity: string | number;
        totalDetailCount: string | number;
      }>(
        `
        SELECT
          COUNT(*) AS "entryCount",
          COALESCE(SUM(COALESCE(quantity, 0)), 0) AS "totalQuantity",
          COALESCE(SUM(COALESCE(detail_count, 0)), 0) AS "totalDetailCount"
        FROM public.sample_embroidery_entries
        WHERE employee_number = $1
          AND entry_date = $2::date
        `,
        [employeeNumber, date]
      ),

      db.query<{
        requestCount: string | number;
        totalPieces: string | number;
        doNotPullCount: string | number;
      }>(
        `
        SELECT
          COUNT(*) AS "requestCount",
          COALESCE(SUM(COALESCE(pieces, 0)), 0) AS "totalPieces",
          COUNT(*) FILTER (WHERE do_not_pull = true) AS "doNotPullCount"
        FROM public.recut_requests
        WHERE requested_by_employee_number = $1
          AND requested_date = $2::date
          AND COALESCE(is_voided, false) = false
        `,
        [employeeNumber, date]
      ),
    ]);

    const embroidery = embroideryRes.rows[0] ?? {
      totalStitches: 0,
      totalPieces: 0,
      entryCount: 0,
    };

    const qc = qcRes.rows[0] ?? {
      qcFlatInspected: 0,
      qc3DInspected: 0,
      qcTotalInspected: 0,
      entryCount: 0,
    };

    const emblem = emblemRes.rows[0] ?? {
      emblemSewPieces: 0,
      emblemStickerPieces: 0,
      emblemHeatSealPieces: 0,
      emblemTotalPieces: 0,
      submissionCount: 0,
    };

    const laser = laserRes.rows[0] ?? {
      laserTotalPieces: 0,
      entryCount: 0,
    };

    const knitProduction = knitProductionRes.rows[0] ?? {
      submissionCount: 0,
      totalQuantity: 0,
    };

    const knitQc = knitQcRes.rows[0] ?? {
      submissionCount: 0,
      totalInspected: 0,
      totalRejected: 0,
    };

    const sampleEmbroidery = sampleEmbroideryRes.rows[0] ?? {
      entryCount: 0,
      totalQuantity: 0,
      totalDetailCount: 0,
    };

    const recuts = recutRes.rows[0] ?? {
      requestCount: 0,
      totalPieces: 0,
      doNotPullCount: 0,
    };

    const totalStitches = toNum(embroidery.totalStitches);
    const totalPieces = toNum(embroidery.totalPieces);

    const qcFlatInspected = toNum(qc.qcFlatInspected);
    const qc3DInspected = toNum(qc.qc3DInspected);
    const qcTotalInspected = toNum(qc.qcTotalInspected);

    const emblemSewPieces = toNum(emblem.emblemSewPieces);
    const emblemStickerPieces = toNum(emblem.emblemStickerPieces);
    const emblemHeatSealPieces = toNum(emblem.emblemHeatSealPieces);
    const emblemTotalPieces = toNum(emblem.emblemTotalPieces);

    const laserTotalPieces = toNum(laser.laserTotalPieces);

    const knitProductionSubmissionCount = toNum(knitProduction.submissionCount);
    const knitProductionTotalQuantity = toNum(knitProduction.totalQuantity);

    const knitQcSubmissionCount = toNum(knitQc.submissionCount);
    const knitQcTotalInspected = toNum(knitQc.totalInspected);
    const knitQcTotalRejected = toNum(knitQc.totalRejected);

    const sampleEmbroideryEntryCount = toNum(sampleEmbroidery.entryCount);
    const sampleEmbroideryTotalQuantity = toNum(sampleEmbroidery.totalQuantity);
    const sampleEmbroideryTotalDetailCount = toNum(sampleEmbroidery.totalDetailCount);

    const recutRequestCount = toNum(recuts.requestCount);
    const recutTotalPieces = toNum(recuts.totalPieces);
    const recutDoNotPullCount = toNum(recuts.doNotPullCount);

    const embroideryEntryCount = toNum(embroidery.entryCount);
    const qcEntryCount = toNum(qc.entryCount);
    const emblemSubmissionCount = toNum(emblem.submissionCount);
    const laserEntryCount = toNum(laser.entryCount);

    const activityFlags = [
      embroideryEntryCount > 0,
      qcEntryCount > 0,
      emblemSubmissionCount > 0,
      laserEntryCount > 0,
      knitProductionSubmissionCount > 0,
      knitQcSubmissionCount > 0,
      sampleEmbroideryEntryCount > 0,
      recutRequestCount > 0,
    ];

    const activeModules = activityFlags.filter(Boolean).length;
    const inactiveModules = activityFlags.length - activeModules;
    const hasAnyActivity = activeModules > 0;

    const totalSubmissions =
      embroideryEntryCount +
      qcEntryCount +
      emblemSubmissionCount +
      laserEntryCount +
      knitProductionSubmissionCount +
      knitQcSubmissionCount +
      sampleEmbroideryEntryCount +
      recutRequestCount;

    return NextResponse.json<Resp>({
      date,

      totalStitches,
      totalPieces,

      qcFlatInspected,
      qc3DInspected,
      qcTotalInspected,

      emblemSewPieces,
      emblemStickerPieces,
      emblemHeatSealPieces,
      emblemTotalPieces,

      laserTotalPieces,

      knitProductionSubmissionCount,
      knitProductionTotalQuantity,

      knitQcSubmissionCount,
      knitQcTotalInspected,
      knitQcTotalRejected,

      sampleEmbroideryEntryCount,
      sampleEmbroideryTotalQuantity,
      sampleEmbroideryTotalDetailCount,

      recutRequestCount,
      recutTotalPieces,
      recutDoNotPullCount,

      summary: {
        totalSubmissions,
        activeModules,
        inactiveModules,
        hasAnyActivity,
      },
    });
  } catch (err: any) {
    console.error("dashboard-metrics GET error:", err);
    return NextResponse.json<Resp>(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}