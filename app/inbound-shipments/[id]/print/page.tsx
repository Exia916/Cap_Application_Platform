import InboundShipmentPrintClient from "../../InboundShipmentPrintClient";

export default async function InboundShipmentPrintPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const p = await params;

  return <InboundShipmentPrintClient id={p.id} />;
}