// app/sales-orders/page.tsx
"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type SbtSalesOrderCompany = {
  name?: string;
  addr1?: string;
  addr2?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
};

type SbtSalesOrderOrderInfo = {
  CompanyName?: string;
  FirstName?: string;
  LastName?: string;
  Address1?: string;
  Address2?: string;
  City?: string;
  State?: string;
  ZipCode?: string;
  PhoneNumber?: string;
  EmailId?: string;
};

type SbtSalesOrderShippingInfo = {
  ShippingCompanyName?: string;
  ShippingFirstName?: string;
  ShippingLastName?: string;
  ShippingAddress1?: string;
  ShippingAddress2?: string;
  ShippingCity?: string;
  ShippingState?: string;
  ShippingZip?: string;
  ShippingPhone?: string;
  ShippingEmailId?: string;
  FreightMethodName?: string;
  AdditonalDeliveryInstruction?: string;
  AdditionalDeliveryInstruction?: string;
};

type SbtSalesOrderWeb = {
  custNo?: string;
  poNumber?: {
    PoNumber?: string;
  };
  orderInfo?: SbtSalesOrderOrderInfo;
  shippingInfo?: SbtSalesOrderShippingInfo;
};

type SbtSalesOrderItem = {
  qty?: number;
  minQty?: number;
  maxQty?: number;
  sku?: string;
  description?: string;
  uom?: string;
  stockitem?: string;
  defaultbin?: string;
  rqdate?: string;
  shipdate?: string;
};

type SbtSalesOrderDecoration = {
  sono?: string;
  lineNo?: number;
  decoNo?: number | string;
  sortCode?: string;
  colors?: number | string;
  dcType?: string;
  dcLocation?: string;
  tapeName?: string;
  tapeNo?: string;
  stCount?: number;
  prevSono?: string | number;
  prevLine?: number;
  prevDeco?: number;
  wChange?: string;
  provided?: string;
  inHouse?: string;
  tallEt?: string;
  addUser?: string;
  addDate?: string;
  addTime?: string;
  lckStat?: string;
  lckUser?: string;
  lckDate?: string;
  lckTime?: string;
  descrip?: string;
  preClose?: string;
  dcStat?: string;
  knitLines?: number;
};

type SbtSalesOrderInfo = {
  orderDate?: string;
  enteredBy?: string;
  csRep?: string;
  industry?: string;
  event?: string;
  soStat?: string;
  type?: string;
  custType?: string;
  shipVia?: string;
  terms?: string;
  salesperson?: string;
  commissionRate?: string;
  taxCode?: string;
  source?: string;
  printcapa?: string;
  note1?: string;
  note2?: string;
  note3?: string;
  comments?: string[];
  items?: SbtSalesOrderItem[];
};

type SbtSalesOrderPrintFlags = {
  sono?: string;
  custOrig?: number;
  warehouse?: number;
  premiumLin?: number;
  cutting?: number;
  manufactur?: number;
  embroidery?: number;
  print?: number;
  shipping?: number;
  sample?: number;
  sampleEmb?: number;
  knitDept?: number;
  pdf?: number;
  mfgForKnts?: number;
  shipSamp?: number;
  report?: number;
};

type SbtSalesOrderData = {
  sono?: string;
  company?: SbtSalesOrderCompany;
  web?: SbtSalesOrderWeb;
  sbtOrderInfo?: SbtSalesOrderInfo;
  sodeco?: SbtSalesOrderDecoration[];
  print?: SbtSalesOrderPrintFlags;
};

type LookupResponse = {
  success: boolean;
  salesOrderBase: string;
  salesOrderDisplay: string;
  requestedSalesOrder: string;
  printUrl: string;
  data: SbtSalesOrderData;
};

function line(label: string, value?: string | number | null) {
  if (value == null || value === "") return null;
  return (
    <div className="so-kv-row" key={label}>
      <div className="so-kv-label">{label}</div>
      <div className="so-kv-value">{String(value)}</div>
    </div>
  );
}

function formatName(company?: string, first?: string, last?: string) {
  const direct = String(company || "").trim();
  if (direct) return direct;

  const joined = [first, last].map((v) => String(v || "").trim()).filter(Boolean).join(" ");
  return joined || "";
}

function decorationsForLine(rows: SbtSalesOrderDecoration[] | undefined, lineNo: number) {
  if (!Array.isArray(rows)) return [];
  return rows.filter((x) => Number(x?.lineNo) === lineNo);
}

function yesNoFlag(v?: number | string | null) {
  return String(v ?? "") === "1" ? "Yes" : "No";
}

export default function SalesOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialSo = (searchParams.get("so") || "").trim();

  const [salesOrderInput, setSalesOrderInput] = useState(initialSo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResponse | null>(null);

  const items = result?.data?.sbtOrderInfo?.items || [];
  const comments = result?.data?.sbtOrderInfo?.comments || [];
  const decorations = result?.data?.sodeco || [];
  const printFlags = result?.data?.print;

  const pageTitle = useMemo(() => {
    if (!result?.salesOrderBase) return "Sales Order Lookup";
    return `Sales Order ${result.salesOrderBase}`;
  }, [result?.salesOrderBase]);

  async function runLookup(so: string) {
    const trimmed = so.trim();

    if (!trimmed) {
      setError("Enter a Sales Order number.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/sales-orders/lookup?so=${encodeURIComponent(trimmed)}`, {
        credentials: "include",
        cache: "no-store",
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body?.error || "Failed to load Sales Order.");
      }

      setResult(body as LookupResponse);
      router.replace(`/sales-orders?so=${encodeURIComponent(trimmed)}`);
    } catch (e: any) {
      setResult(null);
      setError(e?.message || "Failed to load Sales Order.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void runLookup(salesOrderInput);
  }

  useEffect(() => {
    if (!initialSo) return;
    void runLookup(initialSo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const billTo = result?.data?.web?.orderInfo;
  const shipTo = result?.data?.web?.shippingInfo;
  const company = result?.data?.company;
  const order = result?.data?.sbtOrderInfo;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">{pageTitle}</h1>
          <p className="page-subtitle">
            Search by Sales Order number to pull live order information from SBT.
          </p>
        </div>

        <div className="so-action-row">
          <Link href="/" className="btn btn-secondary">
            Back Home
          </Link>

          {result?.printUrl ? (
            <Link
              href={result.printUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
            >
              Open Print-Friendly View
            </Link>
          ) : null}
        </div>
      </div>

      <div className="section-stack">
        <div className="card card-lg">
          <form className="so-lookup-form" onSubmit={onSubmit}>
            <div className="so-lookup-input-wrap">
              <label className="field-label" htmlFor="salesOrderInput">
                Sales Order Number
              </label>
              <input
                id="salesOrderInput"
                className="input"
                value={salesOrderInput}
                onChange={(e) => setSalesOrderInput(e.target.value)}
                placeholder="Enter sales order (example: 2974411 or 2974411.01)"
                autoComplete="off"
              />
              <div className="field-help">
                The first 7 digits are used as the canonical Sales Order lookup value.
              </div>
            </div>

            <div className="so-lookup-button-wrap">
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                {loading ? "Searching..." : "Search"}
              </button>
            </div>
          </form>

          {error ? <div className="alert alert-danger so-alert-spacer">{error}</div> : null}
        </div>

        {!loading && !error && !result ? (
          <div className="card">
            <div className="text-muted">
              Enter a Sales Order number above to load order details, comments, and decoration information.
            </div>
          </div>
        ) : null}

        {result ? (
          <>
            <div className="so-summary-grid">
              <div className="card">
                <div className="section-card-header">
                  <strong>Order Summary</strong>
                  <span className="badge badge-brand-blue">{result.salesOrderBase}</span>
                </div>

                <div className="so-kv-list">
                  {line("Sales Order", result.data?.sono || result.salesOrderDisplay)}
                  {line("SO Status", order?.soStat)}
                  {line("Customer Number", result.data?.web?.custNo)}
                  {line("PO Number", result.data?.web?.poNumber?.PoNumber)}
                  {line("Order Date", order?.orderDate)}
                  {line("Entered By", order?.enteredBy)}
                  {line("CS Rep", order?.csRep)}
                  {line("Industry", order?.industry)}
                  {line("Event", order?.event)}
                  {line("Customer Type", order?.custType)}
                  {line("Type", order?.type)}
                  {line("Ship Via", order?.shipVia)}
                  {line("Terms", order?.terms)}
                  {line("Salesperson", order?.salesperson)}
                  {line("Commission Rate", order?.commissionRate)}
                  {line("Tax Code", order?.taxCode)}
                </div>
              </div>

              <div className="card">
                <div className="section-card-header">
                  <strong>Cap America Info</strong>
                </div>

                <div className="so-kv-list">
                  {line("Company", company?.name)}
                  {line("Address 1", company?.addr1)}
                  {line("Address 2", company?.addr2)}
                  {line("City", [company?.city, company?.state, company?.zip].filter(Boolean).join(", "))}
                  {line("Phone", company?.phone)}
                </div>
              </div>
            </div>

            <div className="so-detail-grid">
              <div className="card">
                <div className="section-card-header">
                  <strong>Bill To</strong>
                </div>

                <div className="so-kv-list">
                  {line(
                    "Name",
                    formatName(billTo?.CompanyName, billTo?.FirstName, billTo?.LastName)
                  )}
                  {line("Address 1", billTo?.Address1)}
                  {line("Address 2", billTo?.Address2)}
                  {line("City / State / Zip", [billTo?.City, billTo?.State, billTo?.ZipCode].filter(Boolean).join(", "))}
                  {line("Phone", billTo?.PhoneNumber)}
                  {line("Email", billTo?.EmailId)}
                </div>
              </div>

              <div className="card">
                <div className="section-card-header">
                  <strong>Ship To</strong>
                </div>

                <div className="so-kv-list">
                  {line(
                    "Name",
                    formatName(
                      shipTo?.ShippingCompanyName,
                      shipTo?.ShippingFirstName,
                      shipTo?.ShippingLastName
                    )
                  )}
                  {line("Address 1", shipTo?.ShippingAddress1)}
                  {line("Address 2", shipTo?.ShippingAddress2)}
                  {line(
                    "City / State / Zip",
                    [shipTo?.ShippingCity, shipTo?.ShippingState, shipTo?.ShippingZip].filter(Boolean).join(", ")
                  )}
                  {line("Phone", shipTo?.ShippingPhone)}
                  {line("Email", shipTo?.ShippingEmailId)}
                  {line("Freight Method", shipTo?.FreightMethodName)}
                  {line(
                    "Delivery Instructions",
                    shipTo?.AdditonalDeliveryInstruction || shipTo?.AdditionalDeliveryInstruction
                  )}
                </div>
              </div>
            </div>

            <div className="table-card">
              <div className="section-card-header so-card-header-pad">
                <strong>Item Detail</strong>
                <span className="badge badge-neutral">{items.length} line(s)</span>
              </div>

              <div className="table-scroll">
                <table className="table-clean table-lines-strong">
                  <thead>
                    <tr>
                      <th>Line</th>
                      <th>Qty</th>
                      <th>Min Qty</th>
                      <th>Max Qty</th>
                      <th>SKU</th>
                      <th>Description</th>
                      <th>UOM</th>
                      <th>Default Bin</th>
                      <th>Stock Item</th>
                      <th>Anticipated Ship Date</th>
                      <th>Actual Ship Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="text-muted">
                          No item rows were returned.
                        </td>
                      </tr>
                    ) : (
                      items.map((item, idx) => (
                        <tr key={`${item.sku || "line"}-${idx}`} className="dt-row">
                          <td>{idx + 1}</td>
                          <td>{item.qty ?? ""}</td>
                          <td>{item.minQty ?? ""}</td>
                          <td>{item.maxQty ?? ""}</td>
                          <td>{item.sku || ""}</td>
                          <td>{item.description || ""}</td>
                          <td>{item.uom || ""}</td>
                          <td>{item.defaultbin || ""}</td>
                          <td>{item.stockitem || ""}</td>
                          <td>{item.rqdate || ""}</td>
                          <td>{item.shipdate || ""}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="section-card-header">
                <strong>Decoration Detail</strong>
                <span className="badge badge-neutral">{decorations.length} decoration row(s)</span>
              </div>

              {items.length === 0 && decorations.length === 0 ? (
                <div className="text-muted">No decoration detail was returned.</div>
              ) : (
                <div className="section-stack">
                  {items.map((item, idx) => {
                    const lineNo = idx + 1;
                    const lineDecorations = decorationsForLine(decorations, lineNo);

                    return (
                      <div className="muted-box" key={`deco-line-${lineNo}`}>
                        <div className="section-card-header">
                          <strong>
                            Line {lineNo} {item.sku ? `- ${item.sku}` : ""}
                          </strong>
                          <span className="badge badge-brand-blue">
                            {lineDecorations.length} decoration(s)
                          </span>
                        </div>

                        {lineDecorations.length === 0 ? (
                          <div className="text-muted">No decorations for this line.</div>
                        ) : (
                          <div className="section-stack">
                            {lineDecorations.map((deco, decoIdx) => (
                              <div className="card so-inner-card" key={`deco-${lineNo}-${decoIdx}`}>
                                <div className="so-kv-list">
                                  {line("Decoration No", deco.decoNo)}
                                  {line("Sort Code", deco.sortCode)}
                                  {line("Colors", deco.colors)}
                                  {line("Type", deco.dcType)}
                                  {line("Location", deco.dcLocation)}
                                  {line("Tape Name", deco.tapeName)}
                                  {line("Tape No", deco.tapeNo)}
                                  {line("Stitch Count", deco.stCount)}
                                  {line("Previous SO", deco.prevSono)}
                                  {line("Previous Line", deco.prevLine)}
                                  {line("Previous Deco", deco.prevDeco)}
                                  {line("With Change", deco.wChange)}
                                  {line("Provided", deco.provided)}
                                  {line("In House", deco.inHouse)}
                                  {line("Tall ET", deco.tallEt)}
                                  {line("Added By", deco.addUser)}
                                  {line("Added Date", deco.addDate)}
                                  {line("Added Time", deco.addTime)}
                                  {line("Lock Status", deco.lckStat)}
                                  {line("Lock User", deco.lckUser)}
                                  {line("Lock Date", deco.lckDate)}
                                  {line("Lock Time", deco.lckTime)}
                                  {line("Pre Close", deco.preClose)}
                                  {line("DC Status", deco.dcStat)}
                                  {line("Knit Lines", deco.knitLines)}
                                  {line("Description", deco.descrip)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="so-detail-grid">
              <div className="card">
                <div className="section-card-header">
                  <strong>Comments</strong>
                </div>

                {comments.length === 0 ? (
                  <div className="text-muted">No comments were returned.</div>
                ) : (
                  <ul className="so-list">
                    {comments.map((comment, idx) => (
                      <li key={`comment-${idx}`}>{comment}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="card">
                <div className="section-card-header">
                  <strong>Order Notes</strong>
                </div>

                <div className="so-kv-list">
                  {line("Note 1", order?.note1)}
                  {line("Note 2", order?.note2)}
                  {line("Note 3", order?.note3)}
                  {line("Print Cap A", order?.printcapa)}
                  {line("Source", order?.source)}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="section-card-header">
                <strong>Print Routing</strong>
              </div>

              <div className="so-summary-grid">
                <div className="so-kv-list">
                  {line("Customer Original", yesNoFlag(printFlags?.custOrig))}
                  {line("Warehouse", yesNoFlag(printFlags?.warehouse))}
                  {line("Premium Line", yesNoFlag(printFlags?.premiumLin))}
                  {line("Cutting", yesNoFlag(printFlags?.cutting))}
                  {line("Manufacturing", yesNoFlag(printFlags?.manufactur))}
                  {line("Embroidery", yesNoFlag(printFlags?.embroidery))}
                  {line("Print", yesNoFlag(printFlags?.print))}
                  {line("Shipping", yesNoFlag(printFlags?.shipping))}
                </div>

                <div className="so-kv-list">
                  {line("Sample", yesNoFlag(printFlags?.sample))}
                  {line("Sample Emb", yesNoFlag(printFlags?.sampleEmb))}
                  {line("Knit Dept", yesNoFlag(printFlags?.knitDept))}
                  {line("PDF", yesNoFlag(printFlags?.pdf))}
                  {line("Mfg For Knits", yesNoFlag(printFlags?.mfgForKnts))}
                  {line("Ship Sample", yesNoFlag(printFlags?.shipSamp))}
                  {line("Report", yesNoFlag(printFlags?.report))}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}