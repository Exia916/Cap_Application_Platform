import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getSampleEmbroideryEntryById,
  updateSampleEmbroideryEntry,
  updateSampleEmbroideryEntryOwnedByUser,
} from "@/lib/repositories/sampleEmbroideryRepo";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = verifyJwt(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    const id = String(body.id ?? "").trim();
    const salesOrderRaw = String(body.salesOrder ?? "").trim();
    const detailCountRaw = String(body.detailCount ?? "").trim();
    const quantityRaw = String(body.quantity ?? "").trim();
    const notes = String(body.notes ?? "").trim() || null;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
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

    const before = await getSampleEmbroideryEntryById(id);
    if (!before) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const userRes = await db.query<{ name: string; employee_number: number | null }>(
      `
      SELECT name, employee_number
      FROM public.users
      WHERE username = $1
      LIMIT 1
      `,
      [payload.username]
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

    const isAdmin = String(payload.role || "").toUpperCase() === "ADMIN";

    await db.query("BEGIN");

    if (isAdmin) {
      await updateSampleEmbroideryEntry({
        id,
        salesOrder,
        detailCount,
        quantity,
        notes,
      });
    } else {
      const updated = await updateSampleEmbroideryEntryOwnedByUser({
        id,
        salesOrder,
        detailCount,
        quantity,
        notes,
        name: user.name,
        employeeNumber: user.employee_number,
      });

      if (updated === 0) {
        await db.query("ROLLBACK");
        return NextResponse.json(
          { error: "Entry not found (or not owned by current user)" },
          { status: 404 }
        );
      }
    }

    const changes: Array<{
      fieldName: string;
      previousValue: unknown;
      newValue: unknown;
      message: string;
    }> = [];

    if ((before.salesOrder ?? null) !== String(salesOrder)) {
      changes.push({
        fieldName: "salesOrder",
        previousValue: before.salesOrder,
        newValue: String(salesOrder),
        message: "Updated sales order",
      });
    }

    if ((before.detailCount ?? null) !== detailCount) {
      changes.push({
        fieldName: "detailCount",
        previousValue: before.detailCount,
        newValue: detailCount,
        message: "Updated detail count",
      });
    }

    if ((before.quantity ?? null) !== quantity) {
      changes.push({
        fieldName: "quantity",
        previousValue: before.quantity,
        newValue: quantity,
        message: "Updated quantity",
      });
    }

    if ((before.notes ?? null) !== (notes ?? null)) {
      changes.push({
        fieldName: "notes",
        previousValue: before.notes,
        newValue: notes,
        message: "Updated notes",
      });
    }

    if (changes.length === 0) {
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
          sales_order
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
        [
          "sample_embroidery_entry",
          id,
          "update",
          "Saved sample embroidery entry with no field changes",
          "production",
          payload.username ?? null,
          user.name,
          user.employee_number,
          salesOrder,
        ]
      );
    } else {
      for (const c of changes) {
        await db.query(
          `
          INSERT INTO public.activity_history (
            entity_type,
            entity_id,
            event_type,
            field_name,
            previous_value,
            new_value,
            message,
            module,
            user_id,
            user_name,
            employee_number,
            sales_order
          )
          VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11,$12)
          `,
          [
            "sample_embroidery_entry",
            id,
            "update",
            c.fieldName,
            JSON.stringify(c.previousValue),
            JSON.stringify(c.newValue),
            c.message,
            "production",
            payload.username ?? null,
            user.name,
            user.employee_number,
            salesOrder,
          ]
        );
      }
    }

    await db.query("COMMIT");

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    try {
      await db.query("ROLLBACK");
    } catch {}
    console.error("sample-embroidery update POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}