import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth-guard";
import { validateTrackerData } from "@/lib/validation";
import {
  publishTrackerFile,
  GitHubConfigError,
  GitHubConflictError,
  GitHubPublishError,
} from "@/lib/github";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.authorized) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  let body: { data?: unknown; expectedSha?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (typeof body.expectedSha !== "string" || !body.expectedSha) {
    return NextResponse.json(
      { error: "Missing expectedSha. Reload the admin editor and try again." },
      { status: 400 }
    );
  }

  const validation = validateTrackerData(body.data);
  if (!validation.valid) {
    return NextResponse.json({ error: "Dataset failed validation.", issues: validation.issues }, { status: 422 });
  }

  const payload = {
    ...(body.data as Record<string, unknown>),
    updatedAt: new Date().toISOString(),
  };

  try {
    const result = await publishTrackerFile({
      content: JSON.stringify(payload, null, 2) + "\n",
      expectedSha: body.expectedSha,
      commitMessage: "Update tracker data via admin editor",
    });
    return NextResponse.json({ ok: true, commitSha: result.commitSha, commitUrl: result.commitUrl });
  } catch (err) {
    if (err instanceof GitHubConflictError) {
      return NextResponse.json({ error: err.message, code: "conflict" }, { status: 409 });
    }
    if (err instanceof GitHubConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof GitHubPublishError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Unexpected error while publishing." }, { status: 500 });
  }
}
