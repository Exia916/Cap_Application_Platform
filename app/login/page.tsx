"use client";

import { useState } from "react";
import Image from "next/image";

function safeRedirect(value: unknown) {
  const path = typeof value === "string" ? value : "";
  if (!path.startsWith("/")) return "/dashboard";
  if (path.startsWith("//")) return "/dashboard";
  return path;
}

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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br">
      <div className="pointer-events-none absolute inset-0">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="noise" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
        <div className="grid w-full max-w-6xl lg:max-w-7xl grid-cols-1 overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur md:grid-cols-2">
          <div className="relative hidden md:flex flex-col justify-between p-10">
            <div>
              <div className="flex items-center gap-3">
                <Image
                  src="/brand/ca-mark.jpg"
                  alt="Cap America mark"
                  width={54}
                  height={54}
                  priority
                />
                <div className="text-white">
                  <div className="text-lg font-semibold tracking-tight">
                    Cap America
                  </div>
                  <div className="text-xs text-white/70">
                    CAP | Cap Application Platform
                  </div>
                </div>
              </div>

              <h2 className="mt-10 text-3xl font-semibold leading-tight text-white">
                Order visibility,
                <br />
                made simple.
              </h2>

              <p className="mt-3 max-w-sm text-sm text-white/70">
                Capture production. Track issues.
                Monitor performance—all in a unified platform.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-3 text-xs text-white/75">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="font-semibold text-white">
                    Daily Production Entries
                  </div>
                  <div className="mt-1 text-white/70">
                    Structured daily submissions
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="font-semibold text-white">Order Visibility</div>
                  <div className="mt-1 text-white/70">
                    Cross-module order tracking
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="font-semibold text-white">Quality & Recut</div>
                  <div className="mt-1 text-white/70">
                    Visibility into issues
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="font-semibold text-white">Metrics</div>
                  <div className="mt-1 text-white/70">Performance insights across departments</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center bg-white p-8 md:p-10">
            <div className="w-full max-w-sm">
              <div className="mb-6 flex flex-col items-center">
                <Image
                  src="/brand/capamerica85_logo.png"
                  alt="Cap America"
                  width={180}
                  height={48}
                  className="h-auto w-auto opacity-90"
                />
                <hr className="my-6 w-full border-gray-200" />
                <div className="mt-3 text-center">
                  <div className="text-xl font-semibold text-gray-900">CAP</div>
                  <div className="text-xs text-gray-500">
                    Cap Application Platform
                  </div>
                </div>
              </div>

              <div className="mb-6 hidden md:block">
                <div className="text-2xl font-semibold text-gray-900">
                  Sign in
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  Use your CAP credentials.
                </div>
              </div>

              {error ? (
                <div className="alert alert-danger mb-4">{error}</div>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="field-label mb-1">Username</label>
                  <input
                    className="input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>

                <div>
                  <label className="field-label mb-1">Password</label>
                  <input
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
                  className="btn btn-primary w-full"
                >
                  {loading ? "Signing in…" : "Sign In"}
                </button>
              </form>

              <div className="mt-6 text-center text-xs text-gray-400">
                © {new Date().getFullYear()} Cap America
              </div>
            </div>
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

        @keyframes subtleShift {
          0% {
            transform: scale(1) translate(0px, 0px);
          }
          50% {
            transform: scale(1.05) translate(-20px, 15px);
          }
          100% {
            transform: scale(1) translate(10px, -10px);
          }
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