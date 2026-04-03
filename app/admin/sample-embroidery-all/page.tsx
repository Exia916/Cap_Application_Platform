import SampleEmbroideryAllTable from "./SampleEmbroideryAllTable";

function ymdChicago(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mm = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";

  return `${yyyy}-${mm}-${dd}`;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function getRangeLastNDays(n: number) {
  const today = new Date();
  return {
    from: ymdChicago(addDays(today, -(n - 1))),
    to: ymdChicago(today),
  };
}

export default function SampleEmbroideryAllPage() {
  const def = getRangeLastNDays(30);

  return (
    <div className="page-shell-table">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sample Embroidery — All</h1>
          <p className="page-subtitle">
            Manager/admin list for all Sample Embroidery entries by shift date.
          </p>
        </div>
      </div>

      <SampleEmbroideryAllTable defaultStart={def.from} defaultEnd={def.to} />
    </div>
  );
}