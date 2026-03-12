// app/daily-production/[id]/edit/page.tsx
import DailyProductionForm from "../../DailyProductionForm";

export default async function EditDailyProductionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ marginBottom: 12 }}>Edit Daily Production Submission</h1>
      <DailyProductionForm initialSubmissionId={id} />
    </div>
  );
}