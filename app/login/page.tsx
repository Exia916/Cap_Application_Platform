"use client";

import { useState } from "react";
import Image from "next/image";

function safeRedirect(value: unknown) {
  const path = typeof value === "string" ? value : "";
  if (!path.startsWith("/")) return "/dashboard";
  if (path.startsWith("//")) return "/dashboard";
  return path;
}

const platformCards = [
  {
    title: "Production & QC",
    text: "Daily entries, inspections, and department tracking",
  },
  {
    title: "Maintenance",
    text: "Repair requests and work orders",
  },
  {
    title: "Workflow",
    text: "Design and operational request tracking",
  },
  {
    title: "Recuts",
    text: "Request, review, and warehouse handling",
  },
  {
    title: "Playbooks",
    text: "Procedures, support articles, and training references",
  },
  {
    title: "Reporting",
    text: "Operational visibility and metrics",
  },
];

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          (data as any).error ||
            (data as any).message ||
            "Login failed"
        );
        setLoading(false);
        return;
      }

      if ((data as any)?.redirectTo) {
        window.location.assign(safeRedirect((data as any).redirectTo));
        return;
      }

      window.location.assign("/dashboard");
    } catch {
      setError("Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="cap-login-page">
      <div className="cap-login-bg" aria-hidden="true" />

      <main className="cap-login-main">
        <section className="cap-login-card" aria-label="CAP sign in">
          <div className="cap-login-overview">
            <div className="cap-login-overview-inner">
              <div>
                <div className="cap-login-brand-row">
                  <div className="cap-login-brand-mark">
                    <Image
                      src="/brand/ca-mark.jpg"
                      alt="Cap America mark"
                      width={48}
                      height={48}
                      priority
                      style={{ objectFit: "contain" }}
                    />
                  </div>

                  <div>
                    <div className="cap-login-brand-name">Cap America</div>
                    <div className="cap-login-brand-subtitle">
                      CAP | Cap Applications Platform
                    </div>
                  </div>
                </div>

                <div className="cap-login-kicker">Internal Operations Platform</div>

                <h1 className="cap-login-heading">
                  One platform for daily operations.
                </h1>

                <p className="cap-login-copy">
                  CAP brings production, quality, maintenance, workflow,
                  knowledge, and reporting tools into one secure internal system
                  built for Cap America teams.
                </p>

                <div className="cap-login-pill-row" aria-label="Platform areas">
                  <span>Production</span>
                  <span>Quality</span>
                  <span>Maintenance</span>
                  <span>Workflow</span>
                  <span>Knowledge</span>
                  <span>Reporting</span>
                </div>
              </div>

              <div className="cap-login-feature-grid">
                {platformCards.map((card) => (
                  <div key={card.title} className="cap-login-feature-card">
                    <div className="cap-login-feature-title">{card.title}</div>
                    <div className="cap-login-feature-text">{card.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="cap-login-form-panel">
            <div className="cap-login-form-wrap">
              <div className="cap-login-logo-wrap">
                <Image
                  src="/brand/capamerica85_logo.png"
                  alt="Cap America"
                  width={220}
                  height={64}
                  className="cap-login-logo"
                  priority
                />

                <div className="cap-login-logo-rule" />

                <div className="cap-login-system-title">CAP</div>
                <div className="cap-login-system-subtitle">
                  Cap Applications Platform
                </div>
              </div>

              <div className="cap-login-form-heading">
                <h2>Sign in to CAP</h2>
                <p>Use your CAP credentials to continue.</p>
              </div>

              {error ? (
                <div className="alert alert-danger cap-login-error">
                  {error}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="cap-login-form">
                <div>
                  <label className="field-label" htmlFor="cap-login-username">
                    Username
                  </label>
                  <input
                    id="cap-login-username"
                    className="input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="cap-login-password">
                    Password
                  </label>
                  <input
                    id="cap-login-password"
                    type="password"
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary cap-login-submit"
                >
                  {loading ? "Signing in…" : "Sign In"}
                </button>
              </form>

              <div className="cap-login-footer">
                <span>© {new Date().getFullYear()} Cap America</span>
                <span>Internal use only</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <style>{`
        .cap-login-page {
          position: relative;
          min-height: calc(100vh - var(--app-sticky-offset, 56px));
          overflow: visible;
          background: transparent;
        }

        .cap-login-bg {
          display: none;
        }

        .cap-login-main {
          position: relative;
          z-index: 1;
          width: 100%;
          min-height: calc(100vh - var(--app-sticky-offset, 56px));
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 42px 24px;
        }

        .cap-login-card {
          width: 100%;
          max-width: 1180px;
          display: grid;
          grid-template-columns: minmax(0, 1.06fr) minmax(380px, 0.94fr);
          overflow: hidden;
          border-radius: 28px;
          border: 1px solid rgba(17, 24, 39, 0.12);
          background: #ffffff;
          box-shadow: 0 26px 80px rgba(17, 24, 39, 0.18);
          backdrop-filter: none;
        }

        .cap-login-overview {
          position: relative;
          min-height: 640px;
          color: #ffffff;
          background:
            radial-gradient(circle at 12% 8%, rgba(209, 38, 43, 0.42), transparent 36%),
            radial-gradient(circle at 86% 82%, rgba(28, 154, 214, 0.22), transparent 40%),
            linear-gradient(135deg, #3b1428 0%, #18213a 48%, #22448b 100%);
        }

        .cap-login-overview::after {
          content: "";
          position: absolute;
          top: 0;
          right: 0;
          width: 1px;
          height: 100%;
          background: linear-gradient(
            180deg,
            transparent,
            rgba(255, 255, 255, 0.24),
            transparent
          );
        }

        .cap-login-overview-inner {
          min-height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 34px;
          padding: 42px;
          background: rgba(0, 0, 0, 0.08);
        }

        .cap-login-brand-row {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .cap-login-brand-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.22);
          overflow: hidden;
        }

        .cap-login-brand-name {
          color: #ffffff;
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.01em;
        }

        .cap-login-brand-subtitle {
          margin-top: 2px;
          color: rgba(255, 255, 255, 0.78);
          font-size: 12px;
          font-weight: 700;
        }

        .cap-login-kicker {
          display: inline-flex;
          width: fit-content;
          margin-top: 44px;
          padding: 7px 11px;
          border: 1px solid rgba(255, 255, 255, 0.24);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.9);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .cap-login-heading {
          max-width: 520px;
          margin: 18px 0 0;
          color: #ffffff;
          font-size: clamp(34px, 4vw, 54px);
          line-height: 0.98;
          font-weight: 900;
          letter-spacing: -0.045em;
          text-shadow: 0 2px 18px rgba(0, 0, 0, 0.22);
        }

        .cap-login-copy {
          max-width: 520px;
          margin: 20px 0 0;
          color: rgba(255, 255, 255, 0.84);
          font-size: 15px;
          line-height: 1.65;
        }

        .cap-login-pill-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 26px;
        }

        .cap-login-pill-row span {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 5px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.22);
          background: rgba(255, 255, 255, 0.11);
          color: rgba(255, 255, 255, 0.9);
          font-size: 12px;
          font-weight: 700;
        }

        .cap-login-feature-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .cap-login-feature-card {
          min-height: 104px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.085);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.14),
            0 10px 24px rgba(0, 0, 0, 0.12);
          padding: 16px;
        }

        .cap-login-feature-title {
          color: #ffffff;
          font-size: 14px;
          font-weight: 850;
          letter-spacing: -0.01em;
        }

        .cap-login-feature-text {
          margin-top: 7px;
          color: rgba(255, 255, 255, 0.8);
          font-size: 12px;
          line-height: 1.45;
        }

        .cap-login-form-panel {
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(251, 250, 247, 0.98));
          padding: 44px;
        }

        .cap-login-form-wrap {
          width: 100%;
          max-width: 390px;
        }

        .cap-login-logo-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          margin-bottom: 32px;
        }

        .cap-login-logo {
          width: 220px;
          height: auto;
          object-fit: contain;
        }

        .cap-login-logo-rule {
          width: 100%;
          height: 1px;
          margin: 22px 0 18px;
          background: linear-gradient(
            90deg,
            transparent,
            var(--border),
            transparent
          );
        }

        .cap-login-system-title {
          color: var(--text);
          font-size: 22px;
          font-weight: 900;
          line-height: 1;
          letter-spacing: 0.03em;
        }

        .cap-login-system-subtitle {
          margin-top: 7px;
          color: var(--text-soft);
          font-size: 12px;
          font-weight: 700;
        }

        .cap-login-form-heading {
          margin-bottom: 20px;
        }

        .cap-login-form-heading h2 {
          margin: 0;
          color: var(--text);
          font-size: 26px;
          font-weight: 900;
          letter-spacing: -0.025em;
        }

        .cap-login-form-heading p {
          margin: 6px 0 0;
          color: var(--text-soft);
          font-size: 14px;
        }

        .cap-login-error {
          margin-bottom: 16px;
        }

        .cap-login-form {
          display: grid;
          gap: 16px;
        }

        .cap-login-submit {
          width: 100%;
          min-height: 42px;
          margin-top: 2px;
        }

        .cap-login-footer {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 26px;
          color: var(--text-soft);
          font-size: 11px;
          font-weight: 700;
        }

        @media (max-width: 980px) {
          .cap-login-main {
            align-items: flex-start;
            padding: 24px 16px;
          }

          .cap-login-card {
            grid-template-columns: 1fr;
            max-width: 620px;
            border-radius: 24px;
          }

          .cap-login-form-panel {
            order: 1;
            padding: 34px 24px;
          }

          .cap-login-overview {
            order: 2;
            min-height: auto;
          }

          .cap-login-overview::after {
            display: none;
          }

          .cap-login-overview-inner {
            padding: 30px 24px;
          }

          .cap-login-kicker {
            margin-top: 28px;
          }

          .cap-login-heading {
            font-size: 34px;
          }

          .cap-login-feature-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .cap-login-main {
            padding: 14px;
          }

          .cap-login-card {
            border-radius: 20px;
          }

          .cap-login-form-panel {
            padding: 28px 18px;
          }

          .cap-login-overview-inner {
            padding: 24px 18px;
          }

          .cap-login-brand-row {
            align-items: flex-start;
          }

          .cap-login-brand-subtitle {
            max-width: 210px;
          }

          .cap-login-logo {
            width: 190px;
          }

          .cap-login-footer {
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 4px;
          }
        }
      `}</style>
    </div>
  );
}