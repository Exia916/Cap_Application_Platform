// app/quick-turn-quote-calculator/saved/[id]/page.tsx

import SavedQuickTurnQuoteClient from "../../SavedQuickTurnQuoteClient";

export default async function SavedQuickTurnQuotePage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const p = await params;
  return <SavedQuickTurnQuoteClient id={p.id} />;
}
