# Setup

A complete walkthrough for a developer with no prior knowledge of this
project.

## 1. Install Node

Install Node.js 20 or later from https://nodejs.org, or with a version
manager:

```bash
nvm install 20
nvm use 20
```

## 2. Clone the repository

```bash
git clone https://github.com/<your-owner>/<your-repo>.git
cd <your-repo>
```

## 3. Install dependencies

```bash
npm install
```

## 4. Create .env.local

```bash
cp .env.example .env.local
```

You will fill in each value in the following steps.

## 5. Generate ADMIN_PASSWORD

Pick any strong password, or generate one:

```bash
openssl rand -base64 18
```

Put the result in `.env.local` as `ADMIN_PASSWORD`.

## 6. Generate ADMIN_SESSION_SECRET

```bash
openssl rand -hex 32
```

Put the result in `.env.local` as `ADMIN_SESSION_SECRET`. This must be at
least 16 characters; 32+ random hex characters is recommended.

## 7. Create a GitHub token

1. Go to https://github.com/settings/tokens?type=beta (fine-grained tokens).
2. Click "Generate new token".
3. Under "Repository access", select "Only select repositories" and choose
   the repository that will hold this project's data.
4. Under "Permissions" -> "Repository permissions", set **Contents** to
   **Read and write**.
5. Generate the token and copy it immediately (it will not be shown again).

Put it in `.env.local` as `GITHUB_TOKEN`.

## 8. Configure GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH

- `GITHUB_OWNER`: your GitHub username or organization name.
- `GITHUB_REPO`: the repository name only, without the owner (e.g. `realitytv-intel`).
- `GITHUB_BRANCH`: the branch to read from and publish to (e.g. `main`).

## 9. Create an Apify account and get APIFY_TOKEN

1. Sign up at https://apify.com.
2. Go to https://console.apify.com/settings/integrations.
3. Copy your personal API token.

Put it in `.env.local` as `APIFY_TOKEN`. Leave `APIFY_ACTOR_ID` unset unless
you specifically need to point at a different actor than the default
(`apify/instagram-followers-count-scraper`); check the Apify Store for the
current recommended actor if follower refresh starts failing, since actors
on Apify's marketplace can change over time.

## 10. Run locally

```bash
npm run dev
```

Open http://localhost:3000.

## 11. Test admin login

1. Go to http://localhost:3000/admin.
2. Enter the password you set as `ADMIN_PASSWORD`.
3. You should land on `/admin/dashboard`. If you see an error instead, it
   will name what is missing (e.g. a missing environment variable) rather
   than hang on a loading state.

## 12. Test follower refresh

1. Add a contestant in the admin editor with a real, public Instagram
   handle.
2. Click "Refresh followers" on that contestant's row.
3. The follower count should update within a few seconds. If it fails, the
   error will say why (invalid handle, private profile, missing token,
   rate limited, etc.).

## 13. Test publishing

1. Make an edit (add, edit, or remove a contestant).
2. Click "Publish live".
3. On success you will see a shortened commit SHA. Check your repository's
   commit history to confirm the commit landed.

## 14. Connect Vercel

1. Go to https://vercel.com/new and import your GitHub repository.
2. Vercel will detect the Next.js framework automatically.

## 15. Configure Vercel environment variables

In your Vercel project, go to Settings -> Environment Variables and add all
seven variables from `.env.example` with your real values, for both
Production and Preview environments.

## 16. Deploy

Push to your configured branch, or click "Deploy" in the Vercel dashboard.
Vercel will build and deploy automatically on every push to that branch,
including the commits made by "Publish Live".

## 17. Inspect logs

Use the Vercel dashboard's "Logs" tab for a deployment, or `vercel logs
<deployment-url>` with the Vercel CLI, to see runtime logs for API routes.

## 18. Recover a failed deployment

Vercel keeps previous successful deployments. In the dashboard, go to
Deployments, find the last known-good deployment, and use "Promote to
Production" to roll back instantly while you investigate the failure.
