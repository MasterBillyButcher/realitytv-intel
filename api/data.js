/* ═══════════════════════════════════════════════════════════
   api/data.js — Reality TV Intel 2026
   The live database, replacing "admin exports data.js and manually
   pushes it to GitHub". One JSON document, one Redis key, read by
   every visitor and written only by an authenticated admin.

   GET  — public. Returns the current dataset. Edge-cached for 20s
          (s-maxage) so a burst of visitors doesn't hammer the
          database — effectively real-time (≤20s staleness) at a
          fraction of the read cost. Falls back to the bundled
          public/data/data.js contents if the database is empty
          (first run, before the one-time migration) or unreachable.
   POST — admin-only (same signed-cookie session as everything else
          in api/). Body is the full dataset. Writes it as the new
          canonical copy.

   CONNECTION — auto-detects which kind of store is attached, since
   Vercel's Storage marketplace has two different shapes in the wild:
     · REDIS_URL / KV_URL           → standard Redis (TCP), used via
                                       the `redis` npm client. This is
                                       what Vercel's native "Redis"
                                       marketplace product gives you.
     · KV_REST_API_URL + KV_REST_API_TOKEN → REST-based store (the
                                       older Upstash-backed "Vercel KV"
                                       product), used via plain fetch.
   Whichever is present gets used automatically — nothing to configure
   beyond connecting a database in Vercel → Storage and redeploying.
═══════════════════════════════════════════════════════════ */

import { isValidAdminSession } from './_auth.js';

const DATA_KEY = 'reality-tv-intel:data';
const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4MB — generous for this dataset, blocks abuse

/* ─── CONNECTION DETECTION ──────────────────────────────────
   Lists exactly which env vars were checked and which (if any) were
   found, by NAME only — never values — so a misconfiguration is
   immediately visible in logs/diagnostics without leaking secrets. */
function detectConnection() {
  const env = process.env;

  // Standard Redis connection string — Vercel's native Redis product,
  // or anything else that hands you a redis:// URL.
  const urlCandidates = ['REDIS_URL', 'KV_URL'];
  for (const name of urlCandidates) {
    if (env[name]) return { kind: 'redis-url', envVar: name, value: env[name] };
  }
  // Some Marketplace integrations prefix the var with the resource
  // name (e.g. REDIS_CYCLAMEN_CURTAIN_URL) — scan for that shape too.
  const scanned = Object.keys(env).find(k => /REDIS.*_URL$/i.test(k) && env[k]?.startsWith('redis'));
  if (scanned) return { kind: 'redis-url', envVar: scanned, value: env[scanned] };

  // REST-based store (Upstash / legacy Vercel KV).
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    return { kind: 'rest', envVar: 'KV_REST_API_URL + KV_REST_API_TOKEN', url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN };
  }

  return { kind: 'none', checked: [...urlCandidates, 'KV_REST_API_URL + KV_REST_API_TOKEN'] };
}

/* ─── REST CLIENT (Upstash-style) ──────────────────────────── */
async function restCommand(conn, command) {
  const res = await fetch(conn.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${conn.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.error) throw new Error(`REST store error: ${data?.error || res.status}`);
  return data.result;
}

/* ─── TCP CLIENT (standard Redis) ───────────────────────────
   Reused across warm serverless invocations rather than reconnecting
   every request — free-tier Redis instances have tight connection
   limits, and reconnect-per-request is needlessly slow. */
let _redisClientPromise = null;
async function getRedisClient(url) {
  if (_redisClientPromise) return _redisClientPromise;
  _redisClientPromise = (async () => {
    const { createClient } = await import('redis');
    const client = createClient({ url });
    client.on('error', (err) => console.warn('[api/data] Redis client error:', err.message));
    await client.connect();
    return client;
  })().catch(err => { _redisClientPromise = null; throw err; }); // let a failed connect be retried next call
  return _redisClientPromise;
}

/* ─── UNIFIED GET/SET ────────────────────────────────────── */
async function dbGet(conn) {
  if (conn.kind === 'redis-url') {
    const client = await getRedisClient(conn.value);
    return await client.get(DATA_KEY);
  }
  if (conn.kind === 'rest') {
    return await restCommand(conn, ['GET', DATA_KEY]);
  }
  throw new Error(`No database connected — checked env vars: ${conn.checked.join(', ')}`);
}
async function dbSet(conn, value) {
  if (conn.kind === 'redis-url') {
    const client = await getRedisClient(conn.value);
    return await client.set(DATA_KEY, value);
  }
  if (conn.kind === 'rest') {
    return await restCommand(conn, ['SET', DATA_KEY, value]);
  }
  throw new Error(`No database connected — checked env vars: ${conn.checked.join(', ')}`);
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
  const conn = detectConnection();

  if (req.method === 'GET') {
    let raw = null;
    let source = 'database';
    let dbError = null;
    try {
      raw = await dbGet(conn);
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
        connectionDetected: conn.kind,
      });
      return;
    }

    res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=120');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Data-Source', source);
    res.setHeader('X-Db-Connection', conn.kind === 'none' ? 'none' : conn.kind);
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
      await dbSet(conn, JSON.stringify(parsed));
    } catch (err) {
      console.error('[api/data] Database write failed:', err.message);
      res.status(502).json({
        error: 'Could not reach the database. Nothing was saved — try again in a moment.',
        databaseIssue: err.message,
        connectionDetected: conn.kind,
      });
      return;
    }

    res.status(200).json({ ok: true, savedAt: parsed._meta.savedAt, connectionUsed: conn.kind });
    return;
  }

  res.status(405).json({ error: 'Use GET to read, POST to publish (admin only).' });
}
