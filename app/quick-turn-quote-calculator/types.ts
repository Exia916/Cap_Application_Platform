// app/quick-turn-quote-calculator/types.ts

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
  baseItemId: string;
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
  items: QuickTurnQuoteInputItem[];
};

export type QuickTurnCalculatedItem = {
  clientItemId: string;
  sortOrder: number;
  baseItem: {
    id: string;
    code: string;
    itemCode: string;
    fabricDescription: string | null;
    basePrice: number;
  };
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
