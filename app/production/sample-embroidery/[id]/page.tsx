import SampleEmbroideryRecordClient from "./SampleEmbroideryRecordClient";

export default async function SampleEmbroideryRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SampleEmbroideryRecordClient id={id} />;
}