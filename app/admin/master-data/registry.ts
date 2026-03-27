// app/admin/master-data/registry.ts

export const MASTER_KEYS = [
  "departments",
  "shifts",
  "roles",

  // Embroidery / shared production lookups
  "emb_locations",
  "emb_types",
  "emb_flat_3d_options",
  "emb_type_location_rules",
  "leather_styles",

  // Recut lookups
  "recut_reasons",
  "recut_requested_departments",
  "recut_items",

  // Shared production / misc
  "machines",
  "knit_areas",

  // CMMS lookups
  "priorities",
  "statuses",
  "issue_catalog",
  "techs",
  "wo_types",
  "cmms_departments",
  "cmms_assets",

  // legacy
  "emb_type_locations",
] as const;

export type MasterKey = (typeof MASTER_KEYS)[number];

export type MasterColumn = {
  key:
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
    | "department_id";
  label: string;
  type: "text" | "number" | "boolean" | "time" | "select";
  required?: boolean;
  widthClass?: string;
  optionsSource?: "cmms_departments";
  displayKey?: string;
};

export type MasterUiConfig = {
  key: MasterKey;
  title: string;
  description?: string;
  columns: MasterColumn[];
};

export const MASTER_UI: Record<MasterKey, MasterUiConfig> = {
  departments: {
    key: "departments",
    title: "Departments",
    description: "Departments used across the platform.",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, widthClass: "w-28" },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "sort_order", label: "Sort", type: "number", widthClass: "w-24" },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  shifts: {
    key: "shifts",
    title: "Shifts",
    description: "Shift values used for users and production entry.",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, widthClass: "w-28" },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "start_time", label: "Start Time", type: "time", required: true, widthClass: "w-32" },
      { key: "sort_order", label: "Sort", type: "number", widthClass: "w-24" },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  roles: {
    key: "roles",
    title: "Roles",
    description: "Application role values used for permissions.",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, widthClass: "w-32" },
      { key: "label", label: "Label", type: "text", required: true },
      { key: "sort_order", label: "Sort", type: "number", widthClass: "w-24" },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  emb_type_locations: {
    key: "emb_type_locations",
    title: "Embroidery Type Locations (Legacy)",
    description: "Legacy embroidery type/location combinations.",
    columns: [
      { key: "location", label: "Location", type: "text", required: true },
      { key: "emb_type", label: "Emb Type", type: "text", required: true },
      { key: "flat_or_3d", label: "Flat / 3D", type: "text", required: true },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  emb_locations: {
    key: "emb_locations",
    title: "Embroidery Locations",
    description: "Embroidery location lookup values.",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, widthClass: "w-28" },
      { key: "label", label: "Label", type: "text", required: true },
      { key: "sort_order", label: "Sort", type: "number", widthClass: "w-24" },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  emb_types: {
    key: "emb_types",
    title: "Embroidery Types",
    description: "Embroidery type lookup values.",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, widthClass: "w-28" },
      { key: "label", label: "Label", type: "text", required: true },
      { key: "sort_order", label: "Sort", type: "number", widthClass: "w-24" },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  emb_flat_3d_options: {
    key: "emb_flat_3d_options",
    title: "Flat / 3D Options",
    description: "Embroidery flat or 3D lookup values.",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, widthClass: "w-28" },
      { key: "label", label: "Label", type: "text", required: true },
      { key: "sort_order", label: "Sort", type: "number", widthClass: "w-24" },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  emb_type_location_rules: {
    key: "emb_type_location_rules",
    title: "Emb Type / Location Rules",
    description: "Allowed embroidery type/location/flat-3D combinations.",
    columns: [
      { key: "location_code", label: "Location Code", type: "text", required: true },
      { key: "emb_type_code", label: "Emb Type Code", type: "text", required: true },
      { key: "flat_or_3d_code", label: "Flat / 3D Code", type: "text", required: true },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  leather_styles: {
    key: "leather_styles",
    title: "Leather Styles",
    description: "Laser production leather style/color values.",
    columns: [
      { key: "style_color", label: "Style / Color", type: "text", required: true },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  recut_reasons: {
    key: "recut_reasons",
    title: "Recut Reasons",
    description: "Reason values used on recut requests.",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, widthClass: "w-32" },
      { key: "label", label: "Label", type: "text", required: true },
      { key: "sort_order", label: "Sort", type: "number", widthClass: "w-24" },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  recut_requested_departments: {
    key: "recut_requested_departments",
    title: "Recut Requested Departments",
    description: "Department values used for recut request delivery / requested department selection.",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, widthClass: "w-32" },
      { key: "label", label: "Label", type: "text", required: true },
      { key: "sort_order", label: "Sort", type: "number", widthClass: "w-24" },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  recut_items: {
    key: "recut_items",
    title: "Recut Items",
    description: "Item values used in recut workflows.",
    columns: [
      { key: "item_code", label: "Item Code", type: "text", required: true },
      { key: "description", label: "Description", type: "text", required: true },
      { key: "sort_order", label: "Sort", type: "number", widthClass: "w-24" },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  machines: {
    key: "machines",
    title: "Machines",
    description: "Shared machine values used across production.",
    columns: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "department", label: "Department", type: "text", required: true },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  knit_areas: {
    key: "knit_areas",
    title: "Knit Areas",
    description: "Knit production area lookup values.",
    columns: [
      { key: "name", label: "Area Name", type: "text", required: true },
      { key: "sort_order", label: "Sort", type: "number", widthClass: "w-24" },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  priorities: {
    key: "priorities",
    title: "CMMS Priorities",
    description: "Priority values used on CMMS work orders.",
    columns: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  statuses: {
    key: "statuses",
    title: "CMMS Statuses",
    description: "Status values used on CMMS work orders.",
    columns: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  issue_catalog: {
    key: "issue_catalog",
    title: "Issue Catalog",
    description: "Issue values used on CMMS work orders.",
    columns: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  techs: {
    key: "techs",
    title: "CMMS Techs",
    description: "Technician values used on CMMS work orders.",
    columns: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  wo_types: {
    key: "wo_types",
    title: "Work Order Types",
    description: "Work order type values used on CMMS work orders.",
    columns: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  cmms_departments: {
    key: "cmms_departments",
    title: "CMMS Departments",
    description: "Department values used in CMMS.",
    columns: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
    ],
  },

  cmms_assets: {
  key: "cmms_assets",
  title: "CMMS Assets",
  description: "Asset values used in CMMS.",
  columns: [
    { key: "name", label: "Name", type: "text", required: true },
    {
      key: "department_id",
      label: "Department",
      type: "select",
      required: true,
      optionsSource: "cmms_departments",
      displayKey: "department",
    },
    { key: "is_active", label: "Active", type: "boolean", widthClass: "w-24" },
  ],
},
};

export function isMasterKey(value: string): value is MasterKey {
  return (MASTER_KEYS as readonly string[]).includes(value);
}