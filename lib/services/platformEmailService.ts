import nodemailer from "nodemailer";

export type PlatformEmailAddress = string | string[];

export type SendPlatformEmailInput = {
  to: PlatformEmailAddress;
  cc?: PlatformEmailAddress | null;
  bcc?: PlatformEmailAddress | null;
  subject: string;
  text?: string | null;
  html?: string | null;
  replyTo?: string | null;
};

export type SendPlatformEmailResult = {
  messageId: string | null;
  accepted: string[];
  rejected: string[];
  response: string | null;
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  requireTls: boolean;
  user: string | null;
  pass: string | null;
  fromName: string;
  fromAddress: string;
};

function boolEnv(name: string, fallback = false): boolean {
  const raw = String(process.env[name] ?? "").trim().toLowerCase();
  if (!raw) return fallback;

  return ["1", "true", "yes", "y"].includes(raw);
}

function intEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.trunc(n);
}

function requiredEnv(name: string): string {
  const value = String(process.env[name] ?? "").trim();
  if (!value) {
    throw new Error(`Missing required email environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | null {
  const value = String(process.env[name] ?? "").trim();
  return value ? value : null;
}

function getSmtpConfig(): SmtpConfig {
  return {
    host: requiredEnv("CAP_EMAIL_SMTP_HOST"),
    port: intEnv("CAP_EMAIL_SMTP_PORT", 587),
    secure: boolEnv("CAP_EMAIL_SMTP_SECURE", false),
    requireTls: boolEnv("CAP_EMAIL_SMTP_REQUIRE_TLS", true),
    user: optionalEnv("CAP_EMAIL_SMTP_USER"),
    pass: optionalEnv("CAP_EMAIL_SMTP_PASS"),
    fromName: String(process.env.CAP_EMAIL_FROM_NAME ?? "Cap Applications Platform").trim(),
    fromAddress: requiredEnv("CAP_EMAIL_FROM_ADDRESS"),
  };
}

function normalizeAddressList(value: PlatformEmailAddress | null | undefined): string[] {
  if (!value) return [];

  const raw = Array.isArray(value) ? value : [value];

  const out: string[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    const parts = String(item ?? "")
      .split(/[;,]+/g)
      .map((x) => x.trim())
      .filter(Boolean);

    for (const part of parts) {
      const key = part.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(part);
    }
  }

  return out;
}

function formatFrom(config: SmtpConfig): string {
  const name = config.fromName.replace(/"/g, "");
  return `"${name}" <${config.fromAddress}>`;
}

function buildTransport(config: SmtpConfig) {
  const auth =
    config.user && config.pass
      ? {
          user: config.user,
          pass: config.pass,
        }
      : undefined;

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTls,
    auth,
  });
}

export function isPlatformEmailEnabled(): boolean {
  return String(process.env.CAP_EMAIL_NOTIFICATIONS_ENABLED ?? "")
    .trim()
    .toLowerCase() === "true";
}

export async function verifyPlatformEmailConnection(): Promise<{
  ok: boolean;
  message: string;
}> {
  const config = getSmtpConfig();
  const transport = buildTransport(config);

  try {
    await transport.verify();

    return {
      ok: true,
      message: "SMTP connection verified.",
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || "SMTP connection verification failed.",
    };
  }
}

export async function sendPlatformEmail(
  input: SendPlatformEmailInput
): Promise<SendPlatformEmailResult> {
  const to = normalizeAddressList(input.to);
  const cc = normalizeAddressList(input.cc);
  const bcc = normalizeAddressList(input.bcc);

  const subject = String(input.subject ?? "").trim();
  const text = input.text == null ? "" : String(input.text);
  const html = input.html == null ? null : String(input.html);

  if (!to.length) {
    throw new Error("At least one recipient email address is required.");
  }

  if (!subject) {
    throw new Error("Email subject is required.");
  }

  if (!text.trim() && !html?.trim()) {
    throw new Error("Email body is required.");
  }

  const config = getSmtpConfig();
  const transport = buildTransport(config);

  const info = await transport.sendMail({
    from: formatFrom(config),
    to,
    cc: cc.length ? cc : undefined,
    bcc: bcc.length ? bcc : undefined,
    replyTo: input.replyTo || undefined,
    subject,
    text: text || undefined,
    html: html || undefined,
  });

  return {
    messageId: info.messageId || null,
    accepted: Array.isArray(info.accepted) ? info.accepted.map(String) : [],
    rejected: Array.isArray(info.rejected) ? info.rejected.map(String) : [],
    response: info.response || null,
  };
}