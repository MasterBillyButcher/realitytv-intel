/* ═══════════════════════════════════════════════════════════
   api/auth/twitch/callback.js — Reality TV Intel 2026
   Twitch redirects here after the person approves the login. Flow:
     1. Verify `state` matches the cookie set by login.js (CSRF guard)
     2. Exchange the authorization code for an access token
     3. Fetch the person's Twitch profile (id, login, display name, avatar)
     4. Upsert their user record and issue our own session cookie
     5. Log the login to the real audit log
     6. Redirect back to the site

   REQUIRED ENV VARS: TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET
═══════════════════════════════════════════════════════════ */

import { upsertUser } from '../../_store.js';
import { issueUserSessionCookie } from '../../_usersession.js';
import { logAudit } from '../../_audit.js';
import { getClientIp } from '../../_ip.js';

function parseCookies(cookieHeader) {
  const out = {};
  (cookieHeader || '').split(';').forEach(part => {
    const eq = part.indexOf('=');
    if (eq === -1) return;
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  });
  return out;
}

export default async function handler(req, res) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    res.status(500).send('TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET are not configured on the server.');
    return;
  }

  const { code, state, error, error_description } = req.query || {};
  const ip = getClientIp(req);

  if (error) {
    await logAudit({ actor: 'unknown', actorType: 'user', action: 'twitch_login_denied', ip, success: false, detail: error_description || error });
    res.writeHead(302, { Location: '/?login=cancelled' });
    res.end();
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  if (!state || !cookies.rtv_oauth_state || state !== cookies.rtv_oauth_state) {
    await logAudit({ actor: 'unknown', actorType: 'user', action: 'twitch_login_state_mismatch', ip, success: false });
    res.status(400).send('Login request could not be verified (state mismatch) — please try logging in again.');
    return;
  }
  res.setHeader('Set-Cookie', 'rtv_oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); // consume it, one-time use

  if (!code) {
    res.status(400).send('Missing authorization code from Twitch.');
    return;
  }

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectUri = `${proto}://${host}/api/auth/twitch/callback`;

  try {
    // 1. Exchange code for token
    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.message || `Token exchange failed (HTTP ${tokenRes.status})`);
    }

    // 2. Fetch the logged-in user's own profile — no scope needed for this
    const userRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Client-Id': clientId,
      },
    });
    const userData = await userRes.json();
    const profile = userData?.data?.[0];
    if (!userRes.ok || !profile) {
      throw new Error('Could not fetch Twitch profile.');
    }

    // 3. Upsert + session + audit
    await upsertUser({
      id: profile.id,
      login: profile.login,
      displayName: profile.display_name,
      avatarUrl: profile.profile_image_url,
    });
    res.setHeader('Set-Cookie', issueUserSessionCookie(profile.id));
    await logAudit({ actor: profile.id, actorType: 'user', action: 'login', target: profile.login, ip, success: true });

    res.writeHead(302, { Location: '/?login=success' });
    res.end();
  } catch (err) {
    console.error('[twitch/callback] Login failed:', err.message);
    await logAudit({ actor: 'unknown', actorType: 'user', action: 'twitch_login_error', ip, success: false, detail: err.message });
    res.status(502).send(`Login failed: ${err.message}. Try again — if this keeps happening, the Twitch app credentials or redirect URI may be misconfigured.`);
  }
}
