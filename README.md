# RealityTV Intel

RealityTV Intel is a reality television contestant and Instagram follower tracker. It tracks contestants across
KKK, Lock Upp, Alliance India, Traitors India, and Bigg Boss, recording real Instagram follower counts, growth,
and rankings over time.

This is the short-term, production version of the product: a small, fast, reliable tracker, not the larger
platform vision. It intentionally has no database, no Redis, and no user accounts beyond a single administrator.

## What it does

- Public tracker with search, filtering, sorting, and cross-show rankings, all backed by real data only
- Admin workspace for adding, editing, and removing contestants and shows
- Live Instagram follower refresh through Apify (single contestant, a whole show, or everything)
- Follower history, absolute and percentage growth, with explicit "unavailable" states instead of fake numbers
- Bulk import matched by exact Instagram handle, with per-row validation
- CSV and JSON export of the current tracker data
- Publish Live: validates data, then commits it to a GitHub repository, which is both the canonical data store and
  the version history
- Privacy Policy and Terms and Conditions pages describing the actual implementation

## How data is stored

There is no database. The canonical dataset lives at `data/data.json` in this repository. Publishing writes to
that file through the GitHub Contents API, GitHub commits the change, and the public site reads the file directly.
Git history is the version history; see `DEPLOYMENT.md` for how to restore an earlier version.

## Documentation

- `SETUP.md`: install, configure, and run locally, step by step
- `DEPLOYMENT.md`: deploying to Vercel and recovering from a failed deployment
- `ENVIRONMENT.md`: every environment variable, what it does, and how to generate it
- `API.md`: every API route, its inputs, and its possible responses
- `SECURITY.md`: authentication design, token handling, and known limitations

## Stack

Next.js 14 (App Router) with TypeScript and Tailwind CSS, deployed as a single Vercel project with server routes.
No separate backend, no Docker, no queues, no Redis, no Vercel KV.

## No source data was preserved because none was provided

This project was built without an existing source repository or data export attached to the request that
generated it. The five shows named in the project brief are present in `data/data.json`, but the contestants
array is intentionally empty. No contestant data has been invented. Use the admin bulk import or the "Add
contestant" form to populate real data, then Publish Live.
