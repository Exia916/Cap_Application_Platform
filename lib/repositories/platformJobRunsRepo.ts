import { db } from "@/lib/db";

export type PlatformJobRunStatus = "running" | "success" | "failed" | "skipped";
export type PlatformJobTriggerMode = "cron" | "admin" | "manual" | "unknown";

export type PlatformJobRunRow = {
  id: string;
  jobName: string;
  triggerMode: PlatformJobTriggerMode;
  status: PlatformJobRunStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  resultJson: Record<string, any>;
  errorMessage: string | null;
};

export async function startPlatformJobRun(input: {
  jobName: string;
  triggerMode?: PlatformJobTriggerMode;
  resultJson?: Record<string, any>;
}): Promise<string | null> {
  try {
    const { rows } = await db.query<{ id: string }>(
      `
      INSERT INTO public.platform_job_runs (
        job_name,
        trigger_mode,
        status,
        started_at,
        result_json
      )
      VALUES ($1, $2, 'running', now(), $3::jsonb)
      RETURNING id::text
      `,
      [
        input.jobName,
        input.triggerMode || "unknown",
        JSON.stringify(input.resultJson || {}),
      ]
    );

    return rows[0]?.id ?? null;
  } catch (err) {
    console.error("Failed to start platform job run:", err);
    return null;
  }
}

export async function finishPlatformJobRun(input: {
  id: string | null;
  status: Exclude<PlatformJobRunStatus, "running">;
  resultJson?: Record<string, any>;
  errorMessage?: string | null;
}) {
  if (!input.id) return;

  try {
    await db.query(
      `
      UPDATE public.platform_job_runs
      SET
        status = $2,
        finished_at = now(),
        duration_ms = GREATEST(
          0,
          FLOOR(EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::int
        ),
        result_json = COALESCE($3::jsonb, '{}'::jsonb),
        error_message = $4
      WHERE id = $1::uuid
      `,
      [
        input.id,
        input.status,
        JSON.stringify(input.resultJson || {}),
        input.errorMessage || null,
      ]
    );
  } catch (err) {
    console.error("Failed to finish platform job run:", err);
  }
}

export async function getLatestPlatformJobRuns(jobNames: string[]) {
  if (!jobNames.length) return {};

  const { rows } = await db.query<PlatformJobRunRow>(
    `
    SELECT DISTINCT ON (job_name)
      id::text AS "id",
      job_name AS "jobName",
      trigger_mode AS "triggerMode",
      status,
      started_at AS "startedAt",
      finished_at AS "finishedAt",
      duration_ms AS "durationMs",
      COALESCE(result_json, '{}'::jsonb) AS "resultJson",
      error_message AS "errorMessage"
    FROM public.platform_job_runs
    WHERE job_name = ANY($1::text[])
    ORDER BY job_name, started_at DESC
    `,
    [jobNames]
  );

  return rows.reduce<Record<string, PlatformJobRunRow>>((acc, row) => {
    acc[row.jobName] = row;
    return acc;
  }, {});
}

export async function getNotificationSystemStatus() {
  const latestJobs = await getLatestPlatformJobRuns([
    "notification_rule_evaluator",
    "notification_email_processor",
  ]);

  const countsRes = await db.query<{
    activeRules: number;
    activeEventRules: number;
    activeStatusDurationRules: number;
    activeEventTypes: number;
    pendingEmails: number;
    sentEmails24h: number;
    failedEmails: number;
    skippedEmails: number;
    oldestPendingEmailAt: string | null;
    lastEmailAttemptAt: string | null;
    lastEmailDeliveredAt: string | null;
    latestEmailError: string | null;
    ruleRuns24h: number;
    lastRuleRunAt: string | null;
  }>(
    `
    SELECT
      (
        SELECT COUNT(*)::int
        FROM public.platform_notification_rules
        WHERE is_active = true
      ) AS "activeRules",

      (
        SELECT COUNT(*)::int
        FROM public.platform_notification_rules
        WHERE is_active = true
          AND trigger_type = 'event_based'
      ) AS "activeEventRules",

      (
        SELECT COUNT(*)::int
        FROM public.platform_notification_rules
        WHERE is_active = true
          AND trigger_type = 'status_duration'
      ) AS "activeStatusDurationRules",

      (
        SELECT COUNT(*)::int
        FROM public.platform_event_types
        WHERE is_active = true
      ) AS "activeEventTypes",

      (
        SELECT COUNT(*)::int
        FROM public.notification_deliveries
        WHERE channel = 'email'
          AND status = 'pending'
      ) AS "pendingEmails",

      (
        SELECT COUNT(*)::int
        FROM public.notification_deliveries
        WHERE channel = 'email'
          AND status = 'sent'
          AND delivered_at >= now() - interval '24 hours'
      ) AS "sentEmails24h",

      (
        SELECT COUNT(*)::int
        FROM public.notification_deliveries
        WHERE channel = 'email'
          AND status = 'failed'
      ) AS "failedEmails",

      (
        SELECT COUNT(*)::int
        FROM public.notification_deliveries
        WHERE channel = 'email'
          AND status = 'skipped'
      ) AS "skippedEmails",

      (
        SELECT MIN(created_at)
        FROM public.notification_deliveries
        WHERE channel = 'email'
          AND status = 'pending'
      ) AS "oldestPendingEmailAt",

      (
        SELECT MAX(attempted_at)
        FROM public.notification_deliveries
        WHERE channel = 'email'
          AND attempted_at IS NOT NULL
      ) AS "lastEmailAttemptAt",

      (
        SELECT MAX(delivered_at)
        FROM public.notification_deliveries
        WHERE channel = 'email'
          AND delivered_at IS NOT NULL
      ) AS "lastEmailDeliveredAt",

      (
        SELECT error_message
        FROM public.notification_deliveries
        WHERE channel = 'email'
          AND error_message IS NOT NULL
          AND error_message <> ''
        ORDER BY attempted_at DESC NULLS LAST, updated_at DESC NULLS LAST
        LIMIT 1
      ) AS "latestEmailError",

      (
        SELECT COUNT(*)::int
        FROM public.platform_notification_rule_runs
        WHERE triggered_at >= now() - interval '24 hours'
      ) AS "ruleRuns24h",

      (
        SELECT MAX(triggered_at)
        FROM public.platform_notification_rule_runs
      ) AS "lastRuleRunAt"
    `
  );

  const counts = countsRes.rows[0];

  return {
    env: {
      emailEnabled:
        String(process.env.CAP_EMAIL_NOTIFICATIONS_ENABLED ?? "")
          .trim()
          .toLowerCase() === "true",
      cronSecretConfigured: !!String(process.env.CRON_SECRET ?? "").trim(),
      capCronSecretConfigured: !!String(process.env.CAP_CRON_SECRET ?? "").trim(),
      evaluatorCronExecute:
        String(process.env.CAP_NOTIFICATION_RULE_EVALUATOR_CRON_EXECUTE ?? "")
          .trim()
          .toLowerCase() === "true",
      evaluatorLimitPerRule:
        String(process.env.CAP_NOTIFICATION_RULE_EVALUATOR_LIMIT_PER_RULE ?? "").trim() ||
        null,
      appBaseUrlConfigured: !!(
        String(process.env.CAP_APP_BASE_URL ?? "").trim() ||
        String(process.env.NEXT_PUBLIC_APP_URL ?? "").trim()
      ),
      smtpHostConfigured: !!String(process.env.CAP_EMAIL_SMTP_HOST ?? "").trim(),
      smtpPort: String(process.env.CAP_EMAIL_SMTP_PORT ?? "").trim() || null,
      fromAddressConfigured: !!String(process.env.CAP_EMAIL_FROM_ADDRESS ?? "").trim(),
    },
    jobs: latestJobs,
    counts,
  };
}