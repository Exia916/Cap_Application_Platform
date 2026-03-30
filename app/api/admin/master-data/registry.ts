// app/api/admin/master-data/registry.ts

export type MasterKey =
  | "departments"
  | "shifts"
  | "roles"
  | "emb_type_locations"
  | "emb_locations"
  | "emb_types"
  | "emb_flat_3d_options"
  | "emb_type_location_rules"
  | "leather_styles"
  | "recut_reasons"
  | "recut_requested_departments"
  | "recut_items"
  | "machines"
  | "knit_areas"
  | "work_session_areas"
  | "priorities"
  | "statuses"
  | "issue_catalog"
  | "techs"
  | "wo_types"
  | "cmms_departments"
  | "cmms_assets";

export type EditableField =
  | "code"
  | "name"
  | "label"
  | "is_active"
  | "sort_order"
  | "start_time"
  | "location"
  | "emb_type"
  | "flat_or_3d"
  | "location_code"
  | "emb_type_code"
  | "flat_or_3d_code"
  | "style_color"
  | "item_code"
  | "description"
  | "department"
  | "department_id"
  | "area_name"
  | "module_key"
  | "area_code"
  | "area_label";

export type MasterRegistryItem = {
  key: MasterKey;
  table: string;
  idCol: string;
  editable: EditableField[];
  selectCols: string[];
  orderBy: string;
  supportsInactive: boolean;
  allowDelete: boolean;
};

export const MASTER_DATA: Record<MasterKey, MasterRegistryItem> = {
  departments: {
    key: "departments",
    table: "public.departments",
    idCol: "id",
    editable: ["code", "name", "is_active", "sort_order"],
    selectCols: ["id", "code", "name", "is_active", "sort_order", "created_at", "updated_at"],
    orderBy: "sort_order ASC, name ASC",
    supportsInactive: true,
    allowDelete: false,
  },

  shifts: {
    key: "shifts",
    table: "public.shifts",
    idCol: "id",
    editable: ["code", "name", "start_time", "is_active", "sort_order"],
    selectCols: ["id", "code", "name", "start_time", "is_active", "sort_order", "created_at", "updated_at"],
    orderBy: "sort_order ASC, name ASC",
    supportsInactive: true,
    allowDelete: false,
  },

  roles: {
    key: "roles",
    table: "public.roles_lookup",
    idCol: "code",
    editable: ["code", "label", "is_active", "sort_order"],
    selectCols: ["code", "label", "is_active", "sort_order", "created_at", "updated_at"],
    orderBy: "sort_order ASC, code ASC",
    supportsInactive: true,
    allowDelete: false,
  },

  emb_type_locations: {
    key: "emb_type_locations",
    table: "public.emb_type_locations",
    idCol: "id",
    editable: ["location", "emb_type", "flat_or_3d", "is_active"],
    selectCols: ["id", "location", "emb_type", "flat_or_3d", "is_active", "created_at", "updated_at"],
    orderBy: "emb_type ASC, flat_or_3d ASC, location ASC",
    supportsInactive: true,
    allowDelete: false,
  },

  emb_locations: {
    key: "emb_locations",
    table: "public.emb_locations",
    idCol: "id",
    editable: ["code", "label", "sort_order", "is_active"],
    selectCols: ["id", "code", "label", "sort_order", "is_active", "created_at", "updated_at"],
    orderBy: "sort_order ASC, code ASC",
    supportsInactive: true,
    allowDelete: false,
  },

  emb_types: {
    key: "emb_types",
    table: "public.emb_types",
    idCol: "id",
    editable: ["code", "label", "sort_order", "is_active"],
    selectCols: ["id", "code", "label", "sort_order", "is_active", "created_at", "updated_at"],
    orderBy: "sort_order ASC, code ASC",
    supportsInactive: true,
    allowDelete: false,
  },

  emb_flat_3d_options: {
    key: "emb_flat_3d_options",
    table: "public.emb_flat_3d_options",
    idCol: "id",
    editable: ["code", "label", "sort_order", "is_active"],
    selectCols: ["id", "code", "label", "sort_order", "is_active", "created_at", "updated_at"],
    orderBy: "sort_order ASC, code ASC",
    supportsInactive: true,
    allowDelete: false,
  },

  emb_type_location_rules: {
    key: "emb_type_location_rules",
    table: "public.emb_type_location_rules",
    idCol: "id",
    editable: ["location_code", "emb_type_code", "flat_or_3d_code", "is_active"],
    selectCols: ["id", "location_code", "emb_type_code", "flat_or_3d_code", "is_active", "created_at", "updated_at"],
    orderBy: "emb_type_code ASC, flat_or_3d_code ASC, location_code ASC",
    supportsInactive: true,
    allowDelete: false,
  },

  leather_styles: {
    key: "leather_styles",
    table: "public.leather_styles",
    idCol: "id",
    editable: ["style_color", "is_active"],
    selectCols: ["id", "style_color", "is_active", "created_at", "updated_at"],
    orderBy: "style_color ASC",
    supportsInactive: true,
    allowDelete: false,
  },

  recut_reasons: {
    key: "recut_reasons",
    table: "public.recut_reasons",
    idCol: "id",
    editable: ["code", "label", "sort_order", "is_active"],
    selectCols: ["id", "code", "label", "sort_order", "is_active", "created_at", "updated_at"],
    orderBy: "sort_order ASC, code ASC",
    supportsInactive: true,
    allowDelete: false,
  },

  recut_requested_departments: {
    key: "recut_requested_departments",
    table: "public.recut_requested_departments",
    idCol: "id",
    editable: ["code", "label", "sort_order", "is_active"],
    selectCols: ["id", "code", "label", "sort_order", "is_active", "created_at", "updated_at"],
    orderBy: "sort_order ASC, code ASC",
    supportsInactive: true,
    allowDelete: false,
  },

  recut_items: {
    key: "recut_items",
    table: "public.recut_items",
    idCol: "id",
    editable: ["item_code", "description", "sort_order", "is_active"],
    selectCols: ["id", "item_code", "description", "sort_order", "is_active", "created_at", "updated_at"],
    orderBy: "sort_order ASC, item_code ASC",
    supportsInactive: true,
    allowDelete: false,
  },

  machines: {
    key: "machines",
    table: "public.machines",
    idCol: "id",
    editable: ["name", "department", "is_active"],
    selectCols: ["id", "name", "department", "is_active", "created_at", "updated_at"],
    orderBy: "department ASC, name ASC",
    supportsInactive: true,
    allowDelete: false,
  },

  knit_areas: {
    key: "knit_areas",
    table: "public.knit_area_lookup",
    idCol: "id",
    editable: ["area_name", "sort_order", "is_active"],
    selectCols: ["id", "area_name AS name", "sort_order", "is_active", "created_at", "updated_at"],
    orderBy: "sort_order ASC, area_name ASC",
    supportsInactive: true,
    allowDelete: false,
  },

  work_session_areas: {
    key: "work_session_areas",
    table: "public.production_work_area_config",
    idCol: "id",
    editable: ["module_key", "area_code", "area_label", "sort_order", "is_active"],
    selectCols: [
      "id",
      "module_key",
      "area_code",
      "area_label",
      "sort_order",
      "is_active",
      "created_at",
      "updated_at",
    ],
    orderBy: "module_key ASC, sort_order ASC, area_label ASC",
    supportsInactive: true,
    allowDelete: false,
  },

  priorities: {
    key: "priorities",
    table: "cmms.priorities",
    idCol: "id",
    editable: ["name", "is_active"],
    selectCols: ["id", "name", "is_active"],
    orderBy: "name ASC",
    supportsInactive: true,
    allowDelete: false,
  },

  statuses: {
    key: "statuses",
    table: "cmms.statuses",
    idCol: "id",
    editable: ["name", "is_active"],
    selectCols: ["id", "name", "is_active"],
    orderBy: "name ASC",
    supportsInactive: true,
    allowDelete: false,
  },

  issue_catalog: {
    key: "issue_catalog",
    table: "cmms.issue_catalog",
    idCol: "id",
    editable: ["name", "is_active"],
    selectCols: ["id", "name", "is_active"],
    orderBy: "name ASC",
    supportsInactive: true,
    allowDelete: false,
  },

  techs: {
    key: "techs",
    table: "cmms.techs",
    idCol: "id",
    editable: ["name", "is_active"],
    selectCols: ["id", "name", "is_active"],
    orderBy: "name ASC",
    supportsInactive: true,
    allowDelete: false,
  },

  wo_types: {
    key: "wo_types",
    table: "cmms.wo_types",
    idCol: "id",
    editable: ["name", "is_active"],
    selectCols: ["id", "name", "is_active"],
    orderBy: "name ASC",
    supportsInactive: true,
    allowDelete: false,
  },

  cmms_departments: {
    key: "cmms_departments",
    table: "cmms.departments",
    idCol: "id",
    editable: ["name", "is_active"],
    selectCols: ["id", "name", "is_active"],
    orderBy: "name ASC",
    supportsInactive: true,
    allowDelete: false,
  },

  cmms_assets: {
    key: "cmms_assets",
    table: "cmms.assets",
    idCol: "id",
    editable: ["name", "department_id", "is_active"],
    selectCols: [
      "a.id",
      "a.name",
      "a.department_id",
      "d.name AS department",
      "a.is_active",
    ],
    orderBy: "a.name ASC",
    supportsInactive: true,
    allowDelete: false,
  },
};

export function isMasterKey(value: string): value is MasterKey {
  return value in MASTER_DATA;
}

export function isCmmsMasterKey(value: string): value is MasterKey {
  return (
    value === "priorities" ||
    value === "statuses" ||
    value === "issue_catalog" ||
    value === "techs" ||
    value === "wo_types" ||
    value === "cmms_departments" ||
    value === "cmms_assets"
  );
}