import KnitProductionForm from "../../KnitProductionForm";

export default async function EditKnitProductionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="page-shell">
      <div className="page-header">
              </div>

      <KnitProductionForm initialSubmissionId={id} />
    </div>
  );
}