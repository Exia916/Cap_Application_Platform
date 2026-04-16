import DesignRequestWindow from "../../DesignRequestWindow";

export default async function EditDesignRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DesignRequestWindow mode="edit" requestId={id} />;
}