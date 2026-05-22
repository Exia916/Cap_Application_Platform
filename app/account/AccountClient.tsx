"use client";

import { useEffect, useMemo, useState } from "react";

type SecurityQuestionRow = {
  id: string;
  userId: string;
  questionOrder: number;
  questionPrompt: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

type SecuritySummary = {
  userId: string;
  questionCount: number;
  securityQuestionsEnrolledAt: string | null;
  securityQuestionsRequired: boolean;
  offsiteSecurityBypassUntil: string | null;
};

type QuestionFormRow = {
  questionOrder: number;
  questionPrompt: string;
  answer: string;
};

type SecurityApiResponse = {
  summary?: SecuritySummary | null;
  questions?: SecurityQuestionRow[];
  error?: string;
};

type NotificationPreferences = {
  userId: string;
  email: string | null;
  emailNotificationsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  updatedAt: string | null;
};

type NotificationPreferencesApiResponse = {
  preferences?: NotificationPreferences | null;
  error?: string;
};

const QUESTION_OPTIONS = [
  "What was the name of your first pet?",
  "What city did you grow up in?",
  "What was the name of your first school?",
  "What was the first car you owned?",
  "What was the street name of your childhood home?",
  "What was your childhood nickname?",
  "What was the name of a teacher who influenced you?",
  "What was the first concert or event you attended?",
  "What was the name of your childhood best friend?",
];

function emptyRows(): QuestionFormRow[] {
  return [
    { questionOrder: 1, questionPrompt: "", answer: "" },
    { questionOrder: 2, questionPrompt: "", answer: "" },
    { questionOrder: 3, questionPrompt: "", answer: "" },
  ];
}

function fmtDateTime(v?: string | null) {
  if (!v) return "Not set up";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function validateRows(rows: QuestionFormRow[]): string | null {
  if (rows.length !== 3) return "Exactly 3 questions are required.";

  const prompts = new Set<string>();

  for (const row of rows) {
    const prompt = row.questionPrompt.trim();
    const answer = row.answer.trim();

    if (!prompt) {
      return `Question ${row.questionOrder} is required.`;
    }

    if (prompt.length < 8) {
      return `Question ${row.questionOrder} must be at least 8 characters.`;
    }

    const promptKey = prompt.toLowerCase();
    if (prompts.has(promptKey)) {
      return "Each question must be different.";
    }

    prompts.add(promptKey);

    if (!answer) {
      return `Answer ${row.questionOrder} is required.`;
    }

    if (answer.length < 2) {
      return `Answer ${row.questionOrder} must be at least 2 characters.`;
    }
  }

  return null;
}

export default function AccountClient() {
  const [rows, setRows] = useState<QuestionFormRow[]>(emptyRows());
  const [summary, setSummary] = useState<SecuritySummary | null>(null);

  const [notificationPrefs, setNotificationPrefs] =
    useState<NotificationPreferences | null>(null);

  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  const [inAppNotificationsEnabled, setInAppNotificationsEnabled] = useState(true);

  const [loading, setLoading] = useState(true);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [setupRequiredFromLogin, setSetupRequiredFromLogin] = useState(false);

  const enrolled = useMemo(
    () => Number(summary?.questionCount ?? 0) >= 3,
    [summary?.questionCount]
  );

  async function loadSecurityQuestions() {
    const res = await fetch("/api/account/security-questions", {
      cache: "no-store",
      credentials: "include",
    });

    const data = (await res.json().catch(() => ({}))) as SecurityApiResponse;

    if (res.status === 401) {
      throw new Error("You are not currently signed in.");
    }

    if (!res.ok) {
      throw new Error(data?.error || "Failed to load account settings.");
    }

    setSummary(data.summary ?? null);

    const questions = Array.isArray(data.questions) ? data.questions : [];

    if (questions.length > 0) {
      setRows(
        [1, 2, 3].map((order) => {
          const found = questions.find((q) => Number(q.questionOrder) === order);

          return {
            questionOrder: order,
            questionPrompt: found?.questionPrompt ?? "",
            answer: "",
          };
        })
      );
    } else {
      setRows(emptyRows());
    }
  }

  async function loadNotificationPreferences() {
    const res = await fetch("/api/account/notification-preferences", {
      cache: "no-store",
      credentials: "include",
    });

    const data = (await res.json().catch(() => ({}))) as NotificationPreferencesApiResponse;

    if (res.status === 401) {
      throw new Error("You are not currently signed in.");
    }

    if (!res.ok) {
      throw new Error(data?.error || "Failed to load notification preferences.");
    }

    const prefs = data.preferences ?? null;

    setNotificationPrefs(prefs);
    setEmailNotificationsEnabled(prefs?.emailNotificationsEnabled ?? true);
    setInAppNotificationsEnabled(prefs?.inAppNotificationsEnabled ?? true);
  }

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setSuccessMsg(null);

      await Promise.all([
        loadSecurityQuestions(),
        loadNotificationPreferences(),
      ]);
    } catch (err: any) {
      setError(err?.message || "Failed to load account settings.");
      setRows(emptyRows());
      setSummary(null);
      setNotificationPrefs(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    setSetupRequiredFromLogin(params.get("securitySetup") === "required");
  }, []);

  function updateRow(
    order: number,
    key: "questionPrompt" | "answer",
    value: string
  ) {
    setRows((prev) =>
      prev.map((row) =>
        row.questionOrder === order ? { ...row, [key]: value } : row
      )
    );

    setError(null);
    setSuccessMsg(null);
  }

  async function onSaveNotificationPreferences(e: React.FormEvent) {
    e.preventDefault();

    setError(null);
    setSuccessMsg(null);

    try {
      setSavingPreferences(true);

      const res = await fetch("/api/account/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          emailNotificationsEnabled,
          inAppNotificationsEnabled,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as NotificationPreferencesApiResponse;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save notification preferences.");
      }

      const prefs = data.preferences ?? null;

      setNotificationPrefs(prefs);
      setEmailNotificationsEnabled(prefs?.emailNotificationsEnabled ?? true);
      setInAppNotificationsEnabled(prefs?.inAppNotificationsEnabled ?? true);

      setSuccessMsg("Notification preferences saved.");
    } catch (err: any) {
      setError(err?.message || "Failed to save notification preferences.");
    } finally {
      setSavingPreferences(false);
    }
  }

  async function onSubmitSecurityQuestions(e: React.FormEvent) {
    e.preventDefault();

    setError(null);
    setSuccessMsg(null);

    const validationError = validateRows(rows);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSavingQuestions(true);

      const res = await fetch("/api/account/security-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          questions: rows.map((row) => ({
            questionOrder: row.questionOrder,
            questionPrompt: row.questionPrompt.trim(),
            answer: row.answer.trim(),
          })),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as SecurityApiResponse;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save security questions.");
      }

      setSuccessMsg("Security questions saved.");
      setSetupRequiredFromLogin(false);

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("securitySetup");
        window.history.replaceState({}, "", url.toString());
      }

      await loadSecurityQuestions();
    } catch (err: any) {
      setError(err?.message || "Failed to save security questions.");
    } finally {
      setSavingQuestions(false);
    }
  }

  if (loading) {
    return (
      <div className="section-stack">
        <div className="card">
          <div className="text-muted">Loading account settings…</div>
        </div>
      </div>
    );
  }

  const emailConfigured = Boolean(notificationPrefs?.email);

  return (
    <div className="section-stack">
      {setupRequiredFromLogin && !enrolled ? (
        <div className="alert alert-warning">
          Offsite access will require security questions. Please set up all 3
          questions before continuing.
        </div>
      ) : null}

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {successMsg ? <div className="alert alert-success">{successMsg}</div> : null}

      <div className="card">
        <div className="section-card-header">
          <div>
            <h2 style={{ marginBottom: 4 }}>Notification Preferences</h2>
            <p className="page-subtitle">
              Choose how CAP should contact you when future task, workflow, shipment,
              or compliance notifications are enabled.
            </p>
          </div>

          <span className="badge badge-brand-blue">Foundation</span>
        </div>

        <div className="record-meta-grid" style={{ marginBottom: 16 }}>
          <div className="record-meta-item">
            <div className="record-meta-label">Email on File</div>
            <div className="record-meta-value">
              {notificationPrefs?.email || "No email assigned"}
            </div>
          </div>

          <div className="record-meta-item">
            <div className="record-meta-label">Last Updated</div>
            <div className="record-meta-value">
              {fmtDateTime(notificationPrefs?.updatedAt)}
            </div>
          </div>
        </div>

        {!emailConfigured ? (
          <div className="alert alert-warning" style={{ marginBottom: 16 }}>
            No email is currently assigned to your account. Email notifications can
            be enabled here, but they will not be deliverable until an admin adds
            your email address.
          </div>
        ) : null}

        <form onSubmit={onSaveNotificationPreferences} className="section-stack">
          <div className="section-card" style={{ padding: 16 }}>
            <div className="form-grid">
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="field-label">Notification Channels</label>

                <div className="muted-box" style={{ display: "grid", gap: 10 }}>
                  <label className="master-checkbox-row">
                    <input
                      type="checkbox"
                      checked={emailNotificationsEnabled}
                      onChange={(e) => {
                        setEmailNotificationsEnabled(e.target.checked);
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      disabled={savingPreferences}
                    />
                    Email notifications
                  </label>

                  <div className="field-help" style={{ marginTop: -4 }}>
                    Used later for task assignments, overdue items, workflow changes,
                    shipment follow-ups, and escalation notices.
                  </div>

                  <label className="master-checkbox-row">
                    <input
                      type="checkbox"
                      checked={inAppNotificationsEnabled}
                      onChange={(e) => {
                        setInAppNotificationsEnabled(e.target.checked);
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      disabled={savingPreferences}
                    />
                    In-app notifications
                  </label>

                  <div className="field-help" style={{ marginTop: -4 }}>
                    Used later for CAP notification center alerts and My Work items.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadNotificationPreferences}
              disabled={savingPreferences}
            >
              Reset Preferences
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingPreferences}
            >
              {savingPreferences ? "Saving..." : "Save Preferences"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="section-card-header">
          <div>
            <h2 style={{ marginBottom: 4 }}>Security Questions</h2>
            <p className="page-subtitle">
              These questions will be used later for offsite access verification.
              This setup does not change your current login process yet.
            </p>
          </div>

          <span className={enrolled ? "badge badge-success" : "badge badge-warning"}>
            {enrolled ? "Set Up" : "Not Set Up"}
          </span>
        </div>

        <div className="record-meta-grid" style={{ marginBottom: 16 }}>
          <div className="record-meta-item">
            <div className="record-meta-label">Questions Saved</div>
            <div className="record-meta-value">
              {Number(summary?.questionCount ?? 0)} of 3
            </div>
          </div>

          <div className="record-meta-item">
            <div className="record-meta-label">Last Setup Date</div>
            <div className="record-meta-value">
              {fmtDateTime(summary?.securityQuestionsEnrolledAt)}
            </div>
          </div>
        </div>

        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          Answers are never displayed after saving. To update your security questions,
          enter all 3 questions and answers again.
        </div>

        <form onSubmit={onSubmitSecurityQuestions} className="section-stack">
          {rows.map((row) => (
            <div key={row.questionOrder} className="section-card" style={{ padding: 16 }}>
              <div className="section-card-header">
                <h3 style={{ margin: 0 }}>Question {row.questionOrder}</h3>
              </div>

              <div className="form-grid">
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="field-label">
                    Security Question <span style={{ color: "var(--brand-red)" }}>*</span>
                  </label>

                  <input
                    className="input"
                    list={`security-question-options-${row.questionOrder}`}
                    value={row.questionPrompt}
                    onChange={(e) =>
                      updateRow(row.questionOrder, "questionPrompt", e.target.value)
                    }
                    placeholder="Select or type a question..."
                    disabled={savingQuestions}
                    autoComplete="off"
                  />

                  <datalist id={`security-question-options-${row.questionOrder}`}>
                    {QUESTION_OPTIONS.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>

                  <div className="field-help">
                    Choose from the list or type your own question.
                  </div>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="field-label">
                    Answer <span style={{ color: "var(--brand-red)" }}>*</span>
                  </label>

                  <input
                    className="input"
                    type="password"
                    value={row.answer}
                    onChange={(e) =>
                      updateRow(row.questionOrder, "answer", e.target.value)
                    }
                    placeholder="Enter answer..."
                    disabled={savingQuestions}
                    autoComplete="new-password"
                  />

                  <div className="field-help">
                    Answers are stored securely and are not shown after saving.
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="sticky-actions">
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={loadSecurityQuestions}
                disabled={savingQuestions}
              >
                Reset
              </button>

              <button type="submit" className="btn btn-primary" disabled={savingQuestions}>
                {savingQuestions ? "Saving..." : "Save Security Questions"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}