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

function firstTextColumn(columns: Column[]) {
  return columns.find((c) => c.type === "text" || c.type === "date")?.key ?? columns[0]?.key;
}

function firstNumberColumn(columns: Column[]) {
  return columns.find((c) => c.type === "number")?.key;
}

export default function ReportVisualization({ visualization, columns, rows }: Props) {
  const labelKey = firstTextColumn(columns);
  const valueKey = firstNumberColumn(columns);

  if (!rows.length || !labelKey || !valueKey) {
    return null;
  }

  if (visualization === "kpi") {
    const total = rows.reduce((sum, row) => sum + Number(row[valueKey] ?? 0), 0);
    const valueLabel = columns.find((c) => c.key === valueKey)?.label ?? valueKey;

    return (
      <div className="card">
        <div className="record-kicker">{valueLabel}</div>
        <div style={{ fontSize: 34, fontWeight: 900 }}>
          {Number.isFinite(total) ? total.toLocaleString() : "0"}
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
            <XAxis dataKey={labelKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey={valueKey} />
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
            <XAxis dataKey={labelKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey={valueKey} />
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
            <Tooltip />
            <Legend />
            <Pie
              data={rows}
              dataKey={valueKey}
              nameKey={labelKey}
              outerRadius={120}
              innerRadius={visualization === "donut" ? 70 : 0}
              label
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