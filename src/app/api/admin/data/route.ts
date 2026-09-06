import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth-guard";
import { readTrackerFile, GitHubConfigError, GitHubPublishError } from "@/lib/github";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.authorized) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  try {
    const file = await readTrackerFile();
    return NextResponse.json({ data: JSON.parse(file.content), sha: file.sha });
  } catch (err) {
    if (err instanceof GitHubConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof GitHubPublishError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Could not load tracker data from GitHub." }, { status: 500 });
  }
}
