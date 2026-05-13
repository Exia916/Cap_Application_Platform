// lib/reports/reportDatePresets.ts

export type ReportDatePresetKey =
  | "today"
  | "yesterday"
  | "currentShiftDate"
  | "last7Days"
  | "last14Days"
  | "last30Days"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "custom";

export type ReportDatePreset = {
  key: ReportDatePresetKey;
  label: string;
};

export const REPORT_DATE_PRESETS: ReportDatePreset[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "currentShiftDate", label: "Current Shift Date" },
  { key: "last7Days", label: "Last 7 Days" },
  { key: "last14Days", label: "Last 14 Days" },
  { key: "last30Days", label: "Last 30 Days" },
  { key: "thisWeek", label: "This Week" },
  { key: "lastWeek", label: "Last Week" },
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "custom", label: "Custom Range" },
];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeekMonday(d: Date) {
  const base = startOfDay(d);
  const day = base.getDay(); // Sunday = 0
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(base, offset);
}

function toDateInput(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getReportDatePresetRange(
  presetKey: ReportDatePresetKey,
  now = new Date()
): { from: string; to: string } | null {
  const today = startOfDay(now);

  switch (presetKey) {
    case "today":
      return {
        from: toDateInput(today),
        to: toDateInput(today),
      };

    case "yesterday": {
      const d = addDays(today, -1);
      return {
        from: toDateInput(d),
        to: toDateInput(d),
      };
    }

    case "currentShiftDate": {
      const current = new Date(now);
      const shiftDate = current.getHours() < 6 ? addDays(today, -1) : today;

      return {
        from: toDateInput(shiftDate),
        to: toDateInput(shiftDate),
      };
    }

    case "last7Days":
      return {
        from: toDateInput(addDays(today, -6)),
        to: toDateInput(today),
      };

    case "last14Days":
      return {
        from: toDateInput(addDays(today, -13)),
        to: toDateInput(today),
      };

    case "last30Days":
      return {
        from: toDateInput(addDays(today, -29)),
        to: toDateInput(today),
      };

    case "thisWeek": {
      const start = startOfWeekMonday(today);
      return {
        from: toDateInput(start),
        to: toDateInput(today),
      };
    }

    case "lastWeek": {
      const thisWeekStart = startOfWeekMonday(today);
      const lastWeekStart = addDays(thisWeekStart, -7);
      const lastWeekEnd = addDays(thisWeekStart, -1);

      return {
        from: toDateInput(lastWeekStart),
        to: toDateInput(lastWeekEnd),
      };
    }

    case "thisMonth": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        from: toDateInput(start),
        to: toDateInput(today),
      };
    }

    case "lastMonth": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);

      return {
        from: toDateInput(start),
        to: toDateInput(end),
      };
    }

    case "custom":
    default:
      return null;
  }
}