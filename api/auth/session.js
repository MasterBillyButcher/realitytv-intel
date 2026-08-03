/* ═══════════════════════════════════════════════════════════
   api/auth/session.js — Reality TV Intel 2026
   GET    → { loggedIn: true, user: {...} } or { loggedIn: false }
   DELETE → logs out (clears the user session cookie)

   IMPORTANT: "are you logged in" and "here's your profile" are
   deliberately decoupled. getSessionUserId() is pure cookie
   verification — HMAC signature check, no database call, can't fail
   due to Redis being briefly under pressure. If that says the cookie
   is valid, we report loggedIn:true unconditionally — a transient
   database hiccup fetching the full profile degrades to a minimal
   fallback user object, it never flips someone to "logged out" and
   forces them through Twitch's OAuth screen again for no real reason.
   That decoupling is what fixes "I keep getting asked to log in
   again" under real traffic, where occasional DB blips are expected.
═══════════════════════════════════════════════════════════ */

import { getSessionUserId, clearUserSessionCookie } from '../_usersession.js';
import { getUser } from '../_store.js';
import { logAudit } from '../_audit.js';
import { getClientIp } from '../_ip.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const userId = getSessionUserId(req); // cookie-only, cannot fail on a DB issue
    if (!userId) {
      res.status(200).json({ loggedIn: false });
      return;
    }

    let user = null;
    try {
      user = await getUser(userId);
    } catch (err) {
      console.warn('[auth/session] Profile fetch failed, degrading gracefully:', err.message);
    }

    // Valid cookie is enough to say "you're logged in" on its own —
    // profile detail is best-effort on top of that, not a precondition.
    res.status(200).json({
      loggedIn: true,
      user: user || { id: userId, login: '', displayName: '', avatarUrl: '', _degraded: true },
    });
    return;
  }

  if (req.method === 'DELETE') {
    const userId = getSessionUserId(req);
    res.setHeader('Set-Cookie', clearUserSessionCookie());
    if (userId) await logAudit({ actor: userId, actorType: 'user', action: 'logout', ip: getClientIp(req) });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: 'Use GET to check session, DELETE to log out.' });
}
