// app/reports/_components/ReportVisualization.tsx

"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatReportAxisLabel,
  formatReportCell,
  humanizeReportLabel,
} from "@/lib/reports/reportFormatters";

type Column = {
  key: string;
  label: string;
  type: string;
};

type Props = {
  visualization: string;
  columns: Column[];
  rows: Record<string, any>[];
};

function firstLabelColumn(columns: Column[]) {
  return (
    columns.find((c) => c.type === "date")?.key ??
    columns.find((c) => c.type === "datetime")?.key ??
    columns.find((c) => c.type === "text")?.key ??
    columns[0]?.key
  );
}

function firstNumberColumn(columns: Column[]) {
  return columns.find((c) => c.type === "number")?.key;
}

function columnLabel(columns: Column[], key: string | undefined) {
  if (!key) return "";
  return humanizeReportLabel(columns.find((c) => c.key === key)?.label ?? key);
}

function columnType(columns: Column[], key: string | undefined) {
  return columns.find((c) => c.key === key)?.type;
}

export default function ReportVisualization({ visualization, columns, rows }: Props) {
  const labelKey = firstLabelColumn(columns);
  const valueKey = firstNumberColumn(columns);
  const labelType = columnType(columns, labelKey);
  const valueType = columnType(columns, valueKey);
  const valueLabel = columnLabel(columns, valueKey);

  if (!rows.length || !labelKey || !valueKey) {
    return null;
  }

  const tooltipFormatter = (value: any, name: any) => [
    formatReportCell(value, valueType),
    humanizeReportLabel(String(name || valueLabel)),
  ];

  const labelFormatter = (value: any) => formatReportAxisLabel(value, labelType);

  if (visualization === "kpi") {
    const total = rows.reduce((sum, row) => sum + Number(row[valueKey] ?? 0), 0);

    return (
      <div className="card">
        <div className="record-kicker">{valueLabel}</div>
        <div style={{ fontSize: 34, fontWeight: 900 }}>
          {Number.isFinite(total) ? formatReportCell(total, "number") : "0"}
        </div>
      </div>
    );
  }

  if (visualization === "bar") {
    return (
      <div className="card" style={{ height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={labelKey} tickFormatter={labelFormatter} />
            <YAxis tickFormatter={(value) => formatReportAxisLabel(value, "number")} />
            <Tooltip formatter={tooltipFormatter} labelFormatter={labelFormatter} />
            <Legend />
            <Bar dataKey={valueKey} name={valueLabel} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (visualization === "line") {
    return (
      <div className="card" style={{ height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={labelKey} tickFormatter={labelFormatter} />
            <YAxis tickFormatter={(value) => formatReportAxisLabel(value, "number")} />
            <Tooltip formatter={tooltipFormatter} labelFormatter={labelFormatter} />
            <Legend />
            <Line type="monotone" dataKey={valueKey} name={valueLabel} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (visualization === "pie" || visualization === "donut") {
    return (
      <div className="card" style={{ height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip formatter={tooltipFormatter} labelFormatter={labelFormatter} />
            <Legend />
            <Pie
              data={rows}
              dataKey={valueKey}
              nameKey={labelKey}
              outerRadius={120}
              innerRadius={visualization === "donut" ? 70 : 0}
              label={(entry) => formatReportAxisLabel((entry as any)?.name, labelType)}
            >
              {rows.map((_, index) => (
                <Cell key={`slice-${index}`} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
}