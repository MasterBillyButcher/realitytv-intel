"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { login } from "@/lib/adminApi";

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("submitting");
    setError(null);
    const result = await login(password);
    if (result.ok) {
      setStatus("idle");
      onSuccess();
    } else {
      setStatus("error");
      setError(result.message);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-16">
      <h1 className="font-serif text-2xl font-semibold text-ink-900">Admin login</h1>
      <p className="mt-2 text-sm text-ink-500">Sign in to manage tracker data and publish updates.</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-ink-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="focus-ring mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
            aria-invalid={status === "error"}
            aria-describedby={error ? "login-error" : undefined}
          />
        </div>
        {error && (
          <p id="login-error" role="alert" className="text-sm text-signal-down">
            {error}
          </p>
        )}
        <Button type="submit" disabled={status === "submitting" || password.length === 0} className="w-full">
          {status === "submitting" ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
