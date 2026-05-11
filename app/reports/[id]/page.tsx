import ReportRunnerClient from "../_components/ReportRunnerClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SavedReportRunPage({ params }: Props) {
  const { id } = await params;

  return (
    <main className="page-shell-wide">
      <ReportRunnerClient savedReportId={id} />
    </main>
  );
}