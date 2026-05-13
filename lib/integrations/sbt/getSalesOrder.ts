// lib/integrations/sbt/getSalesOrder.ts
import { normalizeSalesOrder } from "@/lib/utils/salesOrder";

export class SalesOrderLookupError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "SalesOrderLookupError";
    this.status = status;
  }
}

export type SbtSalesOrderCompany = {
  name?: string;
  addr1?: string;
  addr2?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
};

export type SbtSalesOrderOrderInfo = {
  CompanyName?: string;
  FirstName?: string;
  LastName?: string;
  Address1?: string;
  Address2?: string;
  City?: string;
  State?: string;
  ZipCode?: string;
  PhoneNumber?: string;
  EmailId?: string;
};

export type SbtSalesOrderShippingInfo = {
  ShippingCompanyName?: string;
  ShippingFirstName?: string;
  ShippingLastName?: string;
  ShippingAddress1?: string;
  ShippingAddress2?: string;
  ShippingCity?: string;
  ShippingState?: string;
  ShippingZip?: string;
  ShippingPhone?: string;
  ShippingEmailId?: string;
  FreightMethodName?: string;
  AdditonalDeliveryInstruction?: string;
  AdditionalDeliveryInstruction?: string;
};

export type SbtSalesOrderWeb = {
  custNo?: string;
  poNumber?: {
    PoNumber?: string;
  };
  orderInfo?: SbtSalesOrderOrderInfo;
  shippingInfo?: SbtSalesOrderShippingInfo;
};

export type SbtSalesOrderItem = {
  qty?: number;
  minQty?: number;
  maxQty?: number;
  sku?: string;
  description?: string;
  uom?: string;
  stockitem?: string;
  defaultbin?: string;
  rqdate?: string;
  shipdate?: string;
};

export type SbtSalesOrderDecoration = {
  sono?: string;
  lineNo?: number;
  decoNo?: number | string;
  sortCode?: string;
  colors?: number | string;
  dcType?: string;
  dcLocation?: string;
  tapeName?: string;
  tapeNo?: string;
  stCount?: number;
  prevSono?: string | number;
  prevLine?: number;
  prevDeco?: number;
  wChange?: string;
  provided?: string;
  inHouse?: string;
  tallEt?: string;
  addUser?: string;
  addDate?: string;
  addTime?: string;
  lckStat?: string;
  lckUser?: string;
  lckDate?: string;
  lckTime?: string;
  descrip?: string;
  preClose?: string;
  dcStat?: string;
  knitLines?: number;
};

export type SbtSalesOrderInfo = {
  orderDate?: string;
  enteredBy?: string;
  csRep?: string;
  industry?: string;
  event?: string;
  soStat?: string;
  type?: string;
  custType?: string;
  shipVia?: string;
  terms?: string;
  salesperson?: string;
  commissionRate?: string;
  taxCode?: string;
  source?: string;
  printcapa?: string;
  note1?: string;
  note2?: string;
  note3?: string;
  comments?: string[];
  items?: SbtSalesOrderItem[];
};

export type SbtSalesOrderPrintFlags = {
  sono?: string;
  custOrig?: number;
  warehouse?: number;
  premiumLin?: number;
  cutting?: number;
  manufactur?: number;
  embroidery?: number;
  print?: number;
  shipping?: number;
  sample?: number;
  sampleEmb?: number;
  knitDept?: number;
  pdf?: number;
  mfgForKnts?: number;
  shipSamp?: number;
  report?: number;
};

export type SbtSalesOrderData = {
  sono?: string;
  company?: SbtSalesOrderCompany;
  web?: SbtSalesOrderWeb;
  sbtOrderInfo?: SbtSalesOrderInfo;
  sodeco?: SbtSalesOrderDecoration[];
  print?: SbtSalesOrderPrintFlags;
};

type RawSbtResponse = {
  success?: boolean;
  data?: SbtSalesOrderData;
  error?: string;
  message?: string;
};

export type GetSalesOrderResult = {
  requestedSalesOrder: string;
  salesOrderBase: string;
  salesOrderDisplay: string;
  data: SbtSalesOrderData;
};

function getBaseUrl(): string {
  const raw = (process.env.SBT_SALES_ORDER_API_BASE || "").trim();
  if (!raw) {
    throw new SalesOrderLookupError("SBT_SALES_ORDER_API_BASE is not configured.", 500);
  }
  return raw.replace(/\/+$/, "");
}

function coerceComments(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "").trim()).filter(Boolean);
}

function sanitizeData(data: SbtSalesOrderData | undefined | null): SbtSalesOrderData {
  const safe = data && typeof data === "object" ? data : {};

  return {
    ...safe,
    sbtOrderInfo: {
      ...(safe.sbtOrderInfo || {}),
      comments: coerceComments(safe.sbtOrderInfo?.comments),
      items: Array.isArray(safe.sbtOrderInfo?.items) ? safe.sbtOrderInfo.items : [],
    },
    sodeco: Array.isArray(safe.sodeco) ? safe.sodeco : [],
    print: safe.print && typeof safe.print === "object" ? safe.print : {},
  };
}

export async function getSalesOrder(input: unknown): Promise<GetSalesOrderResult> {
  const normalized = normalizeSalesOrder(input);

  if (!normalized.isValid || !normalized.salesOrderBase || !normalized.salesOrderDisplay) {
    throw new SalesOrderLookupError(normalized.error || "Invalid Sales Order.", 400);
  }

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/salesorder?so=${encodeURIComponent(normalized.salesOrderBase)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
         "x-api-key": String(process.env.WILCOM_API_KEY || "").trim(),
      },
      cache: "no-store",
    });
  } catch {
    throw new SalesOrderLookupError(
      "Unable to reach the SBT Sales Order endpoint. Verify network access from the app runtime.",
      502
    );
  }

  let body: RawSbtResponse | null = null;
  try {
    body = (await res.json()) as RawSbtResponse;
  } catch {
    if (!res.ok) {
      throw new SalesOrderLookupError(`SBT lookup failed with status ${res.status}.`, res.status || 502);
    }
    throw new SalesOrderLookupError("SBT lookup returned an invalid JSON response.", 502);
  }

  if (!res.ok) {
    throw new SalesOrderLookupError(
      body?.error || body?.message || `SBT lookup failed with status ${res.status}.`,
      res.status || 502
    );
  }

  if (!body?.success || !body?.data) {
    throw new SalesOrderLookupError(
      body?.error || body?.message || "No Sales Order data was returned.",
      404
    );
  }

  return {
    requestedSalesOrder: normalized.salesOrderDisplay,
    salesOrderBase: normalized.salesOrderBase,
    salesOrderDisplay: normalized.salesOrderDisplay,
    data: sanitizeData(body.data),
  };
}