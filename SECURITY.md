# Security

## Admin authentication

There is a single administrator credential (`ADMIN_PASSWORD`), not a multi-user account system. On successful
login, the server issues a session token consisting of a base64url-encoded payload (issued-at and expiry
timestamps only) and an HMAC-SHA256 signature computed with `ADMIN_SESSION_SECRET`. The token is set as an
HTTP-only cookie, marked `secure` in production, with `SameSite=Lax` and an 8-hour expiry.

- The password comparison (`lib/auth.ts`, `safeCompare`) uses `crypto.timingSafeEqual` to avoid leaking
  information through response-time differences.
- The session token is stateless: validating it requires no database or cache lookup, which is what allows this
  application to run without Redis or any session store. A token cannot be forged without knowing
  `ADMIN_SESSION_SECRET`, and cannot be replayed past its expiry.
- Logout clears the cookie by setting `maxAge: 0`. There is no server-side token revocation list; a stolen token
  remains valid until it expires (at most 8 hours). If you need immediate revocation, rotate
  `ADMIN_SESSION_SECRET`, which invalidates every outstanding session at once.
- Every admin-only API route calls `requireAdminSession` (`lib/requireAdmin.ts`) and independently verifies the
  cookie server-side. The browser's own belief about whether it is logged in is never trusted.
- Every session-related request resolves to a finite state (`checking`, `authenticated`, `unauthenticated`, or
  `check_failed`) with a bounded timeout on the client (`lib/adminApi.ts`), specifically to prevent the "stuck on
  Checking..." failure mode from a prior version of this kind of tool.

## Secrets handling

- `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `GITHUB_TOKEN`, and `APIFY_TOKEN` are read only through
  `config/env.ts` and are never included in any API response, log line, or client bundle.
- `server/apify.ts` and `server/github.ts` import the `server-only` package, which causes the Next.js build to
  fail if either module is ever imported into client-side code, as a compile-time guardrail against accidental
  token exposure.
- Recommended GitHub token scope: fine-grained personal access token, Contents: Read and write, restricted to
  the single repository this project publishes to. Do not use a classic token with broader `repo` scope if you
  can avoid it.

## Outbound request timeouts

Every outbound call to GitHub and Apify goes through `fetchWithTimeout` (`lib/fetchWithTimeout.ts`), which aborts
the request after a fixed timeout (10 seconds default, 15 seconds for GitHub reads, 20 seconds for GitHub
writes, 30 seconds for Apify). This bounds how long any admin action can take and ensures a slow or unresponsive
third party cannot leave the UI loading indefinitely.

## Input validation

- All tracker data is validated against a Zod schema (`schemas/tracker.ts`) before being accepted by
  `/api/publish`, including duplicate ID checks, show-reference checks, duplicate history-date checks, and
  Instagram handle format checks.
- Bulk import rows are validated row-by-row (`BulkImportRowSchema`); invalid rows are reported, never silently
  dropped or silently applied.
- Instagram handles are validated both client-side (for immediate feedback) and server-side (`lib/instagram.ts`)
  before any Apify call is made.

## Rate limiting

This project does not implement a dedicated rate limiter for `/api/auth/login`, since it has no database or
Redis to track attempts across requests. If public exposure to brute-force login attempts is a concern for your
deployment, add rate limiting at the edge (for example, a Vercel Firewall rule limiting requests per IP to
`/api/auth/login`) rather than in application code, to avoid introducing a stateful dependency this project is
designed to avoid.

## Security headers

`next.config.js` sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, and a restrictive `Permissions-Policy` on every response.

## Known remaining issues

- `npm audit` reports advisories against the Next.js dependency tree that, per the advisory database, are fixed
  only in Next.js 16.x. This project pins the latest patched Next.js 14.2.x release (14.2.35) rather than
  adopting a major version upgrade, to keep the short-term tracker stable; revisit this before the next major
  maintenance window. Run `npm audit` after installing to see the current state, since new patches are released
  regularly.
- There is no automated dependency update process configured in this repository; review `npm outdated`
  periodically.
