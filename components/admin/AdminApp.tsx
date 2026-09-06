"use client";

import { useEffect, useState } from "react";
import { checkSession, logout } from "@/lib/adminApi";
import { LoginForm } from "@/components/admin/LoginForm";
import { AdminEditor } from "@/components/admin/AdminEditor";
import { Button } from "@/components/Button";

type AuthState = "checking" | "authenticated" | "unauthenticated" | "check_failed";

export function AdminApp() {
  const [authState, setAuthState] = useState<AuthState>("checking");

  async function runCheck() {
    setAuthState("checking");
    try {
      const session = await checkSession();
      setAuthState(session.authenticated ? "authenticated" : "unauthenticated");
    } catch {
      // A failed check must resolve to a finite state, not stay on "checking".
      setAuthState("check_failed");
    }
  }

  useEffect(() => {
    runCheck();
  }, []);

  if (authState === "checking") {
    return (
      <div className="mx-auto max-w-sm px-5 py-16 text-center text-ink-500">
        <p>Checking your session...</p>
      </div>
    );
  }

  if (authState === "check_failed") {
    return (
      <div className="mx-auto max-w-sm px-5 py-16 text-center">
        <p className="text-signal-down">Could not verify your session. Check your connection.</p>
        <Button variant="secondary" className="mt-4" onClick={runCheck}>
          Try again
        </Button>
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return <LoginForm onSuccess={() => setAuthState("authenticated")} />;
  }

  return (
    <AdminEditor
      onLogout={async () => {
        await logout();
        setAuthState("unauthenticated");
      }}
    />
  );
}
