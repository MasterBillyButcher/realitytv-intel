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
   Every entity module (_store.js etc.) builds on these four
   primitives rather than talking to Redis directly, so the
   TCP-vs-REST distinction never leaks past this file. */
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

// Hash commands — user profiles, prediction records, per-prediction entries
async function hSet(key, field, value) {
  if (conn.kind === 'redis-url') return (await getRedisClient(conn.value)).hSet(key, field, value);
  if (conn.kind === 'rest') return restCommand(conn, ['HSET', key, field, value]);
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}
/** Sets many fields on one hash in a single round-trip instead of one
 * call per field — matters for records like a prediction (9 fields)
 * that were previously written with 9 sequential awaits. */
async function hSetAll(key, fields) {
  const entries = Object.entries(fields);
  if (!entries.length) return 0;
  if (conn.kind === 'redis-url') return (await getRedisClient(conn.value)).hSet(key, fields);
  if (conn.kind === 'rest') return restCommand(conn, ['HSET', key, ...entries.flat()]);
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}
/** Atomic "set only if this field doesn't already exist" — this is
 * what makes "one prediction entry per user" race-free even if two
 * requests from the same user land in the same millisecond. Returns
 * true if it was newly set, false if the field already existed. */
async function hSetNX(key, field, value) {
  if (conn.kind === 'redis-url') return !!(await (await getRedisClient(conn.value)).hSetNX(key, field, value));
  if (conn.kind === 'rest') return (await restCommand(conn, ['HSETNX', key, field, value])) === 1;
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}
async function hGet(key, field) {
  if (conn.kind === 'redis-url') return (await getRedisClient(conn.value)).hGet(key, field);
  if (conn.kind === 'rest') return restCommand(conn, ['HGET', key, field]);
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}
async function hGetAll(key) {
  if (conn.kind === 'redis-url') return (await getRedisClient(conn.value)).hGetAll(key);
  if (conn.kind === 'rest') {
    const flat = await restCommand(conn, ['HGETALL', key]); // Upstash returns a flat [field, value, field, value, ...] array
    const obj = {};
    if (Array.isArray(flat)) for (let i = 0; i < flat.length; i += 2) obj[flat[i]] = flat[i + 1];
    return obj;
  }
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}
async function hIncrBy(key, field, amount) {
  if (conn.kind === 'redis-url') return (await getRedisClient(conn.value)).hIncrBy(key, field, amount);
  if (conn.kind === 'rest') return restCommand(conn, ['HINCRBY', key, field, amount]);
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}

// Set commands — predictions:open / predictions:closed indexes
async function sAdd(key, member) {
  if (conn.kind === 'redis-url') return (await getRedisClient(conn.value)).sAdd(key, member);
  if (conn.kind === 'rest') return restCommand(conn, ['SADD', key, member]);
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}
async function sRem(key, member) {
  if (conn.kind === 'redis-url') return (await getRedisClient(conn.value)).sRem(key, member);
  if (conn.kind === 'rest') return restCommand(conn, ['SREM', key, member]);
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}
async function sMembers(key) {
  if (conn.kind === 'redis-url') return (await getRedisClient(conn.value)).sMembers(key);
  if (conn.kind === 'rest') return (await restCommand(conn, ['SMEMBERS', key])) || [];
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}

// Sorted-set commands — the leaderboard
async function zIncrBy(key, member, amount) {
  if (conn.kind === 'redis-url') return (await getRedisClient(conn.value)).zIncrBy(key, amount, member);
  if (conn.kind === 'rest') return restCommand(conn, ['ZINCRBY', key, amount, member]);
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}
/** Top N, highest score first, as [{ member, score }, ...] */
async function zRevRangeWithScores(key, start, stop) {
  if (conn.kind === 'redis-url') {
    const raw = await (await getRedisClient(conn.value)).zRangeWithScores(key, start, stop, { REV: true });
    return raw.map(r => ({ member: r.value, score: r.score }));
  }
  if (conn.kind === 'rest') {
    const flat = await restCommand(conn, ['ZREVRANGE', key, start, stop, 'WITHSCORES']);
    const out = [];
    if (Array.isArray(flat)) for (let i = 0; i < flat.length; i += 2) out.push({ member: flat[i], score: Number(flat[i + 1]) });
    return out;
  }
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}
async function zRevRank(key, member) {
  if (conn.kind === 'redis-url') return (await getRedisClient(conn.value)).zRevRank(key, member);
  if (conn.kind === 'rest') return restCommand(conn, ['ZREVRANK', key, member]);
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}
async function zScore(key, member) {
  if (conn.kind === 'redis-url') return (await getRedisClient(conn.value)).zScore(key, member);
  if (conn.kind === 'rest') return restCommand(conn, ['ZSCORE', key, member]);
  throw new Error(`No database connected — checked: ${conn.checked.join(', ')}`);
}
async function zRem(key, member) {
  if (conn.kind === 'redis-url') return (await getRedisClient(conn.value)).zRem(key, member);
  if (conn.kind === 'rest') return restCommand(conn, ['ZREM', key, member]);
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
  hSet, hSetAll, hSetNX, hGet, hGetAll, hIncrBy,
  sAdd, sRem, sMembers,
  zIncrBy, zRevRangeWithScores, zRevRank, zScore, zRem,
  lPush, lTrim, lRange, lLen,
  incr, expire, ttl,
};
