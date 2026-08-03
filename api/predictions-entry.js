/* ═══════════════════════════════════════════════════════════
   api/predictions-entry.js — Reality TV Intel 2026
   POST { predictionId, choice } — requires a logged-in (Twitch) user.

   The actual "one entry per user, and only while genuinely still
   open" guarantee lives in _store.js's submitEntry() — HSETNX for
   atomicity, and the deadline check runs on the SERVER's clock, never
   the client's, so a manipulated local clock changes nothing here.
   Rate limiting below is a separate, narrower concern: stopping a
   script from hammering this endpoint uselessly, not a correctness
   guarantee (correctness doesn't need it — it's already atomic).
═══════════════════════════════════════════════════════════ */

import { getSessionUserId } from './_usersession.js';
import { submitEntry } from './_store.js';
import { checkRateLimit } from './_ratelimit.js';
import { logAudit } from './_audit.js';
import { getClientIp } from './_ip.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only.' });
    return;
  }

  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Log in with Twitch to make a prediction.' });
    return;
  }

  const { limited } = await checkRateLimit('prediction-entry', userId, { maxAttempts: 30, windowSeconds: 60 });
  if (limited) {
    res.status(429).json({ error: 'Too many requests — slow down a moment and try again.' });
    return;
  }

  const { predictionId, choice } = req.body || {};
  if (!predictionId || !choice) {
    res.status(400).json({ error: 'predictionId and choice are required.' });
    return;
  }

  const result = await submitEntry(predictionId, userId, choice);
  const ip = getClientIp(req);
  await logAudit({
    actor: userId, actorType: 'user', action: 'prediction_entry', target: predictionId,
    detail: choice, ip, success: result.ok,
  });

  res.status(result.ok ? 200 : 400).json(result);
}
