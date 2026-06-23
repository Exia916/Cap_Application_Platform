import {
  EXTERNAL_MODULE_KEYS,
  EXTERNAL_PARTNER_TYPES,
  type ExternalModuleKey,
} from "./constants";

export function normalizeExternalValue(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/[_-]+/g, "_")
    .replace(/\s+/g, "_")
    .toUpperCase();
}

export function isWorkflowDesignPartnerType(value: unknown): boolean {
  return normalizeExternalValue(value) === EXTERNAL_PARTNER_TYPES.WORKFLOW_DESIGN;
}

export function isWorkflowDigitizingPartnerType(value: unknown): boolean {
  return (
    normalizeExternalValue(value) === EXTERNAL_PARTNER_TYPES.WORKFLOW_DIGITIZING
  );
}

export type ExternalModuleAccessLike = {
  moduleKey?: string | null;
  canView?: boolean | null;
  canAssignSelf?: boolean | null;
  canUpload?: boolean | null;
  canDownload?: boolean | null;
  canNote?: boolean | null;
  canComplete?: boolean | null;
  isActive?: boolean | null;
};

export function hasExternalModuleAccess(
  modules: ExternalModuleAccessLike[] | null | undefined,
  moduleKey: ExternalModuleKey,
  capability:
    | "canView"
    | "canAssignSelf"
    | "canUpload"
    | "canDownload"
    | "canNote"
    | "canComplete" = "canView",
): boolean {
  return !!modules?.some(
    (module) =>
      module.isActive !== false &&
      module.moduleKey === moduleKey &&
      module[capability] === true,
  );
}

export function canAccessExternalWorkflow(
  modules: ExternalModuleAccessLike[] | null | undefined,
): boolean {
  return hasExternalModuleAccess(
    modules,
    EXTERNAL_MODULE_KEYS.DESIGN_WORKFLOW,
    "canView",
  );
}