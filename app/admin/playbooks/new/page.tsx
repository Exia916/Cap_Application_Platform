import PlaybookEditorForm from "../PlaybookEditorForm";

export default function NewPlaybookPage() {
  return (
    <div className="page-shell-wide">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">New Playbook</h1>
          <p className="page-subtitle">
            Create a new Playbook article and save it as draft, published, or archived.
          </p>
        </div>
      </div>

      <PlaybookEditorForm />
    </div>
  );
}