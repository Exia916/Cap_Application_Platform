import KnitQcForm from "../../KnitQcForm";

// Edit page for Knit QC. Accepts the dynamic route parameter id and
// passes it to the form as initialSubmissionId. The form handles
// loading existing data and validation. The page shell is kept
// minimal to match the knit production edit page.

export default async function EditKnitQcPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="page-shell">
      <div className="page-header"></div>
      <KnitQcForm initialSubmissionId={id} />
    </div>
  );
}