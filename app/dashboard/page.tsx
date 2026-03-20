import WelcomeCard from "./_components/WelcomeCard";
import QuickActionsCard from "./_components/QuickActionsCard";
import WorkAreasCard from "./_components/WorkAreasCard";
import MyWorkCard from "./_components/MyWorkCard";
import SalesOrderLookupCard from "@/components/home/SalesOrderLookupCard";

export default function DashboardPage() {
  return (
    <div className="page-shell-wide">
      <div
        style={{
          display: "grid",
          gap: 16,
        }}
      >
        <WelcomeCard />

        <div className="dashboard-home-two-col">
          <QuickActionsCard />
          <MyWorkCard />
        </div>

        <SalesOrderLookupCard />

        <WorkAreasCard />
      </div>
    </div>
  );
}