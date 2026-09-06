/* ═══════════════════════════════════════════════════════════
   api/auth/twitch/login.js — Reality TV Intel 2026
   Redirects to Twitch's OAuth authorize screen. Generates a random
   `state` value and stores it in a short-lived cookie — the callback
   verifies the state matches before trusting anything else in the
   response, which is the standard defense against an attacker tricking
   someone into completing an OAuth flow that logs them into the
   attacker's account (CSRF on the login flow itself).

   REQUIRED ENV VARS: TWITCH_CLIENT_ID
   Register the app at dev.twitch.tv/console/apps — the OAuth Redirect
   URL there must exactly match this deployment's
   /api/auth/twitch/callback URL (register both your production domain
   and any preview domains you want login to work on).
═══════════════════════════════════════════════════════════ */

import crypto from 'crypto';

export default async function handler(req, res) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) {
    res.status(500).send('TWITCH_CLIENT_ID is not configured on the server.');
    return;
  }

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectUri = `${proto}://${host}/api/auth/twitch/callback`;

  const state = crypto.randomBytes(16).toString('hex');
  const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const secureFlag = isProd ? ' Secure;' : '';
  res.setHeader('Set-Cookie', `rtv_oauth_state=${state}; HttpOnly;${secureFlag} SameSite=Lax; Path=/; Max-Age=600`);

  const authorizeUrl = new URL('https://id.twitch.tv/oauth2/authorize');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', ''); // no extra scopes — we only need the public profile, which needs none
  authorizeUrl.searchParams.set('state', state);

  res.writeHead(302, { Location: authorizeUrl.toString() });
  res.end();
}
