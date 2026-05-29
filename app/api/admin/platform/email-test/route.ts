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

function maskValue(value: string | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  if (text.length <= 4) return "****";

  return `${text.slice(0, 2)}***${text.slice(-2)}`;
}

function getEmailEnvStatus() {
  return {
    CAP_EMAIL_NOTIFICATIONS_ENABLED:
      String(process.env.CAP_EMAIL_NOTIFICATIONS_ENABLED ?? "").trim() || "(not set)",
    CAP_EMAIL_FROM_NAME:
      String(process.env.CAP_EMAIL_FROM_NAME ?? "").trim() || "(not set)",
    CAP_EMAIL_FROM_ADDRESS:
      String(process.env.CAP_EMAIL_FROM_ADDRESS ?? "").trim() || "(not set)",
    CAP_EMAIL_SMTP_HOST:
      String(process.env.CAP_EMAIL_SMTP_HOST ?? "").trim() || "(not set)",
    CAP_EMAIL_SMTP_PORT:
      String(process.env.CAP_EMAIL_SMTP_PORT ?? "").trim() || "(not set)",
    CAP_EMAIL_SMTP_SECURE:
      String(process.env.CAP_EMAIL_SMTP_SECURE ?? "").trim() || "(not set)",
    CAP_EMAIL_SMTP_REQUIRE_TLS:
      String(process.env.CAP_EMAIL_SMTP_REQUIRE_TLS ?? "").trim() || "(not set)",
    CAP_EMAIL_SMTP_USER: maskValue(process.env.CAP_EMAIL_SMTP_USER),
    CAP_EMAIL_SMTP_PASS: process.env.CAP_EMAIL_SMTP_PASS ? "(set)" : "(not set)",
  };
}

function htmlEscape(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function GET(req: NextRequest) {
  const access = requireAdmin(req);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const result = await verifyPlatformEmailConnection();

    return NextResponse.json(
      {
        ok: result.ok,
        message: result.message,
        env: getEmailEnvStatus(),
      },
      { status: result.ok ? 200 : 500 }
    );
  } catch (err: any) {
    console.error("GET /api/admin/platform/email-test failed:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Failed to verify SMTP connection.",
        env: getEmailEnvStatus(),
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
          <p>${htmlEscape(message)}</p>
          <hr style="border: 0; border-top: 1px solid #d8d1c3; margin: 18px 0;" />
          <div style="font-size: 12px; color: #6b7280;">
            <div>Cap Applications Platform</div>
            <div>Sent by: ${htmlEscape(access.auth.name || access.auth.username || "")}</div>
          </div>
        </div>
      `,
    });

    return NextResponse.json({
      ok: true,
      sent,
      env: getEmailEnvStatus(),
    });
  } catch (err: any) {
    console.error("POST /api/admin/platform/email-test failed:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Failed to send test email.",
        env: getEmailEnvStatus(),
      },
      { status: 500 }
    );
  }
}