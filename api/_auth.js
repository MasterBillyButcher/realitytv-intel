/* ═══════════════════════════════════════════════════════════
   api/_auth.js — Reality TV Intel 2026
   Shared helper: sign and verify the admin session cookie.
   Used by both api/verify-admin.js (issues the cookie) and
   api/followers.js (gates access on it).

   Design notes:
   - No database, no session store — Vercel functions are stateless.
     A signed cookie (HMAC-SHA256) is the correct pattern here: the
     server can verify a cookie's authenticity without persisting
     anything, because forging a valid signature requires knowing
     ADMIN_SESSION_SECRET, which never leaves the server.
   - This is deliberately NOT a full JWT implementation — no external
     library, no algorithm-confusion surface, just a fixed-format
     "payload.signature" cookie. Swap in a real JWT library later if
     you want standard claims/refresh-token support; the verification
     contract (an httpOnly cookie proving a valid recent login) stays
     the same either way.
   - REQUIRED ENV VARS (Vercel → Settings → Environment Variables):
       ADMIN_PASSWORD        the real admin password (plaintext value,
                              same trust model as APIFY_TOKEN already
                              being stored there)
       ADMIN_SESSION_SECRET  any long random string, used only to sign
                              cookies — not the password itself
═══════════════════════════════════════════════════════════ */

import crypto from 'crypto';

const SESSION_HOURS = 8;
const COOKIE_NAME = 'rtv_admin_session';

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/** Build a Set-Cookie header value for a fresh valid session. */
export function issueSessionCookie() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET is not configured on the server.');

  const expiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const payload = `admin:${expiry}`;
  const sig = sign(payload, secret);
  const value = Buffer.from(payload).toString('base64url') + '.' + sig;

  const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const secureFlag = isProd ? ' Secure;' : ''; // allow local http dev without Secure blocking the cookie
  return `${COOKIE_NAME}=${value}; HttpOnly;${secureFlag} SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}`;
}

/** Build a Set-Cookie header value that immediately clears the session. */
export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

/** Parse the incoming request's cookies into a plain object. */
function parseCookies(cookieHeader) {
  const out = {};
  (cookieHeader || '').split(';').forEach(part => {
    const eq = part.indexOf('=');
    if (eq === -1) return;
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  });
  return out;
}

/** Returns true if the request carries a valid, unexpired admin session cookie. */
export function isValidAdminSession(req) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;

  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[COOKIE_NAME];
  if (!raw || !raw.includes('.')) return false;

  const [payloadB64, sig] = raw.split('.');
  let payload;
  try {
    payload = Buffer.from(payloadB64, 'base64url').toString('utf8');
  } catch {
    return false;
  }

  const expected = sign(payload, secret);
  const sigBuf = Buffer.from(sig || '', 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  const m = payload.match(/^admin:(\d+)$/);
  if (!m) return false;
  const expiry = Number(m[1]);
  return Date.now() < expiry;
}
