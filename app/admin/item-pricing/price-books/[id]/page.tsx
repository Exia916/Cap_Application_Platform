import PriceBookRecordClient from "./PriceBookRecordClient";

type PageProps = { params: Promise<{ id: string }> | { id: string } };

export default async function ItemPricingPriceBookRecordPage({ params }: PageProps) {
  const resolved = await params;
  return <PriceBookRecordClient id={resolved.id} />;
}
