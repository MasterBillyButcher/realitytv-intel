/* ═══════════════════════════════════════════════════════════
   api/leaderboard.js — Reality TV Intel 2026
   GET ?limit=100 (max 100) — public, edge-cached briefly since this
   gets hit by every visitor to the leaderboard view, not just admins.
═══════════════════════════════════════════════════════════ */

import { getLeaderboard, getUserRank } from './_store.js';
import { getSessionUserId } from './_usersession.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only.' });
    return;
  }

  const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 100));
  const leaderboard = await getLeaderboard(limit);

  const userId = getSessionUserId(req);
  const myRank = userId ? await getUserRank(userId) : null;

  res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');
  res.status(200).json({ leaderboard, myRank });
}
