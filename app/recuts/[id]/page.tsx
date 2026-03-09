import RecutForm from "../RecutForm";

export default async function EditRecutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RecutForm mode="edit" initialId={id} />;
}