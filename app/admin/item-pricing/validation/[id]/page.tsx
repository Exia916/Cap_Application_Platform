import ValidationRunRecordClient from "./ValidationRunRecordClient";

type PageProps = { params: Promise<{ id: string }> | { id: string } };

export default async function ItemPricingValidationRunPage({ params }: PageProps) {
  const resolved = await params;
  return <ValidationRunRecordClient id={resolved.id} />;
}
