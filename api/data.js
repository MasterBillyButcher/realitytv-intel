/* ═══════════════════════════════════════════════════════════
   api/data.js — Reality TV Intel 2026
   The live show/contestant database, replacing "admin exports
   data.js and manually pushes it to GitHub". One JSON document, one
   Redis key, read by every visitor and written only by an
   authenticated admin. (Low write frequency, single admin — this is
   exactly the case where one blob is still the right shape; the new
   users/predictions/leaderboard data in _store.js uses proper
   per-entity keys instead, since that's a genuinely multi-writer
   workload.)

   GET  — public. Returns the current dataset. Edge-cached for 20s
          (s-maxage) so a burst of visitors doesn't hammer the
          database — effectively real-time (≤20s staleness) at a
          fraction of the read cost. Falls back to the bundled
          public/data/data.js contents if the database is empty
          (first run, before the one-time migration) or unreachable.
   POST — admin-only (same signed-cookie session as everything else
          in api/). Body is the full dataset. Writes it as the new
          canonical copy.

   Connection detection (TCP Redis vs REST store) lives in _db.js —
   see that file for details. Whatever's connected in Vercel →
   Storage gets used automatically.
═══════════════════════════════════════════════════════════ */

import { isValidAdminSession } from './_auth.js';
import * as db from './_db.js';

const DATA_KEY = 'reality-tv-intel:data';
const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4MB — generous for this dataset, blocks abuse

/** Bundled data.js as an ultimate fallback — used only if the database
 * is empty (not migrated yet) or briefly unreachable. Read from the
 * deployed static file over HTTP rather than the function's local
 * filesystem, since Vercel doesn't guarantee /public is present in
 * every function's bundle. */
async function fallbackFromBundledFile(req) {
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const res = await fetch(`${proto}://${host}/data/data.js`);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const connKind = db.connection.kind;

  if (req.method === 'GET') {
    let raw = null;
    let source = 'database';
    let dbError = null;
    try {
      raw = await db.get(DATA_KEY);
    } catch (err) {
      dbError = err.message;
      console.warn('[api/data] Database read failed, falling back to bundled file:', err.message);
    }

    if (!raw) {
      source = 'bundled-fallback';
      raw = await fallbackFromBundledFile(req);
    }

    if (!raw) {
      res.status(503).json({
        error: 'No data available — database is empty and the bundled fallback could not be read.',
        databaseIssue: dbError,
        connectionDetected: connKind,
      });
      return;
    }

    res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=120');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Data-Source', source);
    res.setHeader('X-Db-Connection', connKind);
    if (dbError) res.setHeader('X-Db-Error', dbError.slice(0, 200));
    res.status(200).send(raw);
    return;
  }

  if (req.method === 'POST') {
    if (!isValidAdminSession(req)) {
      res.status(401).json({ error: 'Admin session required.' });
      return;
    }

    let body = '';
    try {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    } catch {
      res.status(400).json({ error: 'Invalid request body.' });
      return;
    }
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
      res.status(413).json({ error: 'Payload too large.' });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.status(400).json({ error: 'Body must be valid JSON.' });
      return;
    }
    if (!parsed || typeof parsed !== 'object' || typeof parsed.SHOWS !== 'object' || typeof parsed.DB !== 'object') {
      res.status(400).json({ error: 'Payload must include SHOWS and DB objects — same shape as the old data.js export.' });
      return;
    }

    parsed._meta = { ...(parsed._meta || {}), savedAt: new Date().toISOString(), generator: 'Reality TV Intel 2026 (live DB)' };

    try {
      await db.set(DATA_KEY, JSON.stringify(parsed));
    } catch (err) {
      console.error('[api/data] Database write failed:', err.message);
      res.status(502).json({
        error: 'Could not reach the database. Nothing was saved — try again in a moment.',
        databaseIssue: err.message,
        connectionDetected: connKind,
      });
      return;
    }

    res.status(200).json({ ok: true, savedAt: parsed._meta.savedAt, connectionUsed: connKind });
    return;
  }

  res.status(405).json({ error: 'Use GET to read, POST to publish (admin only).' });
}
