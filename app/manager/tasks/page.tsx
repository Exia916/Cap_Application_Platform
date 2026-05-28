import Link from "next/link";
import TaskQueueClient from "@/app/platform/tasks/TaskQueueClient";

export default function ManagerTasksPage() {
  return (
    <div>
      <div
        className="page-shell-wide"
        style={{
          paddingBottom: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <Link href="/manager/tasks/aging" className="btn btn-secondary">
            Aging & Cleanup Review
          </Link>
        </div>
      </div>

      <TaskQueueClient
        scope="oversight"
        title="Task Oversight"
        subtitle="Manager, supervisor, and admin view of CAP tasks across users and departments."
      />
    </div>
  );
}