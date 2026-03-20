import SalesOrdersClient from "./SalesOrdersClient";

type SalesOrdersPageProps = {
  searchParams: Promise<{
    so?: string;
  }>;
};

export default async function SalesOrdersPage({
  searchParams,
}: SalesOrdersPageProps) {
  const params = await searchParams;

  return <SalesOrdersClient initialSo={params.so ?? ""} />;
}