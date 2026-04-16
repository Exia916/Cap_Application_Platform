import DesignRequestWindow from "../DesignRequestWindow";

export default async function DesignRequestViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DesignRequestWindow mode="view" requestId={id} />;
}