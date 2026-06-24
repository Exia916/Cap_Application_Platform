import ValidationListClient from "./ValidationListClient";

type PageProps = {
  searchParams?: Promise<{ priceBookId?: string }> | { priceBookId?: string };
};

export default async function ItemPricingValidationPage({ searchParams }: PageProps) {
  const resolved = searchParams ? await searchParams : {};
  return <ValidationListClient initialPriceBookId={resolved.priceBookId || ""} />;
}
