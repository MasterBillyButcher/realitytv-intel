/* ═══════════════════════════════════════════════════════════
   api/_ip.js — shared client-IP extraction, used by rate limiting
   and audit logging. Was previously duplicated inline in
   verify-admin.js; factored out so both call sites (and any future
   one) stay consistent.
═══════════════════════════════════════════════════════════ */

export function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? fwd.split(',')[0].trim() : req.socket?.remoteAddress) || 'unknown';
}
