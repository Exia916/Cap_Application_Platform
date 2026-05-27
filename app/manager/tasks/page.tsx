import TaskQueueClient from "@/app/platform/tasks/TaskQueueClient";

export default function ManagerTasksPage() {
  return (
    <TaskQueueClient
      scope="oversight"
      title="Task Oversight"
      subtitle="Manager, supervisor, and admin view of CAP tasks across users and departments."
    />
  );
}