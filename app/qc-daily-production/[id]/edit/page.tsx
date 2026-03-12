// app/qc-daily-production/[id]/edit/page.tsx
import QCDailyProductionForm from "../../QCDailyProductionForm";

export default async function EditQCDailyProductionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ marginBottom: 12 }}>Edit QC Daily Production Submission</h1>
      <QCDailyProductionForm initialSubmissionId={id} />
    </div>
  );
}