/* ═══════════════════════════════════════════════════════════
   api/data.js — Reality TV Intel 2026
   The live database, replacing "admin exports data.js and manually
   pushes it to GitHub". One JSON document, one Redis key, read by
   every visitor and written only by an authenticated admin.

   GET  — public. Returns the current dataset. Edge-cached for 20s
          (s-maxage) so a burst of visitors doesn't hammer Upstash —
          effectively real-time (≤20s staleness) at a fraction of the
          read cost. Falls back to the bundled public/data/data.js
          contents if the database is empty (first run, before the
          one-time migration) or unreachable, so the site never shows
          a blank dashboard while you're getting this set up.
   POST — admin-only (same signed-cookie session as everything else
          in api/). Body is the full dataset — same shape the old
          "Export JSON" produced. Writes it as the new canonical copy.

   REQUIRED ENV VARS (Vercel → Storage → connect a KV/Upstash Redis
   database to this project — Vercel injects these automatically,
   nothing to type in by hand):
       KV_REST_API_URL
       KV_REST_API_TOKEN
   See the deployment notes shared alongside this file for the exact
   click-path to create the database and run the one-time migration.
═══════════════════════════════════════════════════════════ */

import { isValidAdminSession } from './_auth.js';

const DATA_KEY = 'reality-tv-intel:data';
const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4MB — generous for this dataset, blocks abuse

async function upstash(command) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN not configured');

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.error) {
    throw new Error(`Upstash error: ${data?.error || res.status}`);
  }
  return data.result;
}

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
  if (req.method === 'GET') {
    let raw = null;
    let source = 'database';
    try {
      raw = await upstash(['GET', DATA_KEY]);
    } catch (err) {
      console.warn('[api/data] Upstash read failed, falling back to bundled file:', err.message);
    }

    if (!raw) {
      source = 'bundled-fallback';
      raw = await fallbackFromBundledFile(req);
    }

    if (!raw) {
      res.status(503).json({ error: 'No data available — database is empty and the bundled fallback could not be read. Run the one-time migration (see admin panel).' });
      return;
    }

    res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=120');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Data-Source', source);
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
      await upstash(['SET', DATA_KEY, JSON.stringify(parsed)]);
    } catch (err) {
      console.error('[api/data] Upstash write failed:', err.message);
      res.status(502).json({ error: 'Could not reach the database. Nothing was saved — try again in a moment.' });
      return;
    }

    res.status(200).json({ ok: true, savedAt: parsed._meta.savedAt });
    return;
  }

  res.status(405).json({ error: 'Use GET to read, POST to publish (admin only).' });
}
