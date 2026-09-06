/* ═══════════════════════════════════════════════════════════
   api/_audit.js — Reality TV Intel 2026
   Real server-side audit log. The dashboard's existing "Recent
   Activity" panel is client-side only (localStorage) — it only shows
   what happened in the browser you're currently looking at, resets
   whenever storage is cleared, isn't visible from another device,
   and (since it's entirely client-controlled) can't be trusted as a
   record of what actually happened server-side. This is the real
   one: written from inside the API endpoints themselves, where the
   action actually occurs, so it can't be bypassed or spoofed by
   editing client JS.

   Storage: rti:auditlog, a Redis List. LPUSH is newest-first; LTRIM
   caps it at MAX_ENTRIES so it can't grow unbounded on a free-tier
   plan. This is an audit trail, not a permanent archive — if you
   need longer retention later, export it periodically rather than
   raising the cap indefinitely.

   Logging a failed write must never fail the operation it's
   documenting — see the try/catch in logAudit().
═══════════════════════════════════════════════════════════ */

import * as db from './_db.js';

const AUDIT_KEY = 'rti:auditlog';
const MAX_ENTRIES = 2000;

/**
 * @param {object} params
 * @param {string} params.actor       - admin username, Twitch user ID, or 'system'
 * @param {'admin'|'user'|'system'} params.actorType
 * @param {string} params.action      - short machine-readable action name, e.g. 'login', 'publish_live', 'prediction_resolved'
 * @param {string} [params.target]    - the thing acted on (prediction ID, show key, etc.)
 * @param {string} [params.detail]    - human-readable extra context
 * @param {string} [params.ip]
 * @param {boolean} [params.success]  - defaults true; set false for denied/failed attempts
 */
export async function logAudit({ actor, actorType = 'system', action, target = '', detail = '', ip = '', success = true }) {
  const entry = {
    ts: new Date().toISOString(),
    actor: actor || 'unknown',
    actorType,
    action,
    target,
    detail,
    ip,
    success,
  };
  try {
    await db.lPush(AUDIT_KEY, JSON.stringify(entry));
    await db.lTrim(AUDIT_KEY, 0, MAX_ENTRIES - 1);
  } catch (err) {
    console.warn('[_audit] Failed to write audit entry (non-fatal — the action it describes still happened):', err.message);
  }
  return entry;
}

export async function getAuditLog({ limit = 100, offset = 0 } = {}) {
  const raw = await db.lRange(AUDIT_KEY, offset, offset + limit - 1);
  const total = await db.lLen(AUDIT_KEY).catch(() => raw.length);
  const entries = raw.map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
  return { entries, total };
}
