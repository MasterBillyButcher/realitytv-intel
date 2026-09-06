import type { RefreshResult, TrackerData } from "@/types";

const DEFAULT_TIMEOUT_MS = 12000;

async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, credentials: "same-origin" });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const message = (body && (body.message as string)) || `Request failed with status ${response.status}.`;
      throw new Error(message);
    }
    return body as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out. Check your connection and try again.");
    }
    throw error instanceof Error ? error : new Error("Unexpected error.");
  } finally {
    clearTimeout(timer);
  }
}

export interface SessionStatus {
  authenticated: boolean;
  reason?: string;
}

export function checkSession(): Promise<SessionStatus> {
  return fetchJson<SessionStatus>("/api/auth/session", { method: "GET" }, 8000);
}

export async function login(password: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Login failed." };
  }
}

export async function logout(): Promise<void> {
  await fetchJson("/api/auth/logout", { method: "POST" }).catch(() => undefined);
}

export interface PublishedFile {
  ok: true;
  data: TrackerData;
  sha: string;
}

export function fetchPublishedData(): Promise<PublishedFile> {
  return fetchJson<PublishedFile>("/api/publish", { method: "GET" }, 15000);
}

export interface PublishSuccessResponse {
  ok: true;
  commitSha: string;
  commitUrl: string;
}

export async function publishData(
  data: TrackerData,
  baseSha: string | null,
  message: string
): Promise<PublishSuccessResponse> {
  return fetchJson<PublishSuccessResponse>(
    "/api/publish",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, baseSha, message })
    },
    20000
  );
}

export interface RefreshTarget {
  contestantId: string;
  instagramHandle: string;
}

export function refreshFollowers(targets: RefreshTarget[]): Promise<{ ok: true; results: RefreshResult[] }> {
  return fetchJson(
    "/api/followers/refresh",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targets })
    },
    30000
  );
}
