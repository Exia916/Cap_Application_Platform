"use client";

import { useState } from "react";
import Link from "next/link";

type VerifyResult = {
  ok: boolean;
  message?: string;
  error?: string;
  env?: Record<string, string>;
};

type SendResult = {
  ok: boolean;
  sent?: {
    messageId: string | null;
    accepted: string[];
    rejected: string[];
    response: string | null;
  };
  error?: string;
};

export default function AdminPlatformEmailTestPage() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("CAP Email Test");
  const [message, setMessage] = useState(
    "This is a test email from the Cap Applications Platform."
  );

  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);

  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [error, setError] = useState("");

  async function verifyConnection() {
    setVerifying(true);
    setError("");
    setVerifyResult(null);
    setSendResult(null);

    try {
      const res = await fetch("/api/admin/platform/email-test", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const json = await res.json().catch(() => ({}));
      setVerifyResult(json as VerifyResult);

      if (!res.ok) {
        setError((json as any)?.error || "Failed to verify SMTP connection.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to verify SMTP connection.");
    } finally {
      setVerifying(false);
    }
  }

  async function sendTest(e: React.FormEvent) {
    e.preventDefault();

    setSending(true);
    setError("");
    setVerifyResult(null);
    setSendResult(null);

    try {
      const res = await fetch("/api/admin/platform/email-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          to,
          subject,
          message,
        }),
      });

      const json = await res.json().catch(() => ({}));
      setSendResult(json as SendResult);

      if (!res.ok) {
        setError((json as any)?.error || "Failed to send test email.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to send test email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page-shell section-stack">
      <div className="card">
        <div className="page-header">
          <div className="page-header-title-wrap">
            <h1 className="page-title">Admin – Email Test</h1>
            <p className="page-subtitle">
              Verify the shared CAP SMTP email service and send a controlled test email.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/admin/notification-rules" className="btn btn-secondary">
              Notification Rules
            </Link>
            <Link href="/admin" className="btn btn-secondary">
              Back to Admin
            </Link>
          </div>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      {verifyResult ? (
  <div className={verifyResult.ok ? "alert alert-success" : "alert alert-danger"}>
    {verifyResult.ok ? "SMTP connection verified." : "SMTP verification failed."}
    <div style={{ marginTop: 6 }}>
      {verifyResult.message || verifyResult.error || "No details returned."}
    </div>
  </div>
) : null}

      {sendResult?.ok ? (
        <div className="alert alert-success">
          Test email sent.
          {sendResult.sent?.messageId ? (
            <>
              {" "}
              Message ID: <code>{sendResult.sent.messageId}</code>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="card section-stack">
        <div>
          <h2 style={{ margin: 0 }}>SMTP Connection</h2>
          <p className="text-soft" style={{ marginBottom: 0 }}>
            This verifies the SurgeMail SMTP connection using the shared platform email service.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={verifyConnection}
          disabled={verifying || sending}
        >
          {verifying ? "Verifying..." : "Verify SMTP Connection"}
        </button>
      </div>

      <form className="card section-stack" onSubmit={sendTest}>
        <div>
          <h2 style={{ margin: 0 }}>Send Test Email</h2>
          <p className="text-soft" style={{ marginBottom: 0 }}>
            This sends immediately through <code>platformEmailService</code>. It does not create a
            notification rule or delivery row.
          </p>
        </div>

        <div className="form-grid">
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">To *</label>
            <input
              className="input"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="your.name@capamerica.com"
              disabled={sending || verifying}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Subject</label>
            <input
              className="input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending || verifying}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Message</label>
            <textarea
              className="textarea"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending || verifying}
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={sending || verifying || !to.trim()}
        >
          {sending ? "Sending..." : "Send Test Email"}
        </button>
      </form>

      <div className="alert alert-info">
        Pending notification emails are processed by{" "}
        <code>/api/platform/notifications/email/process-pending</code>. This page is only for
        testing SMTP connectivity and direct delivery.
      </div>
    </div>
  );
}