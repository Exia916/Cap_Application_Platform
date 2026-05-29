export type NotificationRuleConditionConfig = {
  rush?: "any" | "true" | "false";
  salesOrder?: "any" | "exists" | "missing";

  customerMode?: "any" | "equals" | "starts_with" | "contains";
  customerValue?: string;

  dueDate?:
    | "any"
    | "exists"
    | "missing"
    | "before_today"
    | "today"
    | "after_today"
    | "on_or_before_today"
    | "on_or_after_today";

  digitizer?: "any" | "assigned" | "unassigned";
  designer?: "any" | "assigned" | "unassigned";
  bin?: "any" | "assigned" | "unassigned";

  changedField?:
    | "any"
    | "became_blank"
    | "was_blank"
    | "changed_to"
    | "changed_from";
  changedFieldValue?: string;
};

export type NotificationRuleConditionContext = {
  rush?: boolean | null;

  salesOrder?: string | null;
  customerName?: string | null;
  dueDate?: string | null;

  digitizerUserId?: string | null;
  digitizerName?: string | null;

  designerUserId?: string | null;
  designerName?: string | null;

  binCode?: string | null;

  fieldName?: string | null;
  previousValue?: unknown;
  newValue?: unknown;

  now?: Date;
};

export type NotificationRuleConditionResult = {
  passed: boolean;
  failedReasons: string[];
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function lower(value: unknown): string {
  return clean(value).toLowerCase();
}

function hasValue(value: unknown): boolean {
  return clean(value) !== "";
}

function normalizeConfig(value: unknown): NotificationRuleConditionConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return value as NotificationRuleConditionConfig;
}

function chicagoDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}

function normalizeDateKey(value: unknown): string | null {
  const raw = clean(value);
  if (!raw) return null;

  const firstTen = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(firstTen)) return firstTen;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  return chicagoDateKey(parsed);
}

function assigned(userId: unknown, name: unknown): boolean {
  return hasValue(userId) || hasValue(name);
}

function compareText(mode: string | undefined, actual: unknown, expected: unknown): boolean {
  const actualText = lower(actual);
  const expectedText = lower(expected);

  if (!mode || mode === "any") return true;
  if (!expectedText) return true;

  if (mode === "equals") return actualText === expectedText;
  if (mode === "starts_with") return actualText.startsWith(expectedText);
  if (mode === "contains") return actualText.includes(expectedText);

  return true;
}

function evaluatePresence(
  mode: string | undefined,
  valuePresent: boolean,
  label: string
): string | null {
  if (!mode || mode === "any") return null;

  if (mode === "exists" || mode === "assigned") {
    return valuePresent ? null : `${label} is required.`;
  }

  if (mode === "missing" || mode === "unassigned") {
    return valuePresent ? `${label} must be blank.` : null;
  }

  return null;
}

export function evaluateNotificationRuleConditions(
  rawConfig: unknown,
  context: NotificationRuleConditionContext
): NotificationRuleConditionResult {
  const config = normalizeConfig(rawConfig);
  const failedReasons: string[] = [];

  if (config.rush === "true" && context.rush !== true) {
    failedReasons.push("Rush must be Yes.");
  }

  if (config.rush === "false" && context.rush === true) {
    failedReasons.push("Rush must be No.");
  }

  const salesOrderReason = evaluatePresence(
    config.salesOrder,
    hasValue(context.salesOrder),
    "Sales Order"
  );
  if (salesOrderReason) failedReasons.push(salesOrderReason);

  if (!compareText(config.customerMode, context.customerName, config.customerValue)) {
    failedReasons.push("Customer condition was not met.");
  }

  const today = chicagoDateKey(context.now ?? new Date());
  const dueDate = normalizeDateKey(context.dueDate);

  if (config.dueDate && config.dueDate !== "any") {
    if (config.dueDate === "exists" && !dueDate) {
      failedReasons.push("Due Date is required.");
    }

    if (config.dueDate === "missing" && dueDate) {
      failedReasons.push("Due Date must be blank.");
    }

    if (config.dueDate === "before_today" && (!dueDate || dueDate >= today)) {
      failedReasons.push("Due Date must be before today.");
    }

    if (config.dueDate === "today" && dueDate !== today) {
      failedReasons.push("Due Date must be today.");
    }

    if (config.dueDate === "after_today" && (!dueDate || dueDate <= today)) {
      failedReasons.push("Due Date must be after today.");
    }

    if (config.dueDate === "on_or_before_today" && (!dueDate || dueDate > today)) {
      failedReasons.push("Due Date must be today or earlier.");
    }

    if (config.dueDate === "on_or_after_today" && (!dueDate || dueDate < today)) {
      failedReasons.push("Due Date must be today or later.");
    }
  }

  const digitizerReason = evaluatePresence(
    config.digitizer,
    assigned(context.digitizerUserId, context.digitizerName),
    "Digitizer"
  );
  if (digitizerReason) failedReasons.push(digitizerReason);

  const designerReason = evaluatePresence(
    config.designer,
    assigned(context.designerUserId, context.designerName),
    "Designer"
  );
  if (designerReason) failedReasons.push(designerReason);

  const binReason = evaluatePresence(config.bin, hasValue(context.binCode), "Bin #");
  if (binReason) failedReasons.push(binReason);

  const previous = clean(context.previousValue);
  const next = clean(context.newValue);
  const expectedFieldValue = clean(config.changedFieldValue);

  if (config.changedField && config.changedField !== "any") {
    if (config.changedField === "became_blank" && next !== "") {
      failedReasons.push("Changed field must become blank.");
    }

    if (config.changedField === "was_blank" && previous !== "") {
      failedReasons.push("Changed field must start blank.");
    }

    if (
      config.changedField === "changed_to" &&
      expectedFieldValue &&
      lower(next) !== lower(expectedFieldValue)
    ) {
      failedReasons.push("Changed field did not change to the required value.");
    }

    if (
      config.changedField === "changed_from" &&
      expectedFieldValue &&
      lower(previous) !== lower(expectedFieldValue)
    ) {
      failedReasons.push("Changed field did not change from the required value.");
    }
  }

  return {
    passed: failedReasons.length === 0,
    failedReasons,
  };
}

export function normalizeNotificationRuleConditionConfig(
  value: unknown
): NotificationRuleConditionConfig {
  const config = normalizeConfig(value);

  return {
    rush: config.rush || "any",
    salesOrder: config.salesOrder || "any",

    customerMode: config.customerMode || "any",
    customerValue: clean(config.customerValue),

    dueDate: config.dueDate || "any",

    digitizer: config.digitizer || "any",
    designer: config.designer || "any",
    bin: config.bin || "any",

    changedField: config.changedField || "any",
    changedFieldValue: clean(config.changedFieldValue),
  };
}