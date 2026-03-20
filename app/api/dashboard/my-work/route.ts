import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type ActivityRow = {
  source_key: string;
  title: string;
  href: string;
  created_at: string;
};

type SourceDef = {
  tableName: string;
  title: string;
  href: string;
  sourceKey: string;
};

const SOURCES: SourceDef[] = [
  {
    tableName: "production_entries",
    title: "Daily Production",
    href: "/daily-production",
    sourceKey: "daily-production",
  },
  {
    tableName: "qc_daily_entries",
    title: "QC Daily",
    href: "/qc-daily-production",
    sourceKey: "qc-daily",
  },
  {
    tableName: "emblem_entries",
    title: "Emblem",
    href: "/emblem-production",
    sourceKey: "emblem",
  },
  {
    tableName: "laser_entries",
    title: "Laser",
    href: "/laser-production",
    sourceKey: "laser",
  },
  {
    tableName: "recut_requests",
    title: "Recuts",
    href: "/recuts",
    sourceKey: "recuts",
  },
  {
    tableName: "sample_embroidery",
    title: "Sample Embroidery",
    href: "/production/sample-embroidery",
    sourceKey: "sample-embroidery",
  },
  {
    tableName: "knit_production_submissions",
    title: "Knit Production",
    href: "/knit-production",
    sourceKey: "knit-production",
  },
  {
    tableName: "knit_qc_submissions",
    title: "Knit QC",
    href: "/knit-qc",
    sourceKey: "knit-qc",
  },
];

async function tableExists(tableName: string): Promise<boolean> {
  const sql = `
    SELECT to_regclass($1) IS NOT NULL AS exists
  `;

  const result = await db.query<{ exists: boolean }>(sql, [tableName]);
  return !!result.rows[0]?.exists;
}

async function fetchRecentForSource(
  source: SourceDef,
  username: string,
  limitPerSource: number
): Promise<ActivityRow[]> {
  const exists = await tableExists(source.tableName);
  if (!exists) return [];

  const sql = `
    SELECT
      $2::text AS source_key,
      $3::text AS title,
      $4::text AS href,
      created_at
    FROM ${source.tableName}
    WHERE LOWER(COALESCE(created_by, '')) = LOWER($1)
      AND COALESCE(is_voided, false) = false
    ORDER BY created_at DESC
    LIMIT ${limitPerSource}
  `;

  const result = await db.query<ActivityRow>(sql, [
    username,
    source.sourceKey,
    source.title,
    source.href,
  ]);

  return result.rows;
}

export async function GET(req: NextRequest) {
  try {
    const username = req.nextUrl.searchParams.get("username")?.trim();
    const limit = Math.max(
      1,
      Math.min(12, Number(req.nextUrl.searchParams.get("limit") || "6"))
    );

    if (!username) {
      return NextResponse.json(
        { error: "username is required" },
        { status: 400 }
      );
    }

    const perSource = 3;

    const chunks = await Promise.all(
      SOURCES.map((source) => fetchRecentForSource(source, username, perSource))
    );

    const items = chunks
      .flat()
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, limit)
      .map((item, index) => ({
        id: `${item.source_key}-${index}-${item.created_at}`,
        sourceKey: item.source_key,
        title: item.title,
        href: item.href,
        createdAt: item.created_at,
      }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("dashboard my-work GET failed", error);
    return NextResponse.json(
      { error: "Failed to load dashboard recent activity" },
      { status: 500 }
    );
  }
}