// app/quick-turn-quote-calculator/types.ts

export type QuickTurnQuoteStatus = "DRAFT" | "PUBLISHED";

export type QuickTurnProgram = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type QuickTurnFactory = {
  id: number;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export type QuickTurnBaseItem = {
  id: string;
  code: string;
  factoryId: number;
  itemCode: string;
  fabricDescription: string | null;
  basePrice: number;
  sortOrder: number;
  isActive: boolean;
};

export type QuickTurnAccessory = {
  id: string;
  code: string;
  programId: number;
  factoryId: number;
  category: "DECORATION" | "CLOSURE";
  name: string;
  unitPrice: number;
  pricingMethod: string;
  notes: string | null;
  inputConfig: Record<string, unknown>;
  sortOrder: number;
  isActive: boolean;
};

export type QuickTurnCamoOption = {
  id: string;
  code: string;
  factoryId: number;
  series: string;
  supplier: string;
  unitPrice: number;
  sortOrder: number;
  isActive: boolean;
};

export type QuickTurnFeeType = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type QuickTurnOverseasCustomerServiceUser = {
  id: string;
  username: string | null;
  displayName: string;
  email: string | null;
  employeeNumber: number | null;
  department: string | null;
};

export type QuickTurnCalculatorBreak = {
  id: number;
  calculatorId: number;
  sortOrder: number;
  label: string;
  minQuantity: number;
  maxQuantity: number | null;
  managementReviewRequired: boolean;
  marginRate: number;
  surchargeMultiplier: number;
  airFreightAmount: number | null;
  ddpBaseAmount: number | null;
  ddpMarkupRate: number | null;
  moShippingAmount: number | null;
  isActive: boolean;
};

export type QuickTurnCalculator = {
  id: number;
  code: string;
  programId: number;
  factoryId: number;
  name: string;
  displayLabel: string;
  routeType: "STANDARD" | "DDP_MO_AIR" | "DDP_DIRECT_AIR";
  dutiesTaxRate: number;
  tariffRate: number;
  rebateRate: number;
  leadTimeNote: string | null;
  sortOrder: number;
  isActive: boolean;
  breaks: QuickTurnCalculatorBreak[];
};

export type QuickTurnLookupPayload = {
  programs: QuickTurnProgram[];
  factories: QuickTurnFactory[];
  baseItems: QuickTurnBaseItem[];
  accessories: QuickTurnAccessory[];
  camoOptions: QuickTurnCamoOption[];
  calculators: QuickTurnCalculator[];
  feeTypes: QuickTurnFeeType[];
};

export type QuickTurnQuoteInputAccessory = {
  accessoryId: string;
  inputValues: Record<string, unknown>;
  sortOrder: number;
};

export type QuickTurnQuoteInputFee = {
  feeTypeId: number | string | null;
  amount: number | string | null;
  notes: string | null;
  sortOrder: number;
};

export type QuickTurnQuoteInputItem = {
  clientItemId: string;
  baseItemId?: string | null;
  isCustomCap?: boolean | null;
  customCapCost?: number | string | null;
  customCapDescription?: string | null;
  baseItemDescription?: string | null;
  baseItemDescriptionOverride?: string | null;
  accessories: QuickTurnQuoteInputAccessory[];
  closure?: QuickTurnQuoteInputAccessory | null;
  camoOptionId?: string | null;
  fees: QuickTurnQuoteInputFee[];
  notes?: string | null;
  sortOrder: number;
};

export type QuickTurnCalculatePayload = {
  programId?: number | string | null;
  programCode?: string | null;
  factoryId?: number | string | null;
  factoryCode?: string | null;
  workflowSalesOrderNumber?: string | null;
  overseasCustomerServiceUserId?: string | null;
  overseasCustomerServiceNameSnapshot?: string | null;
  overseasCustomerServiceEmailSnapshot?: string | null;
  overseasCustomerServiceEmployeeNumberSnapshot?: number | string | null;
  rebatePercent?: number | string | null;
  quoteRebateRate?: number | string | null;
  preparedForCustomerId?: string | null;
  preparedForCustomerCodeSnapshot?: string | null;
  preparedForCustomerNameSnapshot?: string | null;
  quotePreparedForDisplay?: string | null;
  programLogoText?: string | null;
  fob?: string | null;
  items: QuickTurnQuoteInputItem[];
};

export type QuickTurnCalculatedItem = {
  clientItemId: string;
  sortOrder: number;
  baseItem: {
    id: string | null;
    code: string;
    itemCode: string;
    fabricDescription: string | null;
    basePrice: number;
    isCustomCap?: boolean;
    customCapDescription?: string | null;
  };
  isCustomCap: boolean;
  customCapDescription: string | null;
  accessories: Array<{
    id: string;
    code: string;
    category: "DECORATION" | "CLOSURE";
    name: string;
    pricingMethod: string;
    unitPrice: number;
    inputValues: Record<string, unknown>;
    calculatedUnitPrice: number;
    sortOrder: number;
  }>;
  camoOption: {
    id: string;
    code: string;
    series: string;
    supplier: string;
    unitPrice: number;
  } | null;
  fees: Array<{
    feeTypeId: number | null;
    feeCode: string;
    feeName: string;
    amount: number;
    notes: string | null;
    sortOrder: number;
  }>;
  baseUnitPrice: number;
  accessoryUnitTotal: number;
  decoratedUnitCost: number;
  camoUnitPrice: number;
  oneTimeFeeTotal: number;
  notes: string | null;
  calculatorResults: Array<{
    calculator: {
      id: number;
      code: string;
      name: string;
      displayLabel: string;
      routeType: "STANDARD" | "DDP_MO_AIR" | "DDP_DIRECT_AIR";
      dutiesTaxRate: number;
      tariffRate: number;
      rebateRate: number;
      leadTimeNote: string | null;
    };
    breaks: Array<{
      quantityBreakId: number;
      breakLabel: string;
      minQuantity: number;
      maxQuantity: number | null;
      managementReviewRequired: boolean;
      marginRate: number;
      baseMarginRate?: number;
      quoteRebateRate?: number;
      surchargeMultiplier: number;
      airFreightAmount: number | null;
      ddpBaseAmount: number | null;
      ddpMarkupRate: number | null;
      moShippingAmount: number | null;
      surchargedDecoratedCost: number;
      camoUnitPrice: number;
      dutiesTaxAmount: number;
      tariffAmount: number;
      rebateRate: number;
      preMarginCost: number;
      unitPrice: number;
      formulaNotes: string[];
    }>;
  }>;
};

export type QuickTurnCalculationResult = {
  program: {
    id: number;
    code: string;
    name: string;
  };
  factory: {
    id: number;
    code: string;
    name: string;
  };
  generatedAt: string;
  validUntil: string;
  disclaimer: string;
  finalBreakNote: string;
  input: QuickTurnCalculatePayload;
  items: QuickTurnCalculatedItem[];
};

export type SavedQuickTurnQuoteSummary = {
  id: string;
  quoteNumber: string;
  quoteName: string;
  quoteStatus: QuickTurnQuoteStatus;
  workflowSalesOrderNumber: string | null;
  overseasCustomerServiceUserId: string | null;
  overseasCustomerServiceNameSnapshot: string | null;
  overseasCustomerServiceEmailSnapshot: string | null;
  overseasCustomerServiceEmployeeNumberSnapshot: number | null;
  quoteRebateRate: number;
  preparedForCustomerId: string | null;
  preparedForCustomerCodeSnapshot: string | null;
  preparedForCustomerNameSnapshot: string | null;
  quotePreparedForDisplay: string | null;
  programLogoText: string | null;
  fob: string | null;
  sourceQuoteId: string | null;
  sourceQuoteNumber: string | null;
  revisionNumber: number;
  publishedAt: string | null;
  publishedBy: string | null;
  programName: string;
  factoryName: string;
  generatedAt: string;
  validUntil: string;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  itemCount: number;
};

export type SavedQuickTurnQuoteDetail = SavedQuickTurnQuoteSummary & {
  programCode: string;
  factoryCode: string;
  disclaimer: string;
  notes: string | null;
  inputSnapshot: unknown;
  resultSnapshot: unknown;
  items: Array<{
    id: string;
    sortOrder: number;
    isCustomCap: boolean;
    customCapDescription: string | null;
    baseItemCode: string;
    baseItemDescription: string | null;
    baseItemPrice: number;
    decoratedUnitCost: number;
    camoCode: string | null;
    camoSeries: string | null;
    camoSupplier: string | null;
    camoUnitPrice: number;
    notes: string | null;
    accessories: Array<{
      id: string;
      category: string;
      code: string;
      name: string;
      pricingMethod: string;
      unitPrice: number;
      inputValues: unknown;
      calculatedUnitPrice: number;
      sortOrder: number;
    }>;
    fees: Array<{
      id: string;
      feeCode: string;
      feeName: string;
      amount: number;
      notes: string | null;
      sortOrder: number;
    }>;
    results: Array<{
      id: string;
      calculatorCode: string;
      calculatorName: string;
      calculatorRouteType: string;
      breakLabel: string;
      minQuantity: number;
      maxQuantity: number | null;
      managementReviewRequired: boolean;
      marginRate: number;
      baseMarginRate?: number;
      quoteRebateRate?: number;
      surchargeMultiplier: number;
      dutiesTaxRate: number;
      tariffRate: number;
      rebateRate: number;
      airFreightAmount: number | null;
      ddpBaseAmount: number | null;
      ddpMarkupRate: number | null;
      moShippingAmount: number | null;
      surchargedDecoratedCost: number;
      camoUnitPrice: number;
      preMarginCost: number;
      unitPrice: number;
    }>;
  }>;
};

export const QUICK_TURN_FINAL_BREAK_LABEL = "5005–10008+";
export const QUICK_TURN_CUSTOM_CAP_BASE_ITEM_ID = "__CUSTOM_CAP__";

export type QuickTurnCustomerOption = {
  id: string;
  code: string;
  name: string;
  label: string;
  isActive: boolean;
};

export type QuickTurnCustomerExportSelectedBreak = {
  resultId: string;
  calculatorCode: string;
  calculatorName: string;
  calculatorRouteType: string;
  breakLabel: string;
  quantityLabel: string;
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: number;
  managementReviewRequired: boolean;
};

export type QuickTurnCustomerExportAttachment = {
  id: number;
  originalFileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
  uploadedByName: string | null;
  canPreviewInline: boolean;
};

export type QuickTurnCustomerExportOneTimeFee = {
  id: string;
  feeCode: string;
  feeName: string;
  amount: number;
  notes: string | null;
  sortOrder: number;
};

export type QuickTurnCustomerExportItem = {
  id: string | null;
  quoteItemId: string;
  sortOrder: number;
  baseItemCode: string;
  baseItemDescription: string | null;
  isCustomCap: boolean;
  customCapDescription: string | null;
  optionLabel: string;
  customerDescription: string | null;
  customerNotes: string | null;
  factoryDisplay: string | null;
  selectedMethodCode: string | null;
  selectedBreaks: QuickTurnCustomerExportSelectedBreak[];
  oneTimeFees: QuickTurnCustomerExportOneTimeFee[];
  imageAttachmentId: number | null;
  imageAttachment: QuickTurnCustomerExportAttachment | null;
  imageAttachmentCategory: string;
  availableImageAttachments: QuickTurnCustomerExportAttachment[];
  availableBreaks: QuickTurnCustomerExportSelectedBreak[];
};

export type QuickTurnCustomerExportDetail = {
  exists: boolean;
  id: string | null;
  quoteId: string;
  quoteNumber: string;
  quoteName: string;
  quoteStatus: QuickTurnQuoteStatus;
  isVoided: boolean;
  voidReason: string | null;
  generatedAt: string;
  validUntil: string;
  selectedCalculatorId: number | null;
  selectedCalculatorCode: string | null;
  selectedCalculatorName: string | null;
  availableCalculators: Array<{ id: number | null; code: string; name: string }>;
  preparedForCustomerId: string | null;
  preparedForCustomerCodeSnapshot: string | null;
  preparedForCustomerNameSnapshot: string | null;
  quotePreparedForDisplay: string | null;
  workflowSalesOrderNumber: string | null;
  overseasCustomerServiceNameSnapshot?: string | null;
  quoteRebateRate?: number | null;
  programLogoText: string | null;
  capProgramName: string;
  customerServiceContact: string | null;
  sampleProductionDetails: string | null;
  productionTimeDetails: string | null;
  fob: string;
  additionalInformation: string | null;
  createdAt: string | null;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  items: QuickTurnCustomerExportItem[];
};
