# Environment Variables

Copy `.env.example` to `.env.local` for local development and set the same variables in Vercel's project
settings for deployed environments. Every variable below is server-only unless stated otherwise; none of them
are exposed to the browser, and none use the `NEXT_PUBLIC_` prefix.

| Variable | Required | Server-only | Purpose |
|---|---|---|---|
| `ADMIN_PASSWORD` | Yes | Yes | Plain-text password checked against admin login submissions using a constant-time comparison. |
| `ADMIN_SESSION_SECRET` | Yes | Yes | HMAC-SHA256 key used to sign and verify admin session cookies. Generate with `openssl rand -hex 32`. |
| `GITHUB_TOKEN` | Yes, for publishing | Yes | Fine-grained GitHub personal access token with Contents: Read and write on the target repository. Used to read and write `data/data.json` via the GitHub Contents API. |
| `GITHUB_OWNER` | Yes, for publishing | Yes | GitHub username or organization that owns the repository. |
| `GITHUB_REPO` | Yes, for publishing | Yes | Repository name (no owner prefix, no `.git` suffix). |
| `GITHUB_BRANCH` | No (defaults to `main`) | Yes | Branch that Publish Live commits to and the branch the public site's data reflects. |
| `APIFY_TOKEN` | Yes, for follower refresh | Yes | Apify API token used server-side to call the Instagram follower actor. |
| `APIFY_ACTOR_ID` | No (defaults to `apify/instagram-profile-scraper`) | Yes | Overrides which Apify actor is called, in case the default actor's availability or shape changes. |
| `APIFY_FOLLOWERS_FIELD` | No (defaults to `followersCount`) | Yes | Overrides which field in the actor's output item holds the follower count. |

## What happens if a variable is missing

The application is designed to fail predictably, not hang, when configuration is missing:

- Missing `ADMIN_PASSWORD` or `ADMIN_SESSION_SECRET`: `/api/auth/login` returns HTTP 500 with a message naming
  the missing variable. Login is not possible until it is set.
- Missing `GITHUB_TOKEN`, `GITHUB_OWNER`, or `GITHUB_REPO`: `/api/publish` (both loading the current published
  data and publishing new data) returns a `missing_config` error naming the missing variables.
- Missing `APIFY_TOKEN`: follower refresh returns a `missing_token` error for every contestant in the request,
  surfaced in the admin UI as "Follower refresh is not configured."

## Never expose these to the browser

None of these variables should be prefixed with `NEXT_PUBLIC_`, referenced in client components, or returned in
any API response body. `config/env.ts` centralizes access to them so that every read goes through one audited
module. `server/apify.ts` and `server/github.ts` both import the Next.js `server-only` package, which fails the
build if either module is ever imported from client-side code.
