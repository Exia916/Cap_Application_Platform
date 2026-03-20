"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";

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

function safe(value?: string | number | null) {
  return value == null ? "" : String(value);
}

function formatName(company?: string, first?: string, last?: string) {
  const direct = String(company || "").trim();
  if (direct) return direct;
  return [first, last].map((v) => String(v || "").trim()).filter(Boolean).join(" ");
}

function cityStateZip(city?: string, state?: string, zip?: string) {
  const left = [city, state].filter(Boolean).join(", ");
  return [left, zip].filter(Boolean).join(" ");
}

function formatNumber(v?: number | string | null) {
  if (v == null || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString("en-US");
}

function decorationsForLine(rows: SbtSalesOrderDecoration[] | undefined, lineNo: number) {
  if (!Array.isArray(rows)) return [];
  return rows.filter((x) => Number(x?.lineNo) === lineNo);
}

function lineBarcode(sono: string, idx: number) {
  return `*${sono}.${String(idx + 1).padStart(3, "0")}*`;
}

function tapeBarcodeValue(tapeNo?: string) {
  if (!tapeNo) return "";
  return `*$DOWNLOAD$${tapeNo}$OK$*`;
}

function cleanedDescription(value?: string) {
  return safe(value).replace(/\uFFFD/g, "");
}

export default function SalesOrderPrintPage({
  params,
}: {
  params: Promise<{ salesOrder: string }>;
}) {
  const resolvedParams = use(params);
  const salesOrder = decodeURIComponent(resolvedParams.salesOrder || "").trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResponse | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/sales-orders/lookup?so=${encodeURIComponent(salesOrder)}`, {
          credentials: "include",
          cache: "no-store",
        });

        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(body?.error || "Failed to load Sales Order.");
        }

        if (!alive) return;
        setResult(body as LookupResponse);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load Sales Order.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [salesOrder]);

  const printDate = useMemo(() => new Date().toLocaleString(), []);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div>Loading print view…</div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ color: "#b91c1c", marginBottom: 12 }}>
          {error || "Unable to load Sales Order."}
        </div>
        <Link href="/sales-orders">Back to Sales Order Lookup</Link>
      </div>
    );
  }

  const data = result.data;
  const company = data.company || {};
  const web = data.web || {};
  const orderInfo = web.orderInfo || {};
  const shippingInfo = web.shippingInfo || {};
  const sbtOrderInfo = data.sbtOrderInfo || {};
  const items = sbtOrderInfo.items || [];
  const comments = sbtOrderInfo.comments || [];
  const printFlags = data.print || {};
  const sono = safe(data.sono || result.salesOrderBase);

  return (
    <>
      <style jsx global>{`
        @page {
          size: Letter;
          margin: 0.25in;
        }

        body {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 12px;
          color: #000;
          background: #fff;
        }

        .so-print-screen {
          padding: 18px;
          background: #f5f5f5;
          min-height: 100vh;
        }

        .so-print-toolbar {
          max-width: 980px;
          margin: 0 auto 14px auto;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .so-toolbar-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 36px;
          padding: 0 14px;
          border-radius: 8px;
          border: 1px solid #cfcfcf;
          background: #fff;
          color: #111;
          text-decoration: none;
          font-weight: 600;
          cursor: pointer;
        }

        .so-toolbar-btn-primary {
          background: #1f4ea3;
          border-color: #1f4ea3;
          color: #fff;
        }

        .so-print-root {
          max-width: 980px;
          margin: 0 auto;
          background: #fff;
        }

        .so-page {
          page-break-after: always;
          break-after: page;
          padding: 0;
        }

        .so-page:last-child {
          page-break-after: auto;
          break-after: auto;
        }

        .so-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
        }

        .so-mt10 {
          margin-top: 10px;
        }

        .so-mb20 {
          margin-bottom: 20px;
        }

        .so-w50 {
          width: 50%;
        }

        .so-w50p {
          width: calc(50% - 2px);
        }

        .so-inline {
          display: inline-block;
        }

        .so-left {
          text-align: left;
        }

        .so-right {
          text-align: right;
        }

        .so-center {
          text-align: center;
        }

        .so-bold {
          font-weight: bold;
        }

        .so-page h1,
        .so-page h2,
        .so-page h3 {
          font-weight: 900;
          margin-top: 0;
          margin-bottom: 0;
        }

        .so-page h1 {
          font-size: 34px;
          line-height: 1.1;
        }

        .so-page h2 {
          font-size: 28px;
          line-height: 1.1;
        }

        .so-barcode {
          font-family: "Libre Barcode 39", Arial, Helvetica, sans-serif;
          font-size: 30px;
          line-height: 40px;
          transform: scale(1, 2);
        }

        .so-tape-barcode {
          font-family: "Libre Barcode 39", Arial, Helvetica, sans-serif;
          font-size: 30px;
          line-height: 40px;
          transform: scale(1, 2);
          margin-top: 20px;
          width: fit-content;
        }

        .so-tape-number {
          background: #fff;
          margin-top: -22px;
          margin-left: 84px;
          z-index: 2;
          position: relative;
          width: fit-content;
        }

        .so-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 12px;
        }

        .so-table th,
        .so-table td {
          border: 1px solid #000;
          padding: 6px;
          vertical-align: middle;
          font-weight: 400;
        }

        .so-table thead {
          display: table-header-group;
        }

        .so-table tfoot {
          display: table-footer-group;
        }

        .so-table tr {
          page-break-inside: avoid;
        }

        .so-decorations {
          margin-left: -190px;
          margin-top: 15px;
          font-size: 14px;
        }

        .so-item-cell {
          height: 410px;
          vertical-align: top !important;
        }

        .so-comments-cell {
          height: 100px;
          vertical-align: top !important;
        }

        .so-screen-only {
          display: block;
        }

        @media print {
          body {
            background: #fff;
          }

          .so-print-screen {
            padding: 0;
            background: #fff;
          }

          .so-print-toolbar,
          nav,
          header {
            display: none !important;
          }

          .so-print-root {
            max-width: none;
            margin: 0;
          }

          .so-decorations {
            margin-left: -90px;
            margin-top: 15px;
            font-size: 14px;
          }

          .so-screen-only {
            display: none !important;
          }
        }
      `}</style>

      <div className="so-print-screen">
        <div className="so-print-toolbar so-screen-only">
          <Link
            href={`/sales-orders?so=${encodeURIComponent(result.salesOrderBase)}`}
            className="so-toolbar-btn"
          >
            Back to Lookup
          </Link>
          <button
            type="button"
            className="so-toolbar-btn so-toolbar-btn-primary"
            onClick={() => window.print()}
          >
            Print
          </button>
        </div>

        <div className="so-print-root">
          {items.map((it, idx) => {
            const lineDecorations = decorationsForLine(data.sodeco, idx + 1);

            return (
              <div className="so-page" key={`page-${idx}`}>
                <div className="so-row">
                  <div>
                    <h1>Cap America, Inc.</h1>
                  </div>
                  <div>
                    <h2>Sales Order</h2>
                  </div>
                  <div className="so-center">
                    <h1>{sono}</h1>
                    <div className="so-barcode">{lineBarcode(sono, idx)}</div>
                  </div>
                </div>

                <div className="so-row">
                  <div>
                    <div style={{ marginTop: 6 }}>
                      <b>{safe(company.name)}</b>
                    </div>
                    <div>{safe(company.addr1)}</div>
                    <div>{safe(company.addr2)}</div>
                    <div>{cityStateZip(company.city, company.state, company.zip)}</div>
                    <div>{safe(company.phone)}</div>
                  </div>

                  <div className="so-right">
                    <div><b>Customer Order Date: {safe(sbtOrderInfo.orderDate)}</b></div>
                    <div><b>Date Entered: {safe(sbtOrderInfo.orderDate)}</b></div>
                    <div><b>Order entered by: {safe(sbtOrderInfo.enteredBy)}</b></div>
                    <div><b>CS Rep: {safe(sbtOrderInfo.csRep)}</b></div>
                    <div><b>SO Status: {safe(sbtOrderInfo.soStat)}</b></div>
                    <div><b>Industry: {safe(sbtOrderInfo.industry)}</b></div>
                    <div><b>Event: {safe(sbtOrderInfo.event)}</b></div>
                  </div>
                </div>

                <div className="so-row so-mt10">
                  <div className="so-w50">
                    <div><b>Bill To</b></div>
                    <div>{formatName(orderInfo.CompanyName, orderInfo.FirstName, orderInfo.LastName)}</div>
                    <div>{safe(orderInfo.Address1)}</div>
                    {orderInfo.Address2 ? <div>{orderInfo.Address2}</div> : null}
                    <div>{cityStateZip(orderInfo.City, orderInfo.State, orderInfo.ZipCode)}</div>
                    <div>{safe(orderInfo.PhoneNumber)}</div>
                    <div>{safe(orderInfo.EmailId)}</div>
                  </div>

                  <div className="so-w50">
                    <div><b>Ship To</b></div>
                    <div>
                      {formatName(
                        shippingInfo.ShippingCompanyName,
                        shippingInfo.ShippingFirstName,
                        shippingInfo.ShippingLastName
                      )}
                    </div>
                    <div>{safe(shippingInfo.ShippingAddress1)}</div>
                    {shippingInfo.ShippingAddress2 ? <div>{shippingInfo.ShippingAddress2}</div> : null}
                    <div>
                      {cityStateZip(
                        shippingInfo.ShippingCity,
                        shippingInfo.ShippingState,
                        shippingInfo.ShippingZip
                      )}
                    </div>
                    <div>{safe(shippingInfo.ShippingPhone)}</div>
                    <div>{safe(shippingInfo.ShippingEmailId)}</div>
                    <div>Ship Via: {safe(shippingInfo.FreightMethodName)}</div>
                  </div>
                </div>

                <div className="so-row">
                  <div className="so-w50p so-inline so-left so-bold">
                    {printFlags.warehouse === 1 ? "WAREHOUSE COPY" : ""}
                  </div>
                  <div className="so-w50p so-inline so-right so-bold">
                    {safe(sbtOrderInfo.custType)}
                  </div>
                </div>

                <table className="so-table">
                  <thead>
                    <tr>
                      <th colSpan={2}>
                        Customer
                        <br />
                        <br />
                        {safe(web.custNo)}
                      </th>
                      <th colSpan={3} style={{ width: 80 }}>
                        Ship Via
                        <br />
                        <br />
                        {safe(sbtOrderInfo.shipVia)}
                      </th>
                      <th style={{ width: 80 }}>
                        Pack
                        <br />
                        <br />
                      </th>
                      <th colSpan={2} style={{ width: 80 }}>
                        Terms
                        <br />
                        <br />
                        {safe(sbtOrderInfo.terms)}
                      </th>
                      <th colSpan={2} style={{ width: 80 }}>
                        Purchase Order Number
                        <br />
                        <br />
                        {safe(web.poNumber?.PoNumber)}
                      </th>
                      <th style={{ width: 80 }}>
                        Salesperson
                        <br />
                        <br />
                        {safe(sbtOrderInfo.salesperson)}&nbsp;&nbsp;{safe(sbtOrderInfo.commissionRate)}
                      </th>
                      <th style={{ width: 80 }}>
                        Reference No.
                        <br />
                        <br />
                        &nbsp;
                      </th>
                    </tr>
                    <tr>
                      <th colSpan={3} style={{ width: 70 }}>
                        Qty. Ordered
                      </th>
                      <th colSpan={6} className="so-left">
                        Item Number
                        <hr />
                        Item Description
                      </th>
                      <th style={{ width: 90 }}>Unit of Measure</th>
                      <th style={{ width: 110 }}>Tax</th>
                      <th>Extended Price</th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td
                        colSpan={3}
                        style={{
                          padding: 0,
                          borderRightStyle: "hidden",
                          verticalAlign: "top",
                        }}
                      >
                        <div className="so-mt10">
                          <div className="so-w50p so-center so-inline">{safe(it.qty)}</div>
                          <div className="so-w50p so-center so-inline">0</div>
                        </div>
                        <div className="so-mt10">
                          <div className="so-w50p so-center so-inline"><b>Min Qty</b></div>
                          <div className="so-w50p so-center so-inline"><b>Max Qty</b></div>
                        </div>
                        <div className="so-mt10">
                          <div className="so-w50p so-center so-inline">{safe(it.minQty)}</div>
                          <div className="so-w50p so-center so-inline">{safe(it.maxQty)}</div>
                        </div>
                      </td>

                      <td
                        colSpan={6}
                        className="so-mb20 so-item-cell"
                        style={{ verticalAlign: "top" }}
                      >
                        <div className="so-w50p so-inline so-left">
                          <b>{safe(it.sku)}</b>
                        </div>
                        <div className="so-w50p so-inline so-right">
                          <b>{safe(sbtOrderInfo.orderDate)}</b>
                        </div>

                        <div>
                          {safe(it.description)}
                          <br />
                          <br />
                        </div>

                        <div>
                          DETAIL NO.{idx + 1}
                          <br />
                          <br />
                        </div>

                        <div><b>RQ DATE:</b> {safe(it.rqdate)}</div>
                        <div><b>SHIP DATE:</b> {safe(it.shipdate)}</div>
                        <br />

                        {it.stockitem ? (
                          <div className="so-bold">STOCK ITEM:{safe(it.stockitem)}</div>
                        ) : null}

                        <div className="so-bold">BIN: {safe(it.defaultbin)}</div>

                        {sbtOrderInfo.source === "NO5BS" ? (
                          <div className="so-bold">
                            * * IF THIS ORDER INCLUDES EMBROIDERY RUN AT CAP AMERICA ONLY * *
                          </div>
                        ) : null}

                        {web.custNo === "814G01" && orderInfo.Address1 === "Cintas" ? (
                          <div className="so-bold">* * DO NOT SHIP LESS THAN ORDER AMOUNT * *</div>
                        ) : null}

                        {it.stockitem && safe(it.sku).startsWith("7V") ? (
                          <div className="so-bold">(SWITCH LABEL TO VERNON # 4199)</div>
                        ) : null}

                        {sbtOrderInfo.printcapa === "N" ? (
                          <div className="so-bold">
                            ** DO NOT PRINT CAP A ON ANYTHING - INCLUDING SHIPPING LABELS **
                          </div>
                        ) : null}

                        {orderInfo.Address1 === "VF" ? (
                          <div className="so-bold">
                            * * (VF Imagewear) IF THIS ORDER INCLUDES EMBROIDERY RUN AT CAP AMERICA ONLY * *
                          </div>
                        ) : null}

                        {safe(it.sku).startsWith("7V474") || safe(it.sku).startsWith("7V475") ? (
                          <div className="so-bold">* * USE LABEL # 1697 * *</div>
                        ) : null}

                        {sbtOrderInfo.custType === "SPG" ? (
                          <div className="so-bold">
                            * * MUST SHIP EXACT QTY AT NO ADDITIONAL CHARGE - NO OVERS OR UNDERS * *
                          </div>
                        ) : null}

                        {sbtOrderInfo.note1 ? <div className="so-bold">{sbtOrderInfo.note1}</div> : null}
                        {sbtOrderInfo.note2 ? <div className="so-bold">{sbtOrderInfo.note2}</div> : null}
                        {sbtOrderInfo.note3 ? <div className="so-bold">{sbtOrderInfo.note3}</div> : null}

                        {lineDecorations.length > 0 ? (
                          <>
                            <div className="so-bold so-decorations">DECORATIONS</div>
                            {lineDecorations.map((deco, decoIdx) => {
                              const stitchTotal =
                                deco.stCount != null && it.qty != null
                                  ? Number(deco.stCount) * Number(it.qty)
                                  : null;
                              const tapeValue = tapeBarcodeValue(safe(deco.tapeNo));

                              return (
                                <div key={`deco-${idx}-${decoIdx}`}>
                                  <div className="so-bold">
                                    <u>
                                      {safe(deco.decoNo)}) {safe(deco.colors)} COLOR {safe(deco.dcType)} -{" "}
                                      {safe(deco.dcLocation)}
                                    </u>
                                  </div>
                                  <div>TAPE NAME: {safe(deco.tapeName)}</div>
                                  {deco.sortCode ? <div>SORT CODE: {safe(deco.sortCode)}</div> : null}

                                  {deco.stCount ? (
                                    <>
                                      <div>STITCH COUNT: {formatNumber(deco.stCount)}</div>
                                      <div>
                                        ST. COUNT ({formatNumber(deco.stCount)}) x ORDER QTY (
                                        {formatNumber(it.qty)}) = {formatNumber(stitchTotal)}
                                      </div>
                                    </>
                                  ) : null}

                                  {deco.tapeNo ? <div>TAPE NO.: {safe(deco.tapeNo)}</div> : null}

                                  {deco.prevSono ? (
                                    <div>
                                      SAME AS {safe(deco.prevSono)}.
                                      {deco.prevLine != null ? String(deco.prevLine).padStart(3, "0") : ""}
                                      {deco.prevDeco != null && deco.prevDeco !== 0
                                        ? ` / DECO ${safe(deco.prevDeco)}`
                                        : ""}
                                    </div>
                                  ) : null}

                                  {deco.addUser || deco.addDate || deco.addTime ? (
                                    <div>
                                      ADDED: {safe(deco.addUser)} {safe(deco.addDate)} {safe(deco.addTime)}
                                    </div>
                                  ) : null}

                                  {deco.lckUser || deco.lckDate || deco.lckTime ? (
                                    <div>
                                      LOCK: {safe(deco.lckUser)} {safe(deco.lckDate)} {safe(deco.lckTime)}
                                    </div>
                                  ) : null}

                                  {deco.dcStat ? <div>DC STATUS: {safe(deco.dcStat)}</div> : null}
                                  {deco.knitLines ? <div>KNIT LINES: {safe(deco.knitLines)}</div> : null}
                                  <div>{cleanedDescription(deco.descrip)}</div>

                                  {deco.tapeNo ? (
                                    <>
                                      <div className="so-tape-barcode">{tapeValue}</div>
                                      <div className="so-tape-number">{tapeValue}</div>
                                    </>
                                  ) : null}
                                </div>
                              );
                            })}
                          </>
                        ) : null}
                      </td>

                      <td
                        className="so-center"
                        style={{
                          padding: 0,
                          borderLeftStyle: "hidden",
                          verticalAlign: "top",
                        }}
                      >
                        {safe(it.uom)}
                      </td>
                      <td
                        className="so-center"
                        style={{
                          padding: 0,
                          borderLeftStyle: "hidden",
                          verticalAlign: "top",
                        }}
                      >
                        {safe(sbtOrderInfo.taxCode)}
                      </td>
                      <td></td>
                    </tr>

                    <tr>
                      <td colSpan={9} className="so-comments-cell">
                        {comments.length > 0
                          ? comments.map((comment, cIdx) => <div key={`comment-${idx}-${cIdx}`}>{comment}</div>)
                          : null}

                        {web.custNo === "499G01" ? (
                          <div className="so-bold">
                            * DEDUCT 10% OFF OF FREIGHT CHARGES FOR THIS CUSTOMER *
                          </div>
                        ) : null}
                      </td>

                      <td
                        colSpan={2}
                        style={{
                          verticalAlign: "top",
                          borderLeftStyle: "hidden",
                        }}
                      >
                        <div>
                          Delivery Instructions:{" "}
                          {safe(
                            shippingInfo.AdditonalDeliveryInstruction ||
                              shippingInfo.AdditionalDeliveryInstruction
                          )}
                        </div>
                        <div>PDF: {printFlags.pdf === 1 ? "Yes" : "No"}</div>
                        <div>Report: {printFlags.report === 1 ? "Yes" : "No"}</div>
                      </td>

                      <td colSpan={1}></td>
                    </tr>
                  </tbody>
                </table>

                <div className="so-w50p so-inline so-left">{printDate}</div>
                <div className="so-w50p so-inline so-right">
                  Page {idx + 1} of {items.length || 1}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}