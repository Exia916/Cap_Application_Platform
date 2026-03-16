// app/dashboard/page.tsx
import WelcomeCard from "./_components/WelcomeCard";
import QuickActionsCard from "./_components/QuickActionsCard";
import SalesOrderLookupCard from "@/components/home/SalesOrderLookupCard";

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <WelcomeCard />
      <QuickActionsCard />
      <SalesOrderLookupCard />
    </div>
  );
}