/* ═══════════════════════════════════════════════════════════
   /api/followers.js — Reality TV Intel 2026
   Server-side proxy to Apify's Instagram Followers Count Scraper
   (apify/instagram-followers-count-scraper).

   Field names below are CONFIRMED from a real successful run
   (2026-07-02, ravikishann → 4,001,622 followers), not guessed:
   { profilePic, userName, followersCount, followsCount, timestamp,
     userUrl, userFullName, userId }

   WHY THIS EXISTS:
   Instagram blocks browser-side requests, and an Apify token can't
   safely live in client-side JS (any visitor could steal it from
   page source). This function is the only place the token is used —
   it runs on Vercel's servers, never ships to the browser.

   ONE-TIME SETUP (already done for this actor, keep for reference):
   1. Open https://apify.com/apify/instagram-followers-count-scraper
   2. Click Start once, logged into the account whose token is below —
      required for ANY paid actor before API calls work, platform-wide.
      Repeat this once per Apify ACCOUNT if using multiple keys below.
   3. Vercel → Project → Settings → Environment Variables:
      APIFY_TOKEN = <your Apify API token>
      To use multiple accounts (each gets its own free $5/month credit),
      set APIFY_TOKEN to a comma-separated list instead:
      APIFY_TOKEN = token_from_account_1,token_from_account_2,token_from_account_3
      Each must be a real token from a SEPARATE Apify account — using
      two tokens from the same account shares the same quota, so it
      won't actually extend anything.
   4. Redeploy.
   Never commit any token to GitHub — this file only reads them from
   process.env, injected by Vercel at runtime.

   FAILOVER: tries each token in order. If one comes back 402 (out of
   quota) or 401 (invalid/revoked), it automatically retries the same
   request with the next token before giving up — so refreshing
   followers keeps working seamlessly once one account's free credit
   runs out for the month, as long as at least one token still has
   quota left.

   AUTH: gated behind the same signed session cookie used by the admin
   login flow (see api/_auth.js, api/verify-admin.js). Before this gate
   existed, this endpoint had NO server-side access control at all —
   the "admin-only" button was purely cosmetic client-side UI. Anyone
   who found this URL could call it directly (curl, fetch from another
   site, etc.) and spend the site owner's real Apify usage credits,
   regardless of whether they were logged in as admin on the page.
═══════════════════════════════════════════════════════════ */

import { isValidAdminSession } from './_auth.js';

const APIFY_ACTOR = 'apify~instagram-followers-count-scraper';
const APIFY_URL = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`;
const MAX_USERNAMES_PER_REQUEST = 60; // safety cap — avoid accidental huge/expensive runs
const APIFY_TIMEOUT_MS = 90000; // Apify runs aren't instant; give it real time before giving up

/** Parse APIFY_TOKEN into a list — supports a single token or a
 * comma-separated list of tokens from multiple Apify accounts. */
function getApifyTokens() {
  const raw = process.env.APIFY_TOKEN || '';
  return raw.split(',').map(t => t.trim()).filter(Boolean);
}

/** Try one token against Apify. Returns { ok, status, json, text }. */
async function tryApifyCall(token, usernames, signal) {
  const apifyRes = await fetch(`${APIFY_URL}?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames }),
    signal,
  });
  if (!apifyRes.ok) {
    const errText = await apifyRes.text().catch(() => '');
    return { ok: false, status: apifyRes.status, text: errText };
  }
  return { ok: true, status: apifyRes.status, json: await apifyRes.json() };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST' });
    return;
  }

  if (!isValidAdminSession(req)) {
    res.status(401).json({ error: 'Admin session required. Log in via the Admin button, then try again.' });
    return;
  }

  const tokens = getApifyTokens();
  if (!tokens.length) {
    res.status(500).json({
      error: 'APIFY_TOKEN is not configured on the server. Add it in Vercel → Project → Settings → Environment Variables, then redeploy.'
    });
    return;
  }

  let usernames;
  try {
    usernames = Array.isArray(req.body?.usernames) ? req.body.usernames : [];
  } catch {
    usernames = [];
  }

  // Clean up: strip @ prefixes, whitespace, drop empties/N-V placeholders, dedupe
  usernames = [...new Set(
    usernames
      .map(u => String(u || '').trim().replace(/^@/, ''))
      .filter(u => u && u.toLowerCase() !== 'n/v')
  )];

  if (!usernames.length) {
    res.status(400).json({ error: 'No valid Instagram usernames provided.' });
    return;
  }
  if (usernames.length > MAX_USERNAMES_PER_REQUEST) {
    res.status(400).json({
      error: `Too many usernames in one request (${usernames.length}). Max is ${MAX_USERNAMES_PER_REQUEST} — split into batches.`
    });
    return;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), APIFY_TIMEOUT_MS);

    let result = null;
    const attempts = [];
    for (let i = 0; i < tokens.length; i++) {
      const attempt = await tryApifyCall(tokens[i], usernames, controller.signal);
      attempts.push({ tokenIndex: i, status: attempt.status });

      if (attempt.ok) {
        result = attempt;
        break; // success — stop trying further tokens
      }

      // Only fail over to the next token for quota/auth problems —
      // a 400 (bad request) or 5xx (Apify's own outage) would fail
      // identically on every token, so retrying those is pointless
      // and just wastes time before the real error reaches the user.
      const isQuotaOrAuthIssue = attempt.status === 402 || attempt.status === 401;
      if (!isQuotaOrAuthIssue || i === tokens.length - 1) {
        clearTimeout(timer);
        res.status(attempt.status).json({
          error: `Apify returned ${attempt.status}: ${(attempt.text || '').slice(0, 300)}`,
          triedTokens: attempts.length,
          totalTokensConfigured: tokens.length,
        });
        return;
      }
      // else: loop continues to the next token automatically
    }
    clearTimeout(timer);

    const items = result.json;
    const itemsArr = Array.isArray(items) ? items : [];

    // Confirmed real field names for successful items — see header comment.
    // Failed items' shape isn't confirmed (we've only seen this actor's
    // success case), so check common failure-indicator patterns
    // defensively rather than assuming a silent success/omit split.
    const results = itemsArr.map(item => {
      const errMsg =
        item.error || item.errorMessage ||
        (item.status && item.status !== 'ok' ? String(item.status) : null) ||
        (item.success === false ? 'Marked unsuccessful by Apify' : null);
      return {
        username: String(item.userName || item.username || '').replace(/^@/, ''),
        followers: item.followersCount ?? null,
        fullName: item.userFullName || null,
        error: errMsg,
        raw: item,
      };
    }).filter(r => r.username || r.error);

    // Usernames we sent that never appear in the response at all — this
    // actor may simply omit failed profiles instead of returning an
    // error object for them, which is the most likely explanation for
    // "some succeed, one fails with no message."
    const returnedHandles = new Set(results.map(r => r.username.toLowerCase()));
    const missing = usernames.filter(u => !returnedHandles.has(u.toLowerCase()));
    missing.forEach(u => results.push({
      username: u,
      followers: null,
      error: 'Not present in Apify response — likely private account, wrong/renamed handle, deleted account, or Instagram blocked this specific lookup. Check Apify Console → this run → Log tab for the per-profile reason.',
      raw: null,
    }));

    res.status(200).json({
      results,
      requested: usernames.length,
      received: results.filter(r => r.followers !== null).length,
      rawItemCount: itemsArr.length,
      sampleRaw: itemsArr.slice(0, 2),
      tokensConfigured: tokens.length,
      tokensAttempted: attempts.length, // >1 means an earlier token failed over
      note: itemsArr.length === 0
        ? 'Apify run completed but returned zero dataset items. Check Apify Console → this actor → Runs tab.'
        : (results.filter(r => r.followers !== null).length === 0
          ? 'Apify returned data, but field extraction found no userName values — check sampleRaw in the browser console.'
          : undefined),
    });

  } catch (err) {
    const isAbort = err.name === 'AbortError';
    res.status(isAbort ? 504 : 500).json({
      error: isAbort
        ? 'Apify run timed out. Try a smaller batch, or check the run status in your Apify console.'
        : `Server error calling Apify: ${err.message}`
    });
  }
}
