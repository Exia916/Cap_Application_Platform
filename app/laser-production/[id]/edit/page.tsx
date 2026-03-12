// app/laser-production/[id]/edit/page.tsx
import LaserProductionForm from "../../LaserProductionForm";

export default async function EditLaserProductionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ marginBottom: 12 }}>Edit Laser Production Entry</h1>
      <LaserProductionForm mode="edit" id={id} />
    </div>
  );
}