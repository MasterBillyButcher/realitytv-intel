# Deployment

This project deploys to Vercel with no separate backend server, no Docker,
and no database.

## Standard flow

1. Local development against `.env.local`.
2. Commit and push to your GitHub repository.
3. Vercel automatically builds a preview deployment for the branch or pull
   request.
4. Verify the preview deployment (public tracker loads, admin login works,
   follower refresh works if you have test data).
5. Merge or push to the production branch (commonly `main`, matched by
   `GITHUB_BRANCH`).
6. Vercel builds and promotes the production deployment automatically.

## Publishing tracker data

When an admin uses "Publish Live" in the admin editor, the server commits
the updated `src/data/tracker-data.json` directly to `GITHUB_BRANCH` through
the GitHub API. That commit triggers the same Vercel build/deploy pipeline
as a manual push, so the public tracker picks up the change on the next
deploy, with no manual redeploy step required.

## Vercel project settings

- Framework preset: Next.js (auto-detected).
- Build command: default (`next build`).
- Output: default (`.next`).
- Node.js version: 20.x or later.
- No `vercel.json` is required for this project; add one only if you need
  to customize headers, redirects, or function regions.

## Environment variables on Vercel

Set every variable from `.env.example` in Project Settings -> Environment
Variables, for both Preview and Production. See docs/ENVIRONMENT.md for
what each one does.

## Recovering from a bad deployment

Vercel retains prior deployments. From the Deployments tab, select the last
known-good deployment and choose "Promote to Production" to roll back
immediately without reverting any code.

## Recovering a bad data publish

Because canonical data is a normal file in Git, recovering an earlier
version of the data is a normal Git operation:

```bash
git log -- src/data/tracker-data.json
git checkout <commit-sha> -- src/data/tracker-data.json
git commit -m "Restore tracker data from <commit-sha>"
git push
```

Pushing that commit redeploys the restored data the same way any publish
does.
