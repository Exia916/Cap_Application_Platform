import Link from "next/link";

export default function ReportsPage() {
  return (
    <main className="page-shell-wide">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">
            Create, save, run, filter, export, and share CAP reports.
          </p>
        </div>

        <Link href="/reports/builder" className="btn btn-primary">
          Create New Report
        </Link>
      </div>

      <div className="master-grid">
        <Link href="/reports/saved" className="master-card-link">
          <div className="master-card-title">Saved Reports</div>
          <div className="master-card-description">
            View and run reports you created or reports shared with your role or department.
          </div>
          <div className="master-card-meta">Saved report library</div>
        </Link>

        <Link href="/reports/builder" className="master-card-link">
          <div className="master-card-title">Create New Report</div>
          <div className="master-card-description">
            Choose an approved dataset, pick columns, add filters, group results, and save.
          </div>
          <div className="master-card-meta">Report builder</div>
        </Link>

        <Link href="/reports/saved?view=recent" className="master-card-link">
          <div className="master-card-title">My Recent Reports</div>
          <div className="master-card-description">
            Quickly reopen recently created or recently run reports.
          </div>
          <div className="master-card-meta">Recent activity</div>
        </Link>

        <Link href="/reports/saved?visibility=department" className="master-card-link">
          <div className="master-card-title">Department Reports</div>
          <div className="master-card-description">
            Reports shared with departments for recurring production, quality, and workflow review.
          </div>
          <div className="master-card-meta">Shared department reports</div>
        </Link>

        <Link href="/reports/dashboards" className="master-card-link">
          <div className="master-card-title">Admin / Data Quality Reports</div>
          <div className="master-card-description">
            Review missing reporting fields, timestamp issues, voided records, and data exceptions.
          </div>
          <div className="master-card-meta">Admin reporting</div>
        </Link>
      </div>
    </main>
  );
}