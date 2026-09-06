/* ═══════════════════════════════════════════════════════════
   api/predictions.js — Reality TV Intel 2026

   GET  ?status=open|closed|resolved (default 'open')
        Public. Lists predictions with live vote counts per option,
        plus the CALLING user's own pick if they're logged in and
        already entered (so the frontend can render "you picked X"
        without a second request). Also returns `serverTime` — the
        frontend countdown should compute its own clock offset from
        this rather than trusting the browser's clock at face value,
        so a wrong local clock never even LOOKS misleading, even
        though (see _store.js submitEntry) it was never exploitable
        either way — the real deadline check always runs server-side.

   POST — admin-only. Creates a new prediction.
        Body: { question, options: string[], showKey?, closesAt?, pointsValue? }
═══════════════════════════════════════════════════════════ */

import { isValidAdminSession } from './_auth.js';
import { getSessionUserId } from './_usersession.js';
import { createPrediction, listPredictions, getEntryCounts, getEntry } from './_store.js';
import { logAudit } from './_audit.js';
import { getClientIp } from './_ip.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const status = ['open', 'closed', 'resolved'].includes(req.query?.status) ? req.query.status : 'open';
    const predictions = await listPredictions(status);
    const userId = getSessionUserId(req);

    const hydrated = await Promise.all(predictions.map(async (p) => {
      const [counts, myPick] = await Promise.all([
        getEntryCounts(p.id),
        userId ? getEntry(p.id, userId) : Promise.resolve(null),
      ]);
      return { ...p, counts, myPick };
    }));

    res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=60');
    res.status(200).json({ predictions: hydrated, serverTime: new Date().toISOString() });
    return;
  }

  if (req.method === 'POST') {
    if (!isValidAdminSession(req)) {
      res.status(401).json({ error: 'Admin session required.' });
      return;
    }
    try {
      const { question, options, showKey, closesAt, pointsValue, displayMode } = req.body || {};
      const pred = await createPrediction({ question, options, showKey, closesAt, pointsValue, displayMode, createdBy: 'admin' });
      await logAudit({ actor: 'admin', actorType: 'admin', action: 'prediction_created', target: pred.id, detail: question, ip: getClientIp(req) });
      res.status(200).json({ ok: true, prediction: pred });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
    return;
  }

  res.status(405).json({ error: 'Use GET to list, POST to create (admin only).' });
}
