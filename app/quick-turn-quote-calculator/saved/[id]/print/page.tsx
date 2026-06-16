// app/quick-turn-quote-calculator/saved/[id]/print/page.tsx

import SavedQuickTurnQuotePrintClient from "../../../SavedQuickTurnQuotePrintClient";

export default async function SavedQuickTurnQuotePrintPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const p = await params;
  return <SavedQuickTurnQuotePrintClient id={p.id} />;
}
