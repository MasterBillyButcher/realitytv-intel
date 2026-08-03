/* ═══════════════════════════════════════════════════════════
   api/predictions-admin.js — Reality TV Intel 2026
   Admin-only prediction lifecycle actions.

   POST { id, action: 'close' }
   POST { id, action: 'resolve', correctOption }
═══════════════════════════════════════════════════════════ */

import { isValidAdminSession } from './_auth.js';
import { closePrediction, resolvePrediction } from './_store.js';
import { logAudit } from './_audit.js';
import { getClientIp } from './_ip.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only.' });
    return;
  }
  if (!isValidAdminSession(req)) {
    res.status(401).json({ error: 'Admin session required.' });
    return;
  }

  const { id, action, correctOption } = req.body || {};
  if (!id || !action) {
    res.status(400).json({ error: 'id and action are required.' });
    return;
  }
  const ip = getClientIp(req);

  try {
    if (action === 'close') {
      const pred = await closePrediction(id);
      await logAudit({ actor: 'admin', actorType: 'admin', action: 'prediction_closed', target: id, ip });
      res.status(200).json({ ok: true, prediction: pred });
      return;
    }

    if (action === 'resolve') {
      if (!correctOption) {
        res.status(400).json({ error: 'correctOption is required to resolve a prediction.' });
        return;
      }
      const result = await resolvePrediction(id, correctOption);
      await logAudit({
        actor: 'admin', actorType: 'admin', action: 'prediction_resolved', target: id, ip,
        detail: `correct: ${correctOption}, winners: ${result.winners.length}/${result.totalEntries}`,
      });
      res.status(200).json(result);
      return;
    }

    res.status(400).json({ error: "action must be 'close' or 'resolve'." });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
