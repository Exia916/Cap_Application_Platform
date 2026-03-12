// app/emblem-production/[id]/edit/page.tsx
import EmblemProductionForm from "../../EmblemProductionForm";

export default async function EditEmblemProductionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ marginBottom: 12 }}>Edit Emblem Production Submission</h1>
      <EmblemProductionForm mode="edit" id={id} />
    </div>
  );
}