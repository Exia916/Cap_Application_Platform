import TaskQueueClient from "@/app/platform/tasks/TaskQueueClient";

export default function MyWorkPage() {
  return (
    <TaskQueueClient
      scope="mine"
      title="My Work"
      subtitle="Tasks assigned directly to you, your role, or your department."
    />
  );
}