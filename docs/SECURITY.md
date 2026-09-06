# Security

## Authentication

Admin access is a single shared password (`ADMIN_PASSWORD`), compared with
a constant-time comparison to avoid timing attacks. On success, the server
issues a signed session cookie:

- Signed with HMAC-SHA256 using `ADMIN_SESSION_SECRET`.
- Contains only a role marker and expiration timestamp, no personal data.
- `httpOnly`, `sameSite=lax`, and `secure` in production.
- Expires after 12 hours server-side, enforced independent of the cookie's
  own browser expiry.
- Validated with a signature check, so a tampered cookie is rejected.
- Validation is entirely local (no database or cache lookup), so it cannot
  hang or fail due to an external outage; a missing or invalid secret
  produces an explicit `config_error` rather than an indefinite loading
  state.

## Secrets

- `GITHUB_TOKEN` and `APIFY_TOKEN` are read only inside server-only modules
  (`src/lib/github.ts`, `src/lib/apify.ts`), which are imported only by API
  routes and never bundled into client-side code.
- No `NEXT_PUBLIC_`-prefixed variable is used for anything sensitive.
- Secrets are never logged. Errors surfaced to the client describe what
  went wrong (e.g. "GitHub read failed with status 404") without including
  raw tokens, headers, or provider stack traces.

## Authorization

Every admin-only route (`/api/admin/data`, `/api/followers/refresh`,
`/api/publish`) checks the session cookie server-side on every request.
The client's own belief about whether it is logged in is never trusted;
a request without a valid session is rejected with `401` regardless of
what the browser's UI state currently shows.

## Input validation

- Instagram handles are validated against Instagram's own username rules
  before being sent to Apify.
- The full tracker dataset is validated with a schema (types, required
  fields, enums) plus cross-reference checks (every contestant's `show`
  must reference a real show, contestant ids must be unique) before any
  publish is accepted.
- Bulk import only ever patches a fixed allow-list of fields on contestants
  matched by an existing, validated Instagram handle; it cannot inject
  arbitrary fields or create records with attacker-controlled ids.

## Data safety

- Publishing to GitHub uses the file's current SHA as an optimistic
  concurrency check. If the file changed since the admin last loaded it,
  the publish is rejected with a conflict instead of silently overwriting
  the newer version.
- Local admin drafts are never discarded automatically, even when the
  published file has changed underneath them; the admin is shown a warning
  and asked to review before publishing over a newer change.
- A follower refresh never overwrites `followersBefore` after it is first
  set, and never records more than one history entry per contestant per
  day.

## Timeouts

Every outbound call (to GitHub, to Apify) uses an `AbortController` with a
finite timeout, so a slow or unresponsive third party cannot leave an API
route, and therefore the browser, waiting indefinitely.

## No Redis, no database

This build has no Redis dependency and no database of any kind. Admin
sessions are stateless and signed; tracker data is a version-controlled
file in Git. There is nothing for a cache or database outage to break.

## Reporting a concern

If you find a security issue in this codebase, report it to the site
operator through the contact channel in the footer rather than filing a
public issue with exploit details.
