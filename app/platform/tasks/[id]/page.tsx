import TaskDetailClient from "./TaskDetailClient";

export default async function PlatformTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <TaskDetailClient taskId={id} />;
}