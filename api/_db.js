/* ═══════════════════════════════════════════════════════════
   api/_db.js — shared Redis connection, used by every endpoint
   that touches the database. Factored out of api/data.js so the
   connection-detection logic (which env vars, TCP vs REST) lives
   in exactly one place instead of being copy-pasted per endpoint.

   CONNECTION — auto-detects which kind of store is attached:
     · REDIS_URL / KV_URL (or a resource-prefixed variant)
       → standard Redis (TCP), via the `redis` npm client.
     · KV_REST_API_URL + KV_REST_API_TOKEN
       → REST-based store (Upstash / legacy Vercel KV), via fetch.
   Whichever is present gets used automatically.
═══════════════════════════════════════════════════════════ */

function detectConnection() {
  const env = process.env;

  const urlCandidates = ['REDIS_URL', 'KV_URL'];
  for (const name of urlCandidates) {
    if (env[name]) return { kind: 'redis-url', envVar: name, value: env[name] };
  }
  const scanned = Object.keys(env).find(k => /REDIS.*_URL$/i.test(k) && env[k]?.startsWith('redis'));
  if (scanned) return { kind: 'redis-url', envVar: scanned, value: env[scanned] };

  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    return { kind: 'rest', envVar: 'KV_REST_API_URL + KV_REST_API_TOKEN', url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN };
  }

  return { kind: 'none', checked: [...urlCandidates, 'KV_REST_API_URL + KV_REST_API_TOKEN'] };
}

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

/* Reused across warm serverless invocations — free-tier Redis has
   tight connection limits, reconnecting per-request is slow and
   wasteful. Guards against a failed connect poisoning future calls. */
let _redisClientPromise = null;
async function getRedisClient(url) {
  if (_redisClientPromise) return _redisClientPromise;
  _redisClientPromise = (async () => {
    const { createClient } = await import('redis');
    const client = createClient({
      url,
      socket: {
        connectTimeout: 5000, // fail fast instead of hanging a request indefinitely
        reconnectStrategy: retries => Math.min(retries * 200, 3000), // backoff, capped at 3s
      },
    });
    client.on('error', (err) => console.warn('[_db] Redis client error:', err.message));
    await client.connect();
    return client;
  })().catch(err => { _redisClientPromise = null; throw err; });
  return _redisClientPromise;
}

const conn = detectConnection();

/* ─── LOW-LEVEL COMMAND INTERFACE ───────────────────────────
   Every entity module builds on these primitives rather than
   talking to Redis directly, so the TCP-vs-REST distinction
   never leaks past this file. */
async function get(key) {
  if (conn.kind === 'redis-url') return (await getRedisClient(conn.value)).get(key);
  if (conn.kind === 'rest') return restCommand(conn, ['GET', key]);
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}
async function set(key, value) {
  if (conn.kind === 'redis-url') return (await getRedisClient(conn.value)).set(key, value);
  if (conn.kind === 'rest') return restCommand(conn, ['SET', key, value]);
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}
async function del(key) {
  if (conn.kind === 'redis-url') return (await getRedisClient(conn.value)).del(key);
  if (conn.kind === 'rest') return restCommand(conn, ['DEL', key]);
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}

// List commands — the audit log (newest-first, capped length)
async function lPush(key, value) {
  if (conn.kind === 'redis-url') return (await getRedisClient(conn.value)).lPush(key, value);
  if (conn.kind === 'rest') return restCommand(conn, ['LPUSH', key, value]);
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}
async function lTrim(key, start, stop) {
  if (conn.kind === 'redis-url') return (await getRedisClient(conn.value)).lTrim(key, start, stop);
  if (conn.kind === 'rest') return restCommand(conn, ['LTRIM', key, start, stop]);
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}
async function lRange(key, start, stop) {
  if (conn.kind === 'redis-url') return (await getRedisClient(conn.value)).lRange(key, start, stop);
  if (conn.kind === 'rest') return (await restCommand(conn, ['LRANGE', key, start, stop])) || [];
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}
async function lLen(key) {
  if (conn.kind === 'redis-url') return (await getRedisClient(conn.value)).lLen(key);
  if (conn.kind === 'rest') return restCommand(conn, ['LLEN', key]);
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}

// Counter commands — the distributed rate limiter
async function incr(key) {
  if (conn.kind === 'redis-url') return (await getRedisClient(conn.value)).incr(key);
  if (conn.kind === 'rest') return restCommand(conn, ['INCR', key]);
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}
async function expire(key, seconds) {
  if (conn.kind === 'redis-url') return (await getRedisClient(conn.value)).expire(key, seconds);
  if (conn.kind === 'rest') return restCommand(conn, ['EXPIRE', key, seconds]);
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}
async function ttl(key) {
  if (conn.kind === 'redis-url') return (await getRedisClient(conn.value)).ttl(key);
  if (conn.kind === 'rest') return restCommand(conn, ['TTL', key]);
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}

export {
  detectConnection, conn as connection,
  get, set, del,
  lPush, lTrim, lRange, lLen,
  incr, expire, ttl,
};
