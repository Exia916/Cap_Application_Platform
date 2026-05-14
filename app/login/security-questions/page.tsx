"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type ChallengeQuestion = {
  id: string;
  questionOrder: number;
  questionPrompt: string;
};

type ChallengePayload = {
  user?: {
    username: string;
    displayName: string;
  };
  attemptsRemaining?: number;
  questions?: ChallengeQuestion[];
  error?: string;
};

export default function SecurityQuestionsLoginPage() {
  const [questions, setQuestions] = useState<ChallengeQuestion[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (questions.length !== 2) return false;
    return questions.every((q) => String(answers[q.id] ?? "").trim().length > 0);
  }, [answers, questions]);

  async function loadChallenge() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/auth/security-questions/challenge", {
        cache: "no-store",
        credentials: "include",
      });

      const data = (await res.json().catch(() => ({}))) as ChallengePayload;

      if (!res.ok) {
        setError(data?.error || "Security verification session expired. Please sign in again.");
        setQuestions([]);
        return;
      }

      const loadedQuestions = Array.isArray(data.questions) ? data.questions : [];

      setQuestions(loadedQuestions);
      setDisplayName(data.user?.displayName || data.user?.username || "");
      setAttemptsRemaining(
        typeof data.attemptsRemaining === "number" ? data.attemptsRemaining : null
      );

      const nextAnswers: Record<string, string> = {};
      for (const q of loadedQuestions) {
        nextAnswers[q.id] = "";
      }
      setAnswers(nextAnswers);
    } catch {
      setError("Failed to load security questions.");
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadChallenge();
  }, []);

  function updateAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!canSubmit || verifying) return;

    try {
      setVerifying(true);
      setError(null);

      const res = await fetch("/api/auth/security-questions/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          answers: questions.map((q) => ({
            questionId: q.id,
            answer: answers[q.id] ?? "",
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          (data as any)?.error ||
            "Security verification failed. Please try again."
        );

        if (typeof (data as any)?.attemptsRemaining === "number") {
          setAttemptsRemaining((data as any).attemptsRemaining);
        }

        return;
      }

      window.location.assign("/dashboard");
    } catch {
      setError("Security verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br">
      <div className="pointer-events-none absolute inset-0">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="noise" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white p-8 shadow-2xl">
          <div className="mb-6 flex flex-col items-center">
            <Image
              src="/brand/capamerica85_logo.png"
              alt="Cap America"
              width={180}
              height={48}
              className="h-auto w-auto opacity-90"
            />
            <hr className="my-6 w-full border-gray-200" />
            <div className="text-center">
              <div className="text-xl font-semibold text-gray-900">
                Security Verification
              </div>
              <div className="mt-1 text-sm text-gray-500">
                Answer the questions below to finish signing in.
              </div>
            </div>
          </div>

          {displayName ? (
            <div className="alert alert-info mb-4">
              Signing in as <strong>{displayName}</strong>
            </div>
          ) : null}

          {attemptsRemaining != null ? (
            <div className="mb-4 text-sm text-gray-600">
              Attempts remaining: <strong>{attemptsRemaining}</strong>
            </div>
          ) : null}

          {error ? (
            <div className="alert alert-danger mb-4">{error}</div>
          ) : null}

          {loading ? (
            <div className="text-sm text-gray-600">Loading security questions…</div>
          ) : null}

          {!loading && questions.length !== 2 ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                Security verification is not available. Please sign in again.
              </div>

              <button
                type="button"
                className="btn btn-primary w-full"
                onClick={() => window.location.assign("/login")}
              >
                Back to Login
              </button>
            </div>
          ) : null}

          {!loading && questions.length === 2 ? (
            <form onSubmit={onSubmit} className="space-y-4">
              {questions.map((q, idx) => (
                <div key={q.id}>
                  <label className="field-label mb-1">
                    Question {idx + 1}
                  </label>

                  <div className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
                    {q.questionPrompt}
                  </div>

                  <input
                    type="password"
                    className="input"
                    value={answers[q.id] ?? ""}
                    onChange={(e) => updateAnswer(q.id, e.target.value)}
                    autoComplete="off"
                    placeholder="Enter your answer"
                    disabled={verifying}
                    required
                  />
                </div>
              ))}

              <button
                type="submit"
                disabled={!canSubmit || verifying}
                className="btn btn-primary w-full"
              >
                {verifying ? "Verifying…" : "Verify and Sign In"}
              </button>

              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={() => window.location.assign("/login")}
                disabled={verifying}
              >
                Back to Login
              </button>
            </form>
          ) : null}

          <div className="mt-6 text-center text-xs text-gray-400">
            © {new Date().getFullYear()} Cap America
          </div>
        </div>
      </div>

      <style>{`
        body {
          background:
            radial-gradient(circle at 20% 20%, rgba(239, 68, 68, 0.45), transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(37, 99, 235, 0.45), transparent 55%),
            radial-gradient(circle at 60% 30%, rgba(30, 41, 59, 0.35), transparent 60%),
            linear-gradient(135deg, #0f172a, #1e293b);
        }

        .noise {
          position: absolute;
          inset: 0;
          opacity: 0.05;
          mix-blend-mode: overlay;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}