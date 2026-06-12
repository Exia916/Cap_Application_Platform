// app/reports/[id]/edit/page.tsx

import ReportBuilderClient from "../../_components/ReportBuilderClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SavedReportEditPage({ params }: Props) {
  const { id } = await params;

  return (
    <main className="page-shell-wide">
      <ReportBuilderClient savedReportId={id} />
    </main>
  );
}