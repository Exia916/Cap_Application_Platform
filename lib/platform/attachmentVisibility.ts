export type AttachmentVisibility = "standard" | "os_secure";

const OS_SECURE_ATTACHMENT_ROLES = new Set([
  "ADMIN",
  "MANAGER",
  "SUPERVISOR",
  "OVERSEAS CUSTOMER SERVICE",
]);

function cleanText(v: unknown): string {
  return String(v ?? "").trim();
}

export function normalizeAttachmentVisibility(value: unknown): AttachmentVisibility {
  return cleanText(value).toLowerCase() === "os_secure" ? "os_secure" : "standard";
}

export function normalizeRole(role: unknown): string {
  return cleanText(role).toUpperCase();
}

export function canManageOsSecureAttachments(role: unknown): boolean {
  return OS_SECURE_ATTACHMENT_ROLES.has(normalizeRole(role));
}

export function isOsSecureAttachmentEntity(entityType: unknown): boolean {
  return cleanText(entityType) === "design_workflow";
}

export function isOsSecureVisibility(visibility: unknown): boolean {
  return normalizeAttachmentVisibility(visibility) === "os_secure";
}