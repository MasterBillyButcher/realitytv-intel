# RealityTV Intel

A focused tracker for reality television contestants and their real Instagram
follower counts, covering KKK, Lock Upp, Alliance India, Traitors India, and
Bigg Boss. Built with Next.js, hosted on Vercel, with GitHub as the canonical
data store and Apify as the source of real follower numbers.

This is the short-term production version. It intentionally does not include
predictions, community features, voting, leaderboards, user accounts, or any
system that depends on Redis or a database.

## What this is

- A public tracker: search, filter, sort, and rank contestants by real
  current follower counts, per show and across all shows.
- An admin editor: add, edit, and remove contestants, refresh follower
  counts from Instagram, bulk-update existing records, and publish changes
  live through a single GitHub commit.
- No fake data anywhere. If a follower count has not been fetched yet, the
  UI says so instead of guessing.

## Documentation

- [docs/SETUP.md](docs/SETUP.md) — install, configure, and run locally
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — deploy to Vercel
- [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) — every environment variable, explained
- [docs/API.md](docs/API.md) — every API route, its inputs, and its errors
- [docs/SECURITY.md](docs/SECURITY.md) — authentication, secrets, and data safety

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in real values, see docs/SETUP.md
npm run dev
```

Open http://localhost:3000. The public tracker works immediately. The admin
editor at /admin needs ADMIN_PASSWORD and ADMIN_SESSION_SECRET set; follower
refresh needs APIFY_TOKEN; publishing needs the GITHUB_* variables.

## Architecture in one paragraph

Canonical tracker data lives in `src/data/tracker-data.json`, committed to
the repository. The public site reads that file at build time, so it is
fast and has no runtime dependency on GitHub. The admin editor reads the
live version from GitHub (with its commit SHA) so it can publish safely:
edits are kept as a local draft in the browser until "Publish Live" commits
a new version of that file through the GitHub API, which then triggers a
normal Vercel redeploy. Follower refresh calls Apify server-side and never
exposes the Apify token to the browser. Admin login uses a signed, expiring
cookie with no database or cache behind it, so login and session checks
never hang waiting on an external service.

## Testing

```bash
npm run test    # unit tests: growth, search/filter/sort, validation, sessions,
                 # follower-refresh state transitions, GitHub client (mocked),
                 # Apify client (mocked)
npm run lint
npm run build
```

## Project structure

```
src/
  app/            Pages and API routes (Next.js App Router)
  components/     Shared UI components
  data/           Canonical tracker data (committed to the repo)
  lib/            Core logic: growth, search/sort, validation, auth, GitHub, Apify
  types/          Shared TypeScript types
tests/            Vitest unit tests for src/lib
docs/             Setup, deployment, environment, API, and security docs
```
