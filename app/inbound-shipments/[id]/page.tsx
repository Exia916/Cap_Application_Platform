import InboundShipmentRecordClient from "../InboundShipmentRecordClient";

export default async function InboundShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const p = await params;

  return <InboundShipmentRecordClient id={p.id} />;
}