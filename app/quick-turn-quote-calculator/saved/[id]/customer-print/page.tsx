// app/quick-turn-quote-calculator/saved/[id]/customer-print/page.tsx

import QuickTurnCustomerExportPrintClient from "../../../QuickTurnCustomerExportPrintClient";

export default async function QuickTurnCustomerExportPrintPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const p = await params;
  return <QuickTurnCustomerExportPrintClient id={p.id} />;
}
