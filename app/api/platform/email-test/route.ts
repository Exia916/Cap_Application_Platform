import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  sendPlatformEmail,
  verifyPlatformEmailConnection,
} from "@/lib/services/platformEmailService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireAdmin(req: NextRequest) {
  const auth = getAuthFromRequest(req);

  if (!auth) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  if (String(auth.role || "").toUpperCase() !== "ADMIN") {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, auth };
}

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

export async function GET(req: NextRequest) {
  const access = requireAdmin(req);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const result = await verifyPlatformEmailConnection();

    return NextResponse.json({
      ok: result.ok,
      message: result.message,
    });
  } catch (err: any) {
    console.error("GET /api/admin/platform/email-test failed:", err);

    return NextResponse.json(
      {
        ok: false,
        error:
          process.env.NODE_ENV === "production"
            ? "Failed to verify SMTP connection."
            : err?.message || "Failed to verify SMTP connection.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const access = requireAdmin(req);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const to = cleanString(body.to);
  const subject = cleanString(body.subject) || "CAP Email Test";
  const message =
    cleanString(body.message) ||
    "This is a test email from the Cap Applications Platform.";

  if (!to) {
    return NextResponse.json({ error: "Recipient email is required." }, { status: 400 });
  }

  try {
    const sent = await sendPlatformEmail({
      to,
      subject,
      text: [
        message,
        "",
        "—",
        "Cap Applications Platform",
        `Sent by: ${access.auth.name || access.auth.username}`,
      ].join("\n"),
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #111111; line-height: 1.45;">
          <h2 style="margin: 0 0 12px 0;">CAP Email Test</h2>
          <p>${message.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</p>
          <hr style="border: 0; border-top: 1px solid #d8d1c3; margin: 18px 0;" />
          <div style="font-size: 12px; color: #6b7280;">
            <div>Cap Applications Platform</div>
            <div>Sent by: ${(access.auth.name || access.auth.username || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</div>
          </div>
        </div>
      `,
    });

    return NextResponse.json({
      ok: true,
      sent,
    });
  } catch (err: any) {
    console.error("POST /api/admin/platform/email-test failed:", err);

    return NextResponse.json(
      {
        ok: false,
        error:
          process.env.NODE_ENV === "production"
            ? "Failed to send test email."
            : err?.message || "Failed to send test email.",
      },
      { status: 500 }
    );
  }
}