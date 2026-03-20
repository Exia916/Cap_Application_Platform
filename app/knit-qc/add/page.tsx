import KnitQcForm from "../KnitQcForm";

// Page for creating a new Knit QC submission. This component is
// intentionally lightweight: it simply wraps the shared form
// component in a page shell so that the form can focus on editing
// logic. See KnitQcForm.tsx for details.

export default function AddKnitQcPage() {
  return (
    <div className="page-shell">
      <div className="page-header">
        {/* Intentionally left blank to align with knit production pattern. */}
      </div>

      <KnitQcForm />
    </div>
  );
}