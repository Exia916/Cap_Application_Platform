import SampleEmbroideryForm from "@/components/production/SampleEmbroideryForm";

export default async function EditSampleEmbroideryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SampleEmbroideryForm mode="edit" id={id} />;
}