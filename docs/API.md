# API

All routes live under `src/app/api/` and run on the Node.js runtime. Every
route validates its inputs, enforces a finite timeout on any outbound call,
and returns a predictable JSON error body instead of hanging or leaking a
stack trace.

## POST /api/auth/login

Authenticates against `ADMIN_PASSWORD` and, on success, sets a signed,
httpOnly session cookie.

Request body: `{ "password": string }`

Responses:
- `200 { ok: true }` — cookie set.
- `401 { error: string }` — incorrect password.
- `400 { error: string }` — malformed request body.
- `503 { error: string }` — `ADMIN_PASSWORD` or `ADMIN_SESSION_SECRET` is not configured.

## POST /api/auth/logout

Clears the session cookie. No body required. Always returns `200 { ok: true }`.

## GET /api/auth/session

Reports whether the current request holds a valid admin session. Purely
local (no network or database call), so it always resolves immediately.

Response: `200 { authorized: boolean, reason: string | null }`

`reason` is one of `malformed`, `invalid_signature`, `expired`,
`config_error`, or `null` when authorized.

## GET /api/tracker

Public. Returns the canonical tracker data as bundled into the current
deployment (not a live GitHub read).

Response: `200 { version, updatedAt, shows, contestants }`

## GET /api/admin/data

Admin-only. Reads the live tracker data file directly from GitHub, along
with its current commit SHA, for conflict-safe editing.

Responses:
- `200 { data: TrackerData, sha: string }`
- `401 { error: string }` — no valid admin session.
- `503 { error: string }` — GitHub configuration is incomplete.
- `502 { error: string }` — GitHub could not be reached or returned an error.

## POST /api/followers/refresh

Admin-only. Fetches real, current follower counts from Instagram via Apify
for one or more handles.

Request body: `{ "handles": string[] }` (maximum 25 per request)

Response: `200 { results: Array<{ handle, ok, followersCount?, fetchedAt?, error?, reason? }> }`

Each handle is resolved independently, so a single invalid or failing handle
does not fail the whole batch. Possible `reason` values: `missing_token`,
`invalid_token`, `invalid_username`, `private_or_unavailable`,
`rate_limited`, `timeout`, `actor_error`, `malformed_response`.

## POST /api/publish

Admin-only. Validates a full tracker dataset and, if valid, commits it to
GitHub as the new canonical data file.

Request body: `{ "data": TrackerData, "expectedSha": string }`

`expectedSha` must be the SHA last read from `/api/admin/data`, used for
conflict-safe optimistic concurrency.

Responses:
- `200 { ok: true, commitSha: string, commitUrl: string }`
- `422 { error: string, issues: ValidationIssue[] }` — dataset failed validation.
- `409 { error: string, code: "conflict" }` — the file changed on GitHub since `expectedSha` was read; reload and retry.
- `503 { error: string }` — GitHub configuration is incomplete.
- `502 { error: string }` — GitHub publish failed for another reason.

## Removed endpoints

There are no endpoints for predictions, community features, voting,
leaderboards, notifications, or any Redis/KV-backed feature. None existed
in this build and none should be added without updating this document.
