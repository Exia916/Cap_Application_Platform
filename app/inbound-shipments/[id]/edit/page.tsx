import InboundShipmentForm from "../../InboundShipmentForm";

export default async function EditInboundShipmentPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const p = await params;

  return <InboundShipmentForm initialShipmentId={p.id} />;
}