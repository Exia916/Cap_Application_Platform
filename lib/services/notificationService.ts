import { db } from "../db";
import type {
  NotificationChannel,
  NotificationDeliveryRow,
  NotificationEventRow,
  NotificationPriority,
} from "../repositories/notificationEventsRepo";
import {
  createNotificationDelivery,
  createNotificationEvent,
} from "../repositories/notificationEventsRepo";
import { getUserNotificationPreferences } from "../repositories/userNotificationPreferencesRepo";

export type CreateNotificationForUserInput = {
  eventType: string;
  module?: string | null;

  entityType?: string | null;
  entityId?: string | null;

  actorUserId?: string | null;
  targetUserId: string;

  title: string;
  message?: string | null;
  priority?: NotificationPriority;

  payload?: unknown;

  /**
   * Defaults to in_app only.
   *
   * Future modules can pass ["in_app", "email"] once they are ready to
   * start logging email delivery attempts.
   */
  channels?: NotificationChannel[];
};

export type CreateNotificationForUserResult = {
  event: NotificationEventRow;
  deliveries: NotificationDeliveryRow[];
};

function uniqueChannels(channels?: NotificationChannel[]): NotificationChannel[] {
  const input: NotificationChannel[] = channels && channels.length ? channels : ["in_app"];
  const allowed = new Set<NotificationChannel>(["in_app", "email"]);
  const out: NotificationChannel[] = [];

  for (const channel of input) {
    if (!allowed.has(channel)) continue;
    if (!out.includes(channel)) out.push(channel);
  }

  return out.length ? out : ["in_app"];
}

function emailEngineEnabled() {
  return String(process.env.CAP_EMAIL_NOTIFICATIONS_ENABLED ?? "")
    .trim()
    .toLowerCase() === "true";
}

/**
 * Main internal entry point for future modules.
 *
 * This creates:
 * - one notification event
 * - one delivery row per requested channel
 *
 * In-app delivery is considered "sent" when preferences allow it.
 * Email delivery is not actually sent in Phase 4. It is logged as:
 * - skipped if disabled/no email/preference disabled
 * - pending if CAP_EMAIL_NOTIFICATIONS_ENABLED=true, ready for a future worker/provider
 */
export async function createNotificationForUser(
  input: CreateNotificationForUserInput
): Promise<CreateNotificationForUserResult> {
  const channels = uniqueChannels(input.channels);
  const prefs = await getUserNotificationPreferences(input.targetUserId);

  if (!prefs) {
    throw new Error("Target user was not found or is inactive.");
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const event = await createNotificationEvent(
      {
        eventType: input.eventType,
        module: input.module ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        actorUserId: input.actorUserId ?? null,
        targetUserId: input.targetUserId,
        title: input.title,
        message: input.message ?? null,
        priority: input.priority ?? "normal",
        payload: input.payload ?? {},
      },
      client
    );

    const deliveries: NotificationDeliveryRow[] = [];

    for (const channel of channels) {
      if (channel === "in_app") {
        if (prefs.inAppNotificationsEnabled) {
          deliveries.push(
            await createNotificationDelivery(
              {
                notificationEventId: event.id,
                recipientUserId: input.targetUserId,
                channel,
                status: "sent",
                deliveredAt: new Date(),
              },
              client
            )
          );
        } else {
          deliveries.push(
            await createNotificationDelivery(
              {
                notificationEventId: event.id,
                recipientUserId: input.targetUserId,
                channel,
                status: "skipped",
                errorMessage: "User has disabled in-app notifications.",
              },
              client
            )
          );
        }

        continue;
      }

      if (channel === "email") {
        if (!prefs.email) {
          deliveries.push(
            await createNotificationDelivery(
              {
                notificationEventId: event.id,
                recipientUserId: input.targetUserId,
                channel,
                status: "skipped",
                recipientEmail: null,
                errorMessage: "User does not have an email address on file.",
              },
              client
            )
          );
          continue;
        }

        if (!prefs.emailNotificationsEnabled) {
          deliveries.push(
            await createNotificationDelivery(
              {
                notificationEventId: event.id,
                recipientUserId: input.targetUserId,
                channel,
                status: "skipped",
                recipientEmail: prefs.email,
                errorMessage: "User has disabled email notifications.",
              },
              client
            )
          );
          continue;
        }

        if (!emailEngineEnabled()) {
          deliveries.push(
            await createNotificationDelivery(
              {
                notificationEventId: event.id,
                recipientUserId: input.targetUserId,
                channel,
                status: "skipped",
                recipientEmail: prefs.email,
                errorMessage:
                  "Email delivery engine is not enabled. Set CAP_EMAIL_NOTIFICATIONS_ENABLED=true when email delivery is implemented.",
              },
              client
            )
          );
          continue;
        }

        deliveries.push(
          await createNotificationDelivery(
            {
              notificationEventId: event.id,
              recipientUserId: input.targetUserId,
              channel,
              status: "pending",
              recipientEmail: prefs.email,
            },
            client
          )
        );
      }
    }

    await client.query("COMMIT");

    return {
      event,
      deliveries,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}