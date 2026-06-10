import DesignLookupClient from "./DesignLookupClient";

export const metadata = {
  title: "Design Lookup | CAP",
};

type DesignLookupPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export default async function DesignLookupPage({ searchParams }: DesignLookupPageProps) {
  const params = await searchParams;

  const initialSearch =
    firstParam(params?.name).trim() ||
    firstParam(params?.q).trim() ||
    "";

  return <DesignLookupClient initialSearch={initialSearch} />;
}