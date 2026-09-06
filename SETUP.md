# Setup Guide

This guide assumes no prior knowledge of the project. Follow it in order.

## 1. Install Node.js

Install Node.js 18.18 or later (Node 20 LTS is recommended).

- macOS: `brew install node@20`
- Windows: download the installer from https://nodejs.org and run it
- Linux: use your distribution's package manager, or https://nodejs.org

Verify with:

```
node -v
npm -v
```

## 2. Clone the repository

```
git clone https://github.com/<your-org>/<your-repo>.git
cd <your-repo>
```

## 3. Install dependencies

```
npm install
```

## 4. Create your local environment file

```
cp .env.example .env.local
```

You will fill in `.env.local` in the following steps. `.env.local` is already excluded by `.gitignore` and must
never be committed.

## 5. Generate ADMIN_PASSWORD

Choose a long, unique password. You can generate a random one with:

```
openssl rand -base64 18
```

Put the result in `.env.local` as:

```
ADMIN_PASSWORD=<your generated password>
```

## 6. Generate ADMIN_SESSION_SECRET

This secret signs admin session cookies. Generate a 32-byte hex value:

```
openssl rand -hex 32
```

Put it in `.env.local` as:

```
ADMIN_SESSION_SECRET=<the generated hex string>
```

## 7. Create a GitHub token

Publish Live writes `data/data.json` to your GitHub repository using the GitHub REST API, so you need a token
scoped to that repository only.

1. In GitHub, go to Settings, then Developer settings, then Fine-grained personal access tokens.
2. Click "Generate new token".
3. Under Repository access, choose "Only select repositories" and select the repository you cloned in step 2.
4. Under Permissions, set **Contents** to **Read and write**. No other permissions are required.
5. Generate the token and copy it immediately; GitHub will not show it again.

Put it in `.env.local` as:

```
GITHUB_TOKEN=<your fine-grained token>
```

## 8. Configure GITHUB_OWNER, GITHUB_REPO, and GITHUB_BRANCH

- `GITHUB_OWNER` is the GitHub username or organization that owns the repository, for example `your-org`.
- `GITHUB_REPO` is the repository name only, for example `realitytv-intel` (not the full URL).
- `GITHUB_BRANCH` is the branch Publish Live commits to and the branch your deployment reads from, typically
  `main`.

```
GITHUB_OWNER=your-org
GITHUB_REPO=realitytv-intel
GITHUB_BRANCH=main
```

## 9. Create an Apify account and get APIFY_TOKEN

1. Go to https://apify.com and create a free account.
2. Once signed in, go to Settings, then Integrations (or Account, then Integrations, depending on the current
   Apify console layout) to find your personal API token.
3. Copy the token.

Put it in `.env.local` as:

```
APIFY_TOKEN=<your apify token>
```

By default this project calls the Apify-maintained "Instagram Profile Scraper" actor
(`apify/instagram-profile-scraper`). Apify Store actors can change their input and output shape over time.
Before relying on this in production, open the actor's page in the Apify Console and confirm its current input
field for usernames and its output field for follower count. If they differ from the defaults, set:

```
APIFY_ACTOR_ID=<actor id, if different from the default>
APIFY_FOLLOWERS_FIELD=<output field name, if different from followersCount>
```

You do not need to add credit card details to Apify to test with its free usage tier, but very large refresh
batches may require a paid plan.

## 10. Run the app locally

```
npm run dev
```

Visit http://localhost:3000. The public tracker will load with the five configured shows and no contestants
until you add some.

## 11. Test admin login

1. Visit http://localhost:3000/admin.
2. Enter the `ADMIN_PASSWORD` you set in step 5.
3. You should land in the admin workspace. If you enter the wrong password, you will see "Incorrect password."
   immediately, not an indefinite loading state.

## 12. Test follower refresh

1. In the admin workspace, click "Add contestant" and fill in a real Instagram handle for a public account.
2. Save the contestant.
3. Click "Refresh" on that contestant's row.
4. If `APIFY_TOKEN` is valid, the follower count should populate within a few seconds. If it is missing or
   invalid, you will see a clear error message in place of the count, never a fabricated number.

## 13. Test publishing

1. After adding or editing contestants, note the save state indicator at the top of the admin workspace.
2. Click "Publish Live".
3. On success, you will see a confirmation with a short commit hash. Check your GitHub repository's commit
   history to confirm `data/data.json` was updated.
4. To test conflict handling, open the admin workspace in two browser tabs, publish from one, then attempt to
   publish an older draft from the other. You should see a message asking you to reload the latest data.

## 14. Connect Vercel

See `DEPLOYMENT.md` for connecting the repository to Vercel, configuring the same environment variables there,
and deploying.

## 15. Run the test suite and production build locally (optional but recommended)

```
npm run typecheck
npm run lint
npm test
npm run build
```

All four should complete without errors before you deploy.
