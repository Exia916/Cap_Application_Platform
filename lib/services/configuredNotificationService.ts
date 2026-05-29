import {
  createNotificationForUser,
  type CreateNotificationForUserInput,
  type CreateNotificationForUserResult,
} from "@/lib/services/notificationService";
import {
  getNotificationDefinitionByEventType,
} from "@/lib/repositories/notificationDefinitionsRepo";
import type {
  NotificationChannel,
  NotificationPriority,
} from "@/lib/repositories/notificationEventsRepo";

type TemplateContext = Record<string, unknown>;

export type CreateConfiguredNotificationInput =
  Omit<CreateNotificationForUserInput, "title" | "message" | "priority" | "channels"> & {
    fallbackTitle: string;
    fallbackMessage?: string | null;
    fallbackPriority?: NotificationPriority;
    fallbackChannels?: NotificationChannel[];
    templateContext?: TemplateContext;
  };

export type CreateConfiguredNotificationResult =
  | CreateNotificationForUserResult
  | {
      skipped: true;
      reason: string;
    };

function valueForTemplate(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function renderTemplate(template: string | null | undefined, context: TemplateContext): string | null {
  if (!template) return null;

  return String(template).replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key) => {
    return valueForTemplate(context[key] ?? "");
  });
}

export async function createConfiguredNotificationForUser(
  input: CreateConfiguredNotificationInput
): Promise<CreateConfiguredNotificationResult> {
  const definition = await getNotificationDefinitionByEventType(input.eventType);

  if (definition && !definition.isActive) {
    return {
      skipped: true,
      reason: `Notification definition ${input.eventType} is inactive.`,
    };
  }

  const context = input.templateContext ?? {};

  const title =
    renderTemplate(definition?.titleTemplate, context) ||
    input.fallbackTitle;

  const message =
    renderTemplate(definition?.messageTemplate, context) ??
    input.fallbackMessage ??
    null;

  const priority =
    definition?.defaultPriority ??
    input.fallbackPriority ??
    "normal";

  const channels: NotificationChannel[] =
    definition?.channels?.length
      ? definition.channels
      : input.fallbackChannels?.length
        ? input.fallbackChannels
        : (["in_app"] as NotificationChannel[]);

  return createNotificationForUser({
    eventType: input.eventType,
    module: input.module,
    entityType: input.entityType,
    entityId: input.entityId,
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    title,
    message,
    priority,
    payload: input.payload,
    channels,
  });
}