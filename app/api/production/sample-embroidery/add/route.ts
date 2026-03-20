import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { db } from "@/lib/db";
import { addSampleEmbroideryEntry } from "@/lib/repositories/sampleEmbroideryRepo";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = verifyJwt(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    const salesOrderRaw = String(body.salesOrder ?? "").trim();
    const detailCountRaw = String(body.detailCount ?? "").trim();
    const quantityRaw = String(body.quantity ?? "").trim();
    const notes = String(body.notes ?? "").trim() || null;

    if (!salesOrderRaw) {
      return NextResponse.json({ error: "Sales Order is required" }, { status: 400 });
    }

    if (!/^\d{7}$/.test(salesOrderRaw)) {
      return NextResponse.json(
        { error: "Sales Order must be exactly 7 digits" },
        { status: 400 }
      );
    }

    if (!/^\d+$/.test(detailCountRaw)) {
      return NextResponse.json(
        { error: "Number of Details must be a whole number" },
        { status: 400 }
      );
    }

    if (!/^\d+$/.test(quantityRaw)) {
      return NextResponse.json(
        { error: "Quantity must be a whole number" },
        { status: 400 }
      );
    }

    const salesOrder = Number(salesOrderRaw);
    const detailCount = Number(detailCountRaw);
    const quantity = Number(quantityRaw);

    const username = String(payload.username ?? "").trim();
    if (!username) {
      return NextResponse.json({ error: "Authenticated username not found" }, { status: 400 });
    }

    const userRes = await db.query<{ name: string; employee_number: number | null }>(
      `
      SELECT name, employee_number
      FROM public.users
      WHERE username = $1
      LIMIT 1
      `,
      [username]
    );

    if (!userRes.rows.length) {
      return NextResponse.json({ error: "User not found" }, { status: 400 });
    }

    const user = userRes.rows[0];
    if (user.employee_number == null) {
      return NextResponse.json(
        { error: "User employee number is missing" },
        { status: 400 }
      );
    }

    await db.query("BEGIN");

    const result = await addSampleEmbroideryEntry({
      name: user.name,
      employeeNumber: user.employee_number,
      salesOrder,
      detailCount,
      quantity,
      notes,
    });

    await db.query(
      `
      INSERT INTO public.activity_history (
        entity_type,
        entity_id,
        event_type,
        message,
        module,
        user_id,
        user_name,
        employee_number,
        sales_order,
        new_value
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
      `,
      [
        "sample_embroidery_entry",
        result.id,
        "create",
        "Created sample embroidery entry",
        "production",
        payload.username ?? null,
        user.name,
        user.employee_number,
        salesOrder,
        JSON.stringify({
          salesOrder,
          detailCount,
          quantity,
          notes,
        }),
      ]
    );

    await db.query("COMMIT");

    return NextResponse.json({ ok: true, id: result.id });
  } catch (err: any) {
    try {
      await db.query("ROLLBACK");
    } catch {}
    console.error("sample-embroidery add POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}