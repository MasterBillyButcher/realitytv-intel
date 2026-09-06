# API Reference

All routes live under `app/api/` and run on the Node.js runtime (not Edge), since they use `node:crypto` and
Node's `fetch`/`Buffer` APIs. All routes return JSON except the CSV export.

## POST /api/auth/login

Authenticates an administrator and issues a session cookie.

Request body:

```json
{ "password": "string" }
```

Responses:

- `200` `{ "ok": true }` with a `Set-Cookie` header for the session, on success.
- `400` `{ "ok": false, "error": "invalid_request" | "missing_password" }` for a malformed or empty request.
- `401` `{ "ok": false, "error": "invalid_password", "message": "Incorrect password." }` for a wrong password.
- `500` `{ "ok": false, "error": "server_misconfigured", "message": "..." }` if `ADMIN_PASSWORD` or
  `ADMIN_SESSION_SECRET` is not configured.

## POST /api/auth/logout

Clears the session cookie. Always returns `200 { "ok": true }`.

## GET /api/auth/session

Reports whether the current request has a valid admin session. Always resolves; never depends on any external
service, so it cannot hang.

Response: `200 { "authenticated": boolean, "reason"?: string }`. When `authenticated` is `false`, `reason` is one
of `malformed`, `invalid_signature`, `expired`, or `missing_secret`.

## GET /api/publish

Admin-only. Fetches the currently published `data/data.json` directly from GitHub, along with its SHA, so the
admin editor can base new edits on the latest version.

Responses:

- `200` `{ "ok": true, "data": TrackerData, "sha": "string" }`
- `401` if there is no valid admin session.
- `404` `{ "ok": false, "error": "not_found" }` if the file does not exist yet in the repository.
- `502` `{ "ok": false, "error": "missing_config" | "auth_failed" | ... }` on a GitHub configuration or auth
  problem.

## POST /api/publish

Admin-only. Validates and publishes tracker data to GitHub.

Request body:

```json
{ "data": TrackerData, "baseSha": "string | null", "message": "string (optional)" }
```

Responses:

- `200` `{ "ok": true, "commitSha": "string", "commitUrl": "string" }` on success.
- `401` if there is no valid admin session.
- `422` `{ "ok": false, "error": "validation_failed", "issues": [{ "path": "string", "message": "string" }] }` if
  the data fails schema validation. Nothing is written to GitHub in this case.
- `409` `{ "ok": false, "error": "conflict", "message": "..." }` if `baseSha` does not match the file's current
  SHA on GitHub (someone else published in the meantime).
- `502` for GitHub auth or configuration failures; `500` for unexpected failures.

Publishing always writes exactly one file, `data/data.json`, and never touches any other path in the repository.

## POST /api/followers/refresh

Admin-only. Calls Apify server-side to retrieve real, current follower counts for one or more contestants.

Request body:

```json
{ "targets": [{ "contestantId": "string", "instagramHandle": "string" }] }
```

Up to 100 targets per request. Targets are processed sequentially.

Response: `200 { "ok": true, "results": [{ "contestantId": "string", "ok": boolean, "followers"?: number, "error"?: "string" }] }`.
Each target's result is independent; one failing handle does not fail the whole batch. Errors are safe,
human-readable messages (for example "This Instagram profile is private and cannot be tracked."), never raw
Apify responses or tokens.

## GET /api/export

Public. Exports the currently published tracker data.

Query parameters:

- `format`: `csv` (default) or `json`.
- `showId`: optional, restricts the export to one show.

The CSV response is served with `Content-Type: text/csv` and a `Content-Disposition` attachment header. Both
formats include the same computed fields (rank, growth) that the public tracker displays, calculated from the
same real data, so the export never diverges from what visitors see on the site.
