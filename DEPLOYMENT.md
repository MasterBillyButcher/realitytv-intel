# Deployment

RealityTV Intel deploys to Vercel as a standard Next.js App Router project. No Docker, no separate backend
server, and no `vercel.json` is required; Vercel auto-detects Next.js and builds it correctly out of the box.

## Connect the repository to Vercel

1. Push this repository to GitHub (the same repository configured in `GITHUB_OWNER`/`GITHUB_REPO`, or a
   different one used purely for hosting; either works, since GitHub publishing and Vercel hosting are
   independent of each other).
2. In the Vercel dashboard, click "Add New", then "Project".
3. Import the GitHub repository.
4. Vercel will detect the Next.js framework automatically. Leave the build command and output settings on their
   defaults.

## Configure Vercel environment variables

Before the first deploy, go to the project's Settings, then Environment Variables, and add every variable listed
in `ENVIRONMENT.md`:

```
ADMIN_PASSWORD
ADMIN_SESSION_SECRET
GITHUB_TOKEN
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH
APIFY_TOKEN
```

Add them to the Production environment, and to Preview if you want preview deployments to have working admin
login and follower refresh. Use different values for Preview than Production if you want to isolate preview
admin sessions from your real published data. Do not set any of these as `NEXT_PUBLIC_*` variables; none of them
should ever be exposed to the browser.

## Deploy

Click "Deploy". Vercel will run `npm install` and `next build`. On success, you get a production URL.

## Redeploying after a Publish Live commit

Publish Live commits `data/data.json` to your GitHub repository's configured branch. If your Vercel project is
connected to that same repository and branch, Vercel will automatically trigger a new deployment on that commit,
and the public site will reflect the update once that deployment finishes (typically well under a minute for
this project's size). If your Vercel project is connected to a different repository than the one Publish Live
writes to, you will need to sync the data file over yourself, or point both at the same repository.

## Recovering an earlier published data version

There is no separate revision database. GitHub's commit history for `data/data.json` is the version history.

To find an earlier version:

```
git log --oneline -- data/data.json
```

To view a specific past version:

```
git show <commit-sha>:data/data.json
```

To restore an earlier version as the current one:

```
git checkout <commit-sha> -- data/data.json
git commit -m "Restore tracker data from <commit-sha>"
git push
```

Pushing that commit will trigger a new Vercel deployment with the restored data, the same way any other publish
does.

## Recovering from a failed deployment

1. In the Vercel dashboard, open the project's Deployments tab and click the failed deployment to view its build
   log.
2. Common causes and fixes:
   - Missing environment variable: add it under Settings, then Environment Variables, and redeploy.
   - Type or lint error introduced by a manual code change: run `npm run typecheck` and `npm run lint` locally,
     fix the reported issue, and push again.
   - `data/data.json` failed validation (for example, a contestant referencing a show that no longer exists):
     the build will fail when the public pages try to load the data. Fix the file directly (or restore an
     earlier version as described above) and push again.
3. Vercel keeps the previous successful deployment live until a new one succeeds, so a failed deploy does not
   take the public site down.

## Inspecting logs

- Build logs: Vercel dashboard, Deployments tab, click any deployment.
- Runtime logs (API route errors, follower refresh failures, publish failures): Vercel dashboard, project,
  "Logs" tab (sometimes labeled "Runtime Logs" or "Functions"), filterable by route and time range.
- This application never logs passwords, session secrets, or access tokens; if you see a token in a log line,
  it originated from a change outside this codebase and should be treated as a leak.
