// lib/inboundShipments/constants.ts

export const INBOUND_SHIPMENT_ENTITY_TYPE = "inbound_shipment";

export const INBOUND_SHIPMENT_ATTACHMENT_CATEGORY_GENERAL = "general";
export const INBOUND_SHIPMENT_ATTACHMENT_CATEGORY_PURCHASE_ORDER = "purchase_order";

export const DEFAULT_INBOUND_SHIPMENT_STATUS_CODE = "DRAFT";

export type InboundShipmentLookupOption = {
  id: number;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
};