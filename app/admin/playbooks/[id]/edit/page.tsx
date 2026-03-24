import PlaybookEditorForm from "../../PlaybookEditorForm";

export default async function EditPlaybookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="page-shell-wide">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Edit Playbook</h1>
          <p className="page-subtitle">
            Update article content, publishing details, related articles, and supporting files.
          </p>
        </div>
      </div>

      <PlaybookEditorForm articleId={id} />
    </div>
  );
}