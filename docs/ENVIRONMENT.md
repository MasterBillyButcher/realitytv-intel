# Environment Variables

All variables below are server-only unless stated otherwise. None are
exposed to the browser (no `NEXT_PUBLIC_` prefixed secrets exist in this
project).

| Variable | Required for | Description |
|---|---|---|
| `ADMIN_PASSWORD` | Admin login | The password checked against admin login attempts. Compared using a constant-time comparison. |
| `ADMIN_SESSION_SECRET` | Admin login, session checks | Signs the admin session cookie. Must be at least 16 characters; 32+ random hex characters recommended. Changing this value invalidates all existing admin sessions. |
| `GITHUB_TOKEN` | Publishing, loading live data in the admin editor | A GitHub token with Contents: Read and write on the target repository. Never sent to the browser. |
| `GITHUB_OWNER` | Same as above | The GitHub account or organization that owns the repository. |
| `GITHUB_REPO` | Same as above | The repository name, without the owner. |
| `GITHUB_BRANCH` | Same as above | The branch read from and published to. |
| `APIFY_TOKEN` | Follower refresh | Your Apify API token. Never sent to the browser. |
| `APIFY_ACTOR_ID` | Follower refresh (optional) | Overrides the Apify actor used for follower lookups. Defaults to `apify/instagram-followers-count-scraper`. |

## What happens if a variable is missing

Every server route that depends on one of these checks for it explicitly
and returns a clear error naming the missing variable, rather than hanging
or throwing an unhandled exception:

- Missing `ADMIN_PASSWORD` or `ADMIN_SESSION_SECRET`: login returns a 503
  with a message naming the missing variable.
- Missing `GITHUB_TOKEN`/`GITHUB_OWNER`/`GITHUB_REPO`/`GITHUB_BRANCH`:
  loading or publishing data returns a 503 listing exactly which of the
  four is missing.
- Missing `APIFY_TOKEN`: a follower refresh attempt returns a
  `missing_token` error for that handle.

## What is never read from the client

`GITHUB_TOKEN` and `APIFY_TOKEN` are used only inside server-only modules
(`src/lib/github.ts`, `src/lib/apify.ts`) that are imported exclusively by
API routes, never by client components. Only `ADMIN_SESSION_SECRET` is used
to sign/verify a cookie; the secret itself is never placed in the cookie or
sent to the browser.
