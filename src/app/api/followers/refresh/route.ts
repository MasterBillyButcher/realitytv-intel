import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth-guard";
import { fetchInstagramFollowers, ApifyFollowerError } from "@/lib/apify";
import { isValidInstagramHandle } from "@/lib/validation";

export const runtime = "nodejs";

interface RefreshOutcome {
  handle: string;
  ok: boolean;
  followersCount?: number;
  fetchedAt?: string;
  error?: string;
  reason?: string;
}

// A hard cap keeps a "refresh all" request bounded and prevents one call
// from running long enough to hit the platform's function timeout.
const MAX_HANDLES_PER_REQUEST = 25;

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.authorized) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  let body: { handles?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const handles = Array.isArray(body.handles) ? body.handles.filter((h): h is string => typeof h === "string") : [];

  if (handles.length === 0) {
    return NextResponse.json({ error: "At least one Instagram handle is required." }, { status: 400 });
  }
  if (handles.length > MAX_HANDLES_PER_REQUEST) {
    return NextResponse.json(
      { error: `Too many handles in one request. Maximum is ${MAX_HANDLES_PER_REQUEST}.` },
      { status: 400 }
    );
  }

  const results: RefreshOutcome[] = [];

  for (const handle of handles) {
    if (!isValidInstagramHandle(handle)) {
      results.push({ handle, ok: false, error: "Invalid Instagram handle.", reason: "invalid_username" });
      continue;
    }

    try {
      const result = await fetchInstagramFollowers(handle);
      results.push({ handle, ok: true, followersCount: result.followersCount, fetchedAt: result.fetchedAt });
    } catch (err) {
      if (err instanceof ApifyFollowerError) {
        results.push({ handle, ok: false, error: err.message, reason: err.reason });
      } else {
        results.push({ handle, ok: false, error: "Unexpected error while refreshing.", reason: "actor_error" });
      }
    }
  }

  return NextResponse.json({ results });
}
