/* ═══════════════════════════════════════════════════════════
   api/_usersession.js — Reality TV Intel 2026
   Same signed-cookie pattern as _auth.js (admin sessions), kept as a
   separate module rather than merged into it: different cookie name,
   different payload shape (carries a Twitch user ID), and a separate
   signing secret — so a regular user session and an admin session are
   fully independent trust domains. BobMasterBillie can be logged in
   as both at once, and rotating one secret never affects the other.

   REQUIRED ENV VAR: USER_SESSION_SECRET — any long random string,
   separate from ADMIN_SESSION_SECRET.
═══════════════════════════════════════════════════════════ */

import crypto from 'crypto';

const SESSION_DAYS = 30; // fans stay logged in — this isn't a sensitive admin action
const COOKIE_NAME = 'rtv_user_session';

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function issueUserSessionCookie(twitchId) {
  const secret = process.env.USER_SESSION_SECRET;
  if (!secret) throw new Error('USER_SESSION_SECRET is not configured on the server.');

  const expiry = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `user:${twitchId}:${expiry}`;
  const sig = sign(payload, secret);
  const value = Buffer.from(payload).toString('base64url') + '.' + sig;

  const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const secureFlag = isProd ? ' Secure;' : '';
  return `${COOKIE_NAME}=${value}; HttpOnly;${secureFlag} SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}`;
  // SameSite=Lax (not Strict, unlike admin) because this cookie needs to
  // be sent on the top-level redirect back from Twitch's OAuth callback.
}

export function clearUserSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

function parseCookies(cookieHeader) {
  const out = {};
  (cookieHeader || '').split(';').forEach(part => {
    const eq = part.indexOf('=');
    if (eq === -1) return;
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  });
  return out;
}

/** Returns the Twitch user ID if the request carries a valid, unexpired
 * user session cookie — otherwise null. Never throws. */
export function getSessionUserId(req) {
  const secret = process.env.USER_SESSION_SECRET;
  if (!secret) return null;

  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[COOKIE_NAME];
  if (!raw || !raw.includes('.')) return null;

  const [payloadB64, sig] = raw.split('.');
  let payload;
  try {
    payload = Buffer.from(payloadB64, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const expected = sign(payload, secret);
  const sigBuf = Buffer.from(sig || '', 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  const m = payload.match(/^user:(.+):(\d+)$/);
  if (!m) return null;
  const [, userId, expiryStr] = m;
  if (Date.now() >= Number(expiryStr)) return null;
  return userId;
}
