import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/requireAdmin";
import { validateTrackerData } from "@/schemas/tracker";
import { getCanonicalFile, publishCanonicalFile } from "@/server/github";
import { GithubPublishError } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET returns the currently published data and its GitHub SHA, so the
 * admin editor can base edits on the latest version and detect conflicts
 * before publishing.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const file = await getCanonicalFile();
    if (!file) {
      return NextResponse.json({ ok: false, error: "not_found", message: "Canonical data file not found in repository." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: JSON.parse(file.content), sha: file.sha });
  } catch (error) {
    if (error instanceof GithubPublishError) {
      return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: 502 });
    }
    return NextResponse.json({ ok: false, error: "unknown_error", message: "Failed to load published data." }, { status: 500 });
  }
}

interface PublishBody {
  data?: unknown;
  baseSha?: string | null;
  message?: string;
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;

  let body: PublishBody;
  try {
    body = (await request.json()) as PublishBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request", message: "Malformed request body." }, { status: 400 });
  }

  const validation = validateTrackerData(body.data);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, error: "validation_failed", message: "Data failed validation.", issues: validation.issues },
      { status: 422 }
    );
  }

  const serialized = JSON.stringify(
    { ...validation.data, publishedAt: new Date().toISOString() },
    null,
    2
  );

  const result = await publishCanonicalFile({
    content: serialized,
    baseSha: body.baseSha ?? null,
    message: body.message?.trim() || "Publish live: update tracker data"
  });

  if (!result.ok) {
    const status = result.code === "conflict" ? 409 : result.code === "auth_failed" || result.code === "missing_config" ? 502 : 500;
    return NextResponse.json({ ok: false, error: result.code, message: result.message }, { status });
  }

  return NextResponse.json({ ok: true, commitSha: result.commitSha, commitUrl: result.commitUrl });
}
