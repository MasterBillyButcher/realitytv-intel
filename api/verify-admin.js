/* ═══════════════════════════════════════════════════════════
   api/verify-admin.js — Reality TV Intel 2026

   POST { password }  → checks against process.env.ADMIN_PASSWORD.
                         On success, sets a signed httpOnly session
                         cookie and returns { ok: true }.
                         On failure, returns 401 with no cookie.

   GET                → checks whether the request already carries a
                         valid session cookie. Used on page load so
                         admin.js never has to trust client-side state
                         alone to decide whether to show admin UI.

   DELETE             → clears the session cookie (logout).

   REQUIRED ENV VARS — set in Vercel → Project → Settings →
   Environment Variables, never committed to the repo:
     ADMIN_PASSWORD        the real admin password
     ADMIN_SESSION_SECRET  any long random string (cookie signing key)
═══════════════════════════════════════════════════════════ */

import crypto from 'crypto';
import { issueSessionCookie, clearSessionCookie, isValidAdminSession } from './_auth.js';

function timingSafeStringEqual(a, b) {
  const aBuf = crypto.createHash('sha256').update(String(a)).digest();
  const bBuf = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json({ authenticated: isValidAdminSession(req) });
    return;
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearSessionCookie());
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST to log in, GET to check session, DELETE to log out.' });
    return;
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    res.status(500).json({ error: 'ADMIN_PASSWORD is not configured on the server. Add it in Vercel → Settings → Environment Variables, then redeploy.' });
    return;
  }

  const password = req.body?.password;
  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'Password required.' });
    return;
  }

  if (!timingSafeStringEqual(password, adminPassword)) {
    // Deliberately generic — don't reveal whether the failure was a
    // missing field vs a wrong password, and no per-attempt detail
    // that would help someone iterate guesses.
    res.status(401).json({ error: 'Incorrect password.' });
    return;
  }

  try {
    res.setHeader('Set-Cookie', issueSessionCookie());
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
