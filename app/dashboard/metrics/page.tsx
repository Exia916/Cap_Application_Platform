import Link from "next/link";
import DashboardMetrics from "../_components/DashboardMetrics";

export default function DashboardMetricsPage() {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Metrics</h1>
        <Link href="/dashboard">Back</Link>
      </div>

      <div style={{ marginTop: 12 }}>
        <DashboardMetrics />
      </div>
    </div>
  );
}