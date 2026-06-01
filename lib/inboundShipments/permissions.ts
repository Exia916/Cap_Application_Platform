// lib/inboundShipments/permissions.ts

const ALLOWED_ROLES = new Set([
  "ADMIN",
  "MANAGER",
  "PURCHASING",
  "OVERSEAS CUSTOMER SERVICE",
]);

export function normalizeInboundShipmentRole(role: string | null | undefined): string {
  return String(role || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function canAccessInboundShipments(role: string | null | undefined) {
  return ALLOWED_ROLES.has(normalizeInboundShipmentRole(role));
}

export function canCreateInboundShipment(role: string | null | undefined) {
  return canAccessInboundShipments(role);
}

export function canEditInboundShipment(role: string | null | undefined) {
  return canAccessInboundShipments(role);
}

export function canVoidInboundShipment(role: string | null | undefined) {
  return canAccessInboundShipments(role);
}

export function canUnvoidInboundShipment(role: string | null | undefined) {
  return normalizeInboundShipmentRole(role) === "ADMIN";
}