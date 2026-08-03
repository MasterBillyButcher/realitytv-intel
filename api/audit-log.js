/* ═══════════════════════════════════════════════════════════
   api/audit-log.js — Reality TV Intel 2026
   Admin-only. Paginated view into the real server-side audit log.
   GET ?limit=100&offset=0
═══════════════════════════════════════════════════════════ */

import { isValidAdminSession } from './_auth.js';
import { getAuditLog } from './_audit.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only.' });
    return;
  }
  if (!isValidAdminSession(req)) {
    res.status(401).json({ error: 'Admin session required.' });
    return;
  }

  const limit = Math.min(200, Math.max(1, Number(req.query?.limit) || 100));
  const offset = Math.max(0, Number(req.query?.offset) || 0);
  const { entries, total } = await getAuditLog({ limit, offset });
  res.status(200).json({ entries, total, limit, offset });
}
