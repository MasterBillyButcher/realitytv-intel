"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "idle" | "checking-session" | "submitting" | "error";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("checking-session");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    fetch("/api/auth/session", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.authorized) {
          router.replace("/admin/dashboard");
        } else {
          setStatus("idle");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("idle");
      })
      .finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        signal: controller.signal,
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Login failed.");
        setStatus("error");
        return;
      }

      router.replace("/admin/dashboard");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("The request timed out. Check your connection and try again.");
      } else {
        setError("Could not reach the server. Try again.");
      }
      setStatus("error");
    } finally {
      clearTimeout(timer);
    }
  }

  if (status === "checking-session") {
    return (
      <div className="mx-auto max-w-sm px-5 py-20 text-sm" style={{ color: "var(--ink-soft)" }}>
        Checking session...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-20">
      <h1 className="text-2xl mb-6">Admin login</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          Password
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
          />
        </label>

        {error && (
          <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary" disabled={status === "submitting"}>
          {status === "submitting" ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
