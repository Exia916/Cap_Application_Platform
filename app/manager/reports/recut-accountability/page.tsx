// app/manager/reports/recut-accountability/page.tsx

import RecutAccountabilityRulesClient from "./RecutAccountabilityRulesClient";

export default function RecutAccountabilityRulesPage() {
  return (
    <div className="page-shell-wide">
      <div className="page-header">
        <div>
          <h1 className="page-title">Recut Accountability Rules</h1>
          <p className="page-subtitle">
            Configure which recut reasons count against operator recut-rate reporting.
            Unconfigured reasons remain accountable by default.
          </p>
        </div>
      </div>

      <RecutAccountabilityRulesClient />
    </div>
  );
}