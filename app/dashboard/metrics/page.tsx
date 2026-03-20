import Link from "next/link";
import DashboardMetrics from "../_components/DashboardMetrics";

export default function DashboardMetricsPage() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">My Metrics</h1>
          <p className="page-subtitle">
            Shows only your submissions for the selected date.
          </p>
        </div>

        <Link href="/dashboard" className="btn btn-secondary">
          Back to Dashboard
        </Link>
      </div>

      <DashboardMetrics />
    </div>
  );
}