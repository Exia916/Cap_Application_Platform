import Link from "next/link";
import styles from "./itemPricingUi.module.css";

const cards = [
  {
    href: "/admin/item-pricing/price-books",
    title: "Price Books",
    text: "Manage working pricing versions, lifecycle status, supporting files, comments, and audit history.",
  },
  {
    href: "/admin/item-pricing/items",
    title: "Items",
    text: "Maintain item/style setup, rule set assignment, and active flags.",
  },
  {
    href: "/admin/item-pricing/base-prices",
    title: "Base Prices",
    text: "Store the source Blank EQP 2500+ value and review Flat/3D EQP.",
  },
  {
    href: "/admin/item-pricing/rule-sets",
    title: "Rule Sets",
    text: "Review structured quantity break rules for each product pricing family.",
  },
  {
    href: "/admin/item-pricing/calculate",
    title: "Calculate / Preview",
    text: "Test Blank, Flat Embroidery, 3D Embroidery, and Knit In base outputs.",
  },
  {
    href: "/admin/item-pricing/price-levels",
    title: "Price Levels",
    text: "Set up internal/customer group price levels and structured adjustment rules on top of base pricing.",
  },
  {
    href: "/admin/item-pricing/price-level-preview",
    title: "Price-Level Preview",
    text: "Preview base prices and price-level adjusted results before a customer-facing calculator is built.",
  },
  {
    href: "/admin/item-pricing/imports",
    title: "Imports",
    text: "Stage, validate, and apply CSV rows for item setup and Blank EQP 2500+ base prices.",
  },
  {
    href: "/admin/item-pricing/update-batches",
    title: "Update Batches",
    text: "Preview and apply individual, filtered, CSV, or whole price book Blank EQP updates.",
  },
  {
    href: "/admin/item-pricing/exports",
    title: "Exports",
    text: "Generate internal CSV and PDF files for validation, item detail review, and price book summaries.",
  },
  {
    href: "/admin/item-pricing/validation",
    title: "Validation",
    text: "Run foundation checks for missing base prices, duplicate rules, method exceptions, and calculation errors.",
  },
];

export default function ItemPricingSetupLandingPage() {
  return (
    <main className={`page-shell-wide ${styles.pageStack}`}>
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Item Pricing Setup</h1>
          <p className="page-subtitle">
            Base setup for CAP item pricing using Blank EQP 2500+ as the source value.
          </p>
        </div>
      </div>

      <section className="card">
        <div className="record-meta-grid">
          <div className="record-meta-item">
            <span className="record-meta-label">Source Value</span>
            <span className="record-meta-value">Blank EQP 2500+</span>
          </div>
          <div className="record-meta-item">
            <span className="record-meta-label">Flat EQP</span>
            <span className="record-meta-value">Blank EQP + 3.00</span>
          </div>
          <div className="record-meta-item">
            <span className="record-meta-label">3D EQP</span>
            <span className="record-meta-value">Blank EQP + 5.75</span>
          </div>
          <div className="record-meta-item">
            <span className="record-meta-label">Current Phase</span>
            <span className="record-meta-value">Price-level foundation</span>
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="record-section-header">
          <div>
            <h2 className="record-section-title">Setup Areas</h2>
            <p className="page-subtitle">
              Price levels are now separated from base pricing rules. Base pricing remains product/item math; price-level rules apply only after base pricing is calculated.
            </p>
          </div>
        </div>

        <div className={styles.setupCardGrid}>
          {cards.map((card) => (
            <article className={styles.setupCard} key={card.href}>
              <h3 className={styles.setupCardTitle}>{card.title}</h3>
              <p className={styles.setupCardText}>{card.text}</p>
              <div>
                <Link href={card.href} className="btn btn-secondary btn-sm">
                  Open
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
