/* ═══════════════════════════════════════════════════════════
   api/_ratelimit.js — Reality TV Intel 2026
   A real, distributed rate limiter backed by Redis INCR/EXPIRE —
   shared across every serverless instance, not per-instance memory.
   The old limiter in verify-admin.js was in-memory: at real
   concurrency, many warm instances each keep their own independent
   counter, so an attacker spreading requests across instances (which
   just... happens naturally under load, no special effort required)
   could sail past it. This one can't be routed around that way,
   because every instance reads and writes the same Redis key.

   Falls open (never blocks) if the database is unreachable — an
   outage in the rate limiter must never become a reason legitimate
   admin logins or predictions can't go through. That's a deliberate
   trade-off: availability over strictness when the limiter itself is
   the thing that's broken.
═══════════════════════════════════════════════════════════ */

import * as db from './_db.js';

/** @returns {Promise<{limited: boolean, remaining: number}>} */
export async function checkRateLimit(bucket, identifier, { maxAttempts = 10, windowSeconds = 300 } = {}) {
  const key = `rti:ratelimit:${bucket}:${identifier}`;
  try {
    const count = await db.incr(key);
    if (count === 1) await db.expire(key, windowSeconds); // only the first hit in a window sets the expiry
    return { limited: count > maxAttempts, remaining: Math.max(0, maxAttempts - count) };
  } catch (err) {
    console.warn(`[_ratelimit] Check failed for ${bucket}:${identifier}, failing open:`, err.message);
    return { limited: false, remaining: maxAttempts };
  }
}
