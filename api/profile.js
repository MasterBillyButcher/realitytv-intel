/* ═══════════════════════════════════════════════════════════
   api/profile.js — Reality TV Intel 2026
   GET — requires login. Everything a profile page needs in one
   request: Twitch identity, aggregate stats, full prediction
   history, and leaderboard rank.

   Each of the three DB reads is independently fault-tolerant — a
   transient failure fetching, say, history doesn't blank out the
   whole page; it degrades that one section to an empty/default state
   while the rest still renders normally.
═══════════════════════════════════════════════════════════ */

import { getSessionUserId } from './_usersession.js';
import { getUser, getUserStats, getUserPredictionHistory } from './_store.js';

async function safely(fn, fallback) {
  try { return await fn(); } catch (err) { console.warn('[profile] partial failure (non-fatal):', err.message); return fallback; }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only.' });
    return;
  }

  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Log in with Twitch to view your profile.' });
    return;
  }

  const [user, stats, history] = await Promise.all([
    safely(() => getUser(userId), null),
    safely(() => getUserStats(userId), { totalEntries: 0, pendingCount: 0, resolvedCount: 0, correctCount: 0, winRate: 0, totalPoints: 0, rank: null }),
    safely(() => getUserPredictionHistory(userId), []),
  ]);

  if (!user) {
    // Cookie is valid (we got past getSessionUserId) but the DB is
    // currently unreachable — tell the frontend to retry shortly
    // rather than treating this as "you're not logged in".
    res.status(503).json({ error: 'Profile data is temporarily unavailable — try again in a moment.', retryable: true });
    return;
  }

  res.status(200).json({ user, stats, history, serverTime: new Date().toISOString() });
}
