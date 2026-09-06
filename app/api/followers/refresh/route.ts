import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/requireAdmin";
import { fetchInstagramFollowers, apifyErrorToUserMessage } from "@/server/apify";
import { isValidInstagramHandle } from "@/lib/instagram";
import { ApifyError, type RefreshResult } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RefreshTarget {
  contestantId: string;
  instagramHandle: string;
}

interface RefreshRequestBody {
  targets?: RefreshTarget[];
}

const MAX_TARGETS_PER_REQUEST = 100;

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;

  let body: RefreshRequestBody;
  try {
    body = (await request.json()) as RefreshRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request", message: "Malformed request body." }, { status: 400 });
  }

  const targets = body.targets ?? [];
  if (!Array.isArray(targets) || targets.length === 0) {
    return NextResponse.json({ ok: false, error: "no_targets", message: "No contestants specified." }, { status: 400 });
  }
  if (targets.length > MAX_TARGETS_PER_REQUEST) {
    return NextResponse.json(
      { ok: false, error: "too_many_targets", message: `Refresh at most ${MAX_TARGETS_PER_REQUEST} contestants at once.` },
      { status: 400 }
    );
  }

  const results: RefreshResult[] = [];

  // Sequential, deliberately: avoids bursting the Apify actor and keeps
  // per-target error handling independent and simple to reason about.
  for (const target of targets) {
    if (!target.contestantId || !target.instagramHandle) {
      results.push({ contestantId: target.contestantId ?? "unknown", ok: false, error: "Missing contestant id or Instagram handle." });
      continue;
    }
    if (!isValidInstagramHandle(target.instagramHandle)) {
      results.push({ contestantId: target.contestantId, ok: false, error: "Invalid Instagram handle." });
      continue;
    }
    try {
      const reading = await fetchInstagramFollowers(target.instagramHandle);
      results.push({ contestantId: target.contestantId, ok: true, followers: reading.followers });
    } catch (error) {
      const message = error instanceof ApifyError ? apifyErrorToUserMessage(error) : "Follower lookup failed unexpectedly.";
      results.push({ contestantId: target.contestantId, ok: false, error: message });
    }
  }

  return NextResponse.json({ ok: true, results });
}
