import TechWorkOrderForm from "../TechWorkOrderForm";

export default async function EditCMMSWorkOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div style={{ padding: 16 }}>
      <h1>Edit CMMS Work Order #{id}</h1>
      <TechWorkOrderForm id={id} />
    </div>
  );
}