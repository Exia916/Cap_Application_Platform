// app/dashboard/page.tsx
"use client";

import { useEffect } from "react";
import WelcomeCard from "./_components/WelcomeCard";
import SalesOrderLookupCard from "@/components/home/SalesOrderLookupCard";

export default function DashboardPage() {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "none",
        padding: "20px 24px",
      }}
    >
      <div
        style={{
          width: "100%",
          display: "grid",
          gap: 16,
        }}
      >
        <WelcomeCard />

        <SalesOrderLookupCard />

        <div
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
          <CompanyResourcesCard />
          <WeatherCard />
        </div>
      </div>
    </div>
  );
}

function CompanyResourcesCard() {
  const resources = [
    {
      title: "Company Website",
      description: "Open the public Cap America website.",
      href: "https://www.capamerica.com/",
    },
    {
      title: "Webmail",
      description: "Access Cap America email through SurgeWeb.",
      href: "https://mail.capamerica.com/surgeweb",
    },
    {
      title: "Paycom",
      description: "View pay information and request time off.",
      href: "https://www.paycomonline.net/v4/ee/web.php/app/login",
    },
    {
      title: "SBT Order Lock",
      description: "View the current locks being held in SBT.",
      href: "https://www.capamerica.biz/sbt",
    },
    {
      title: "Inventory Lookup",
      description: "View the current inventory levels by item. The information is updated hourly.",
      href: "http://files.capamerica.com/ca/inv/cap_inventory_pdf.pdf",
    },
  ];

  return (
    <section className="card">
      <div className="section-card-header">
        <div>
          <h2 style={{ margin: 0 }}>Company Resources</h2>
          <p className="page-subtitle" style={{ marginTop: 4 }}>
            Quick links to common company systems.
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {resources.map((resource) => (
          <a
            key={resource.href}
            href={resource.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "grid",
              gap: 6,
              textDecoration: "none",
              border: "1px solid var(--border)",
              background: "var(--surface-subtle)",
              borderRadius: 12,
              padding: 14,
              color: "inherit",
              minHeight: 92,
            }}
          >
            <span
              style={{
                color: "var(--text)",
                fontSize: 14,
                fontWeight: 800,
              }}
            >
              {resource.title}
            </span>

            <span
              style={{
                color: "var(--text-soft)",
                fontSize: 13,
                lineHeight: 1.35,
              }}
            >
              {resource.description}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function WeatherCard() {
  useEffect(() => {
    const scriptId = "weatherwidget-io-js";

    if (document.getElementById(scriptId)) {
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://weatherwidget.io/js/widget.min.js";
    script.async = true;

    document.body.appendChild(script);
  }, []);

  return (
    <section className="card">
      <div className="section-card-header">
        <div>
          <h2 style={{ margin: 0 }}>Local Weather</h2>
          <p className="page-subtitle" style={{ marginTop: 4 }}>
            Current local forecast for planning, travel, and daily operations.
          </p>
        </div>
      </div>

      <div
        style={{
          border: "1px solid var(--border)",
          background: "var(--surface-subtle)",
          borderRadius: 12,
          padding: 12,
          overflow: "hidden",
        }}
      >
        <a
          className="weatherwidget-io"
          href="https://forecast7.com/en/37d56n90d29/fredericktown/?unit=us"
          data-label_1="FREDERICKTOWN"
          data-label_2="WEATHER"
          data-theme="pure"
          data-basecolor="transparent"
          data-accent="var(--brand-blue)"
          data-textcolor="#111111"
          data-highcolor="#d1262b"
          data-lowcolor="#22448b"
          data-suncolor="#f59e0b"
          data-mooncolor="#6b7280"
          data-cloudcolor="#888888"
          data-cloudfill="#d8d1c3"
          data-raincolor="#1c9ad6"
          data-snowcolor="#3266a1"
        >
          FREDERICKTOWN WEATHER
        </a>
      </div>

      <div className="field-help" style={{ marginTop: 10 }}>
        Weather information is provided by an external weather widget.
      </div>
    </section>
  );
}