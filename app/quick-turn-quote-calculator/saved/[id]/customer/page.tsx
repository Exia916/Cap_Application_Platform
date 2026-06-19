// app/quick-turn-quote-calculator/saved/[id]/customer/page.tsx

import QuickTurnCustomerExportSetupClient from "../../../QuickTurnCustomerExportSetupClient";

export default async function QuickTurnCustomerExportSetupPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const p = await params;
  return <QuickTurnCustomerExportSetupClient id={p.id} />;
}
