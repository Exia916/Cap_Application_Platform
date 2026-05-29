import { db } from "@/lib/db";
import {
  isPlatformEmailEnabled,
  sendPlatformEmail,
} from "@/lib/services/platformEmailService";

type PendingEmailDeliveryRow = {
  deliveryId: string;
  notificationEventId: string;

  eventType: string;
  module: string | null;
  entityType: string | null;
  entityId: string | null;

  title: string;
  message: string | null;
  priority: string;
  payload: Record<string, any> | null;

  recipientUserId: string | null;
  recipientEmail: string | null;
  recipientKind: string;
  recipientLabel: string | null;

  attemptCount: number;
  maxAttempts: number;

  notificationRuleId: string | null;
  ccStaticEmails: string[];
  bccStaticEmails: string[];
};

export type ProcessPendingEmailInput = {
  limit?: number | null;
  dryRun?: boolean;
};

export type ProcessPendingEmailResult = {
  emailEnabled: boolean;
  dryRun: boolean;
  limit: number;

  selected: number;
  sent: number;
  failed: number;
  skipped: number;
  wouldSend: number;

  errors: Array<{
    deliveryId: string;
    recipientEmail: string | null;
    message: string;
  }>;

  details: Array<{
    deliveryId: string;
    recipientEmail: string | null;
    subject: string;
    action: "sent" | "failed" | "skipped" | "would_send";
    message?: string;
  }>;
};

const PROCESSOR_LOCK_KEY = "cap.platform.notifications.email.process_pending";

function normalizeLimit(value: unknown, fallback = 25, max = 100): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.trunc(n), max);
}

function cleanEmail(value: unknown): string | null {
  const email = String(value ?? "").trim();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function htmlEscape(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nl2br(value: string): string {
  return htmlEscape(value).replace(/\r?\n/g, "<br />");
}

function buildRecordUrl(row: PendingEmailDeliveryRow): string | null {
  const base =
    String(process.env.CAP_APP_BASE_URL ?? "").trim() ||
    String(process.env.NEXT_PUBLIC_APP_URL ?? "").trim();

  if (!base) return null;

  if (row.entityType === "design_workflow_request" && row.entityId) {
    return `${base.replace(/\/+$/, "")}/design-workflow/${encodeURIComponent(row.entityId)}`;
  }

  if (row.entityType === "platform_task" && row.entityId) {
    return `${base.replace(/\/+$/, "")}/platform/tasks/${encodeURIComponent(row.entityId)}`;
  }

  return null;
}

function buildTextBody(row: PendingEmailDeliveryRow): string {
  const parts: string[] = [];

  if (row.message) {
    parts.push(row.message);
  }

  const recordUrl = buildRecordUrl(row);
  if (recordUrl) {
    parts.push(`Open in CAP: ${recordUrl}`);
  }

  parts.push("");
  parts.push("—");
  parts.push("Cap Applications Platform");

  return parts.join("\n");
}

function buildHtmlBody(row: PendingEmailDeliveryRow): string {
  const recordUrl = buildRecordUrl(row);

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #111111; line-height: 1.45;">
      <h2 style="margin: 0 0 12px 0; font-size: 18px;">${htmlEscape(row.title)}</h2>

      ${
        row.message
          ? `<div style="margin-bottom: 16px;">${nl2br(row.message)}</div>`
          : ""
      }

      ${
        recordUrl
          ? `<p style="margin: 16px 0;"><a href="${htmlEscape(recordUrl)}">Open in CAP</a></p>`
          : ""
      }

      <hr style="border: 0; border-top: 1px solid #d8d1c3; margin: 18px 0;" />

      <div style="font-size: 12px; color: #6b7280;">
        <div>Cap Applications Platform</div>
        <div>Event: ${htmlEscape(row.eventType)}</div>
      </div>
    </div>
  `;
}

async function acquireLock(): Promise<boolean> {
  const { rows } = await db.query<{ locked: boolean }>(
    `SELECT pg_try_advisory_lock(hashtext($1)::bigint) AS locked`,
    [PROCESSOR_LOCK_KEY]
  );

  return !!rows[0]?.locked;
}

async function releaseLock(): Promise<void> {
  await db.query(`SELECT pg_advisory_unlock(hashtext($1)::bigint)`, [
    PROCESSOR_LOCK_KEY,
  ]);
}

async function listPendingEmailDeliveries(limit: number): Promise<PendingEmailDeliveryRow[]> {
  const { rows } = await db.query<PendingEmailDeliveryRow>(
    `
    SELECT
      d.id::text AS "deliveryId",
      d.notification_event_id::text AS "notificationEventId",

      e.event_type AS "eventType",
      e.module,
      e.entity_type AS "entityType",
      e.entity_id AS "entityId",

      e.title,
      e.message,
      e.priority,
      e.payload,

      d.recipient_user_id::text AS "recipientUserId",
      d.recipient_email AS "recipientEmail",
      COALESCE(d.recipient_kind, 'user') AS "recipientKind",
      d.recipient_label AS "recipientLabel",

      COALESCE(d.attempt_count, 0)::int AS "attemptCount",
      COALESCE(d.max_attempts, 3)::int AS "maxAttempts",

      e.notification_rule_id::text AS "notificationRuleId",
      COALESCE(r.cc_static_emails, ARRAY[]::text[]) AS "ccStaticEmails",
      COALESCE(r.bcc_static_emails, ARRAY[]::text[]) AS "bccStaticEmails"
    FROM public.notification_deliveries d
    INNER JOIN public.notification_events e
      ON e.id = d.notification_event_id
    LEFT JOIN public.platform_notification_rules r
      ON r.id = e.notification_rule_id
    WHERE d.channel = 'email'
      AND d.status = 'pending'
      AND COALESCE(d.attempt_count, 0) < COALESCE(d.max_attempts, 3)
      AND (
        d.next_attempt_at IS NULL
        OR d.next_attempt_at <= NOW()
      )
    ORDER BY d.created_at ASC, d.id ASC
    LIMIT $1
    `,
    [limit]
  );

  return rows;
}

async function markDeliverySent(input: {
  deliveryId: string;
}) {
  await db.query(
    `
    UPDATE public.notification_deliveries
    SET
      status = 'sent',
      attempted_at = NOW(),
      delivered_at = NOW(),
      attempt_count = COALESCE(attempt_count, 0) + 1,
      next_attempt_at = NULL,
      error_message = NULL,
      skipped_reason = NULL,
      updated_at = NOW()
    WHERE id = $1::uuid
    `,
    [input.deliveryId]
  );
}

async function markDeliverySkipped(input: {
  deliveryId: string;
  reason: string;
}) {
  await db.query(
    `
    UPDATE public.notification_deliveries
    SET
      status = 'skipped',
      attempted_at = NOW(),
      delivered_at = NULL,
      error_message = NULL,
      skipped_reason = $2,
      updated_at = NOW()
    WHERE id = $1::uuid
    `,
    [input.deliveryId, input.reason]
  );
}

async function markDeliveryFailed(input: {
  deliveryId: string;
  errorMessage: string;
}) {
  await db.query(
    `
    UPDATE public.notification_deliveries
    SET
      status =
        CASE
          WHEN COALESCE(attempt_count, 0) + 1 >= COALESCE(max_attempts, 3)
          THEN 'failed'
          ELSE 'pending'
        END,
      attempted_at = NOW(),
      delivered_at = NULL,
      attempt_count = COALESCE(attempt_count, 0) + 1,
      next_attempt_at =
        CASE
          WHEN COALESCE(attempt_count, 0) + 1 >= COALESCE(max_attempts, 3)
          THEN NULL
          ELSE NOW() + (
            LEAST(60, POWER(2, COALESCE(attempt_count, 0) + 1))::int * INTERVAL '1 minute'
          )
        END,
      error_message = $2,
      updated_at = NOW()
    WHERE id = $1::uuid
    `,
    [input.deliveryId, input.errorMessage]
  );
}

export async function processPendingEmailNotifications(
  input: ProcessPendingEmailInput = {}
): Promise<ProcessPendingEmailResult> {
  const limit = normalizeLimit(input.limit);
  const dryRun = input.dryRun === true;
  const emailEnabled = isPlatformEmailEnabled();

  const result: ProcessPendingEmailResult = {
    emailEnabled,
    dryRun,
    limit,

    selected: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    wouldSend: 0,

    errors: [],
    details: [],
  };

  if (!emailEnabled && !dryRun) {
    return result;
  }

  const locked = await acquireLock();
  if (!locked) {
    return result;
  }

  try {
    const rows = await listPendingEmailDeliveries(limit);
    result.selected = rows.length;

    for (const row of rows) {
      const recipientEmail = cleanEmail(row.recipientEmail);

      if (!recipientEmail) {
        const reason = "Delivery does not have a valid recipient email address.";

        if (!dryRun) {
          await markDeliverySkipped({
            deliveryId: row.deliveryId,
            reason,
          });
        }

        result.skipped += 1;
        result.details.push({
          deliveryId: row.deliveryId,
          recipientEmail: row.recipientEmail,
          subject: row.title,
          action: "skipped",
          message: reason,
        });
        continue;
      }

      if (dryRun) {
        result.wouldSend += 1;
        result.details.push({
          deliveryId: row.deliveryId,
          recipientEmail,
          subject: row.title,
          action: "would_send",
          message: "Dry run only. Email was not sent.",
        });
        continue;
      }

      try {
        const sent = await sendPlatformEmail({
          to: recipientEmail,
          cc: row.ccStaticEmails || [],
          bcc: row.bccStaticEmails || [],
          subject: row.title,
          text: buildTextBody(row),
          html: buildHtmlBody(row),
        });

        await markDeliverySent({
          deliveryId: row.deliveryId,
        });
        result.sent += 1;
        result.details.push({
          deliveryId: row.deliveryId,
          recipientEmail,
          subject: row.title,
          action: "sent",
          message: sent.response || sent.messageId || "Email sent.",
        });
      } catch (err: any) {
        const message = err?.message || "Email send failed.";

        await markDeliveryFailed({
          deliveryId: row.deliveryId,
          errorMessage: message,
        });

        result.failed += 1;
        result.errors.push({
          deliveryId: row.deliveryId,
          recipientEmail,
          message,
        });

        result.details.push({
          deliveryId: row.deliveryId,
          recipientEmail,
          subject: row.title,
          action: "failed",
          message,
        });
      }
    }

    return result;
  } finally {
    try {
      await releaseLock();
    } catch {
      // ignore unlock errors so the processor response can still return
    }
  }
}