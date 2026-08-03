/* ═══════════════════════════════════════════════════════════
   api/_store.js — Reality TV Intel 2026
   Data-access layer for the new user / predictions / leaderboard
   system. Built on the primitives in _db.js. This is the schema:

     rti:user:{twitchId}                  Hash    profile fields
     rti:predictions:open                 Set     prediction IDs open for voting
     rti:predictions:closed               Set     voting locked, awaiting resolution
     rti:predictions:resolved             Set     scored, final
     rti:prediction:{id}                  Hash    question/options/status/etc
     rti:prediction:{id}:entries          Hash    userId -> chosen option
     rti:prediction:{id}:counts           Hash    option -> live vote count
     rti:leaderboard:alltime              ZSet    userId -> total points

   Every write that matters under concurrency (submitting an entry) is
   built on HSETNX, which Redis guarantees is atomic — two requests
   from the same user landing in the same millisecond still can't
   both succeed, so "one entry per user per prediction" holds even
   under real load, not just in the happy path.

   KNOWN LIMITATION, not yet fixed: multi-step state transitions
   (closePrediction, resolvePrediction) are not wrapped in a single
   Redis transaction (MULTI/EXEC) — if the function crashes between
   steps, you can be left with a partially-updated record. Mitigated
   by ordering writes so a crash leaves detectable overlap (present
   in two sets) rather than silent disappearance (present in none) —
   see the comments at each call site. A real fix needs MULTI/EXEC
   support in both the TCP and REST code paths in _db.js; flagged as
   a follow-up rather than solved here.
═══════════════════════════════════════════════════════════ */

import * as db from './_db.js';

const KEY = (...parts) => ['rti', ...parts].join(':');

/* ─── USERS ──────────────────────────────────────────────── */

/** Creates or refreshes a user profile from a Twitch OAuth response.
 * Display name / avatar are re-synced on every login (people change
 * these); joinedAt is set once via HSETNX and never overwritten. */
export async function upsertUser({ id, login, displayName, avatarUrl }) {
  const key = KEY('user', id);
  await db.hSetAll(key, {
    id, login,
    displayName: displayName || login,
    avatarUrl: avatarUrl || '',
  });
  await db.hSetNX(key, 'joinedAt', new Date().toISOString());
  await db.hSetNX(key, 'role', 'user');
  return getUser(id);
}

export async function getUser(twitchId) {
  const data = await db.hGetAll(KEY('user', twitchId));
  if (!data || !data.id) return null;
  return data;
}

/* ─── PREDICTIONS ────────────────────────────────────────── */

function newPredictionId() {
  return 'pred_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

const MAX_QUESTION_LEN = 500;
const MAX_OPTION_LEN = 200;
const MAX_OPTIONS = 20;
const VALID_DISPLAY_MODES = ['name', 'photo'];

function validateOptions(options) {
  if (!Array.isArray(options) || options.length < 2 || options.length > MAX_OPTIONS) {
    throw new Error(`A prediction needs between 2 and ${MAX_OPTIONS} options.`);
  }
  const seen = new Set();
  for (const o of options) {
    if (!o || typeof o !== 'object' || typeof o.value !== 'string' || !o.value || o.value.length > MAX_OPTION_LEN) {
      throw new Error('Every option needs a non-empty "value" string (e.g. the contestant\'s name) under ' + MAX_OPTION_LEN + ' characters.');
    }
    if (o.label !== undefined && (typeof o.label !== 'string' || o.label.length > MAX_OPTION_LEN)) {
      throw new Error('An option\'s "label" must be a string under ' + MAX_OPTION_LEN + ' characters.');
    }
    if (o.photo !== undefined && typeof o.photo !== 'string') {
      throw new Error('An option\'s "photo" must be a URL string.');
    }
    if (seen.has(o.value)) throw new Error(`Duplicate option value: "${o.value}"`);
    seen.add(o.value);
  }
  // Normalize: label defaults to value, photo defaults to empty.
  return options.map(o => ({ value: o.value, label: o.label || o.value, photo: o.photo || '' }));
}

/** Admin creates a prediction. options: array of { value, label?, photo? }
 * — value is the canonical identifier used for entries/scoring (e.g. a
 * contestant's name), label is what's displayed if it differs, photo
 * is a contestant photo URL for displayMode:'photo'. pointsValue: how
 * many leaderboard points a correct pick is worth on resolution.
 * displayMode: 'name' shows a text list, 'photo' shows a photo grid —
 * set once per prediction (not mixed per-option), matching how the
 * admin picker actually works (pick contestants from one show, choose
 * how the whole set displays). */
export async function createPrediction({ question, options, showKey, createdBy, closesAt, pointsValue = 10, displayMode = 'name' }) {
  if (!question || typeof question !== 'string' || question.length > MAX_QUESTION_LEN) {
    throw new Error(`Question is required and must be under ${MAX_QUESTION_LEN} characters.`);
  }
  if (!VALID_DISPLAY_MODES.includes(displayMode)) displayMode = 'name';
  const normalizedOptions = validateOptions(options);
  if (displayMode === 'photo' && normalizedOptions.some(o => !o.photo)) {
    throw new Error('Photo display mode requires every option to have a photo.');
  }

  const id = newPredictionId();
  const key = KEY('prediction', id);
  // One round-trip for all fields, not one HSET call per field — the
  // previous version awaited db.hSet in a loop, which was 9 sequential
  // Redis calls just to create a single prediction record.
  await db.hSetAll(key, {
    id, question,
    options: JSON.stringify(normalizedOptions),
    displayMode,
    showKey: showKey || '',
    createdBy: createdBy || '',
    createdAt: new Date().toISOString(),
    closesAt: closesAt || '',
    pointsValue: String(pointsValue),
    status: 'open',
    correctOption: '',
    resolvedAt: '',
  });
  await db.sAdd(KEY('predictions', 'open'), id);
  return getPrediction(id);
}

export async function getPrediction(id) {
  const data = await db.hGetAll(KEY('prediction', id));
  if (!data || !data.id) return null;
  return {
    ...data,
    options: JSON.parse(data.options || '[]'),
    displayMode: VALID_DISPLAY_MODES.includes(data.displayMode) ? data.displayMode : 'name',
    // `data.pointsValue || 10` was a real bug: Number("0") is falsy, so
    // a prediction deliberately configured with 0 points would have
    // silently become 10 points. Check for "was this field present"
    // instead of "is this field truthy".
    pointsValue: data.pointsValue !== undefined && data.pointsValue !== '' ? Number(data.pointsValue) : 10,
  };
}

export async function listPredictions(status) {
  const ids = await db.sMembers(KEY('predictions', status));
  const records = await Promise.all(ids.map(getPrediction));
  return records
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/** Locks voting without scoring yet — e.g. once an episode starts airing. */
export async function closePrediction(id) {
  const pred = await getPrediction(id);
  if (!pred) throw new Error('Prediction not found.');
  if (pred.status !== 'open') throw new Error(`Prediction is already ${pred.status}.`);
  await db.hSet(KEY('prediction', id), 'status', 'closed');
  // Add to the new set BEFORE removing from the old one — if this
  // function crashes between the two set updates, the prediction
  // shows up in *both* predictions:open and predictions:closed
  // (detectable, recoverable) rather than in neither (silently
  // vanishes from every listing). Same reasoning in resolvePrediction.
  await db.sAdd(KEY('predictions', 'closed'), id);
  await db.sRem(KEY('predictions', 'open'), id);
  return getPrediction(id);
}

/** Marks the correct answer and scores every entry. Returns the list
 * of userIds who picked correctly, so a caller could notify them.
 *
 * SCALE NOTE: scoring is parallelized (Promise.all) rather than one
 * sequential await per winner, which is a meaningful speedup — but
 * for a prediction with a very large number of entries this can still
 * be a lot of concurrent Redis calls in one request, risking Vercel's
 * function execution time limit. Fine for realistic prediction sizes;
 * revisit with batched/queued scoring if a single prediction routinely
 * gets into the thousands of entries. */
export async function resolvePrediction(id, correctOption) {
  const pred = await getPrediction(id);
  if (!pred) throw new Error('Prediction not found.');
  if (pred.status === 'resolved') throw new Error('Prediction already resolved.');
  if (!pred.options.some(o => o.value === correctOption)) throw new Error('correctOption must be one of the prediction\'s option values.');

  const entries = await db.hGetAll(KEY('prediction', id, 'entries'));
  const winnerIds = Object.entries(entries)
    .filter(([, choice]) => choice === correctOption)
    .map(([userId]) => userId);

  await Promise.all(winnerIds.map(userId => db.zIncrBy(KEY('leaderboard', 'alltime'), userId, pred.pointsValue)));

  await db.hSetAll(KEY('prediction', id), {
    status: 'resolved',
    correctOption,
    resolvedAt: new Date().toISOString(),
  });
  await db.sAdd(KEY('predictions', 'resolved'), id); // add-then-remove, same crash-safety reasoning as closePrediction
  await db.sRem(KEY('predictions', 'open'), id);
  await db.sRem(KEY('predictions', 'closed'), id);

  return { prediction: await getPrediction(id), winners: winnerIds, totalEntries: Object.keys(entries).length };
}

/* ─── ENTRIES ────────────────────────────────────────────── */

/** Atomic — HSETNX guarantees at most one entry per user per
 * prediction even under concurrent requests. Returns
 * { ok: true } on success or { ok: false, reason } otherwise.
 *
 * KNOWN LIMITATION: there's a small time-of-check-to-time-of-use gap
 * between reading the prediction's status above and the HSETNX below
 * — if an admin closes voting in that exact window, an entry can
 * still land. The HSETNX itself is fully race-safe (duplicate entries
 * are still impossible); what's not fully guaranteed is "an entry can
 * never arrive within a few hundred ms of close." Acceptable for this
 * use case, but worth knowing rather than assuming it's airtight. */
export async function submitEntry(predictionId, userId, choice) {
  const pred = await getPrediction(predictionId);
  if (!pred) return { ok: false, reason: 'Prediction not found.' };
  if (pred.status !== 'open') return { ok: false, reason: 'Voting is closed for this prediction.' };
  if (!pred.options.some(o => o.value === choice)) return { ok: false, reason: 'Not a valid option for this prediction.' };
  if (pred.closesAt && new Date(pred.closesAt) < new Date()) return { ok: false, reason: 'Voting has closed.' };

  const wasNew = await db.hSetNX(KEY('prediction', predictionId, 'entries'), userId, choice);
  if (!wasNew) return { ok: false, reason: 'You already entered this prediction.' };

  await db.hIncrBy(KEY('prediction', predictionId, 'counts'), choice, 1);
  await db.sAdd(KEY('user', userId, 'entries'), predictionId); // secondary index for getUserPredictionHistory()
  return { ok: true };
}

export async function getEntry(predictionId, userId) {
  return db.hGet(KEY('prediction', predictionId, 'entries'), userId) || null;
}

export async function getEntryCounts(predictionId) {
  return db.hGetAll(KEY('prediction', predictionId, 'counts'));
}

/* ─── USER HISTORY & STATS ───────────────────────────────── */

/** Every prediction a user has entered, newest first, with their pick,
 * whether it was correct (null if not yet resolved), and points
 * earned. Built on the secondary index submitEntry() maintains, so
 * this is O(entries for this user) rather than scanning every
 * prediction that's ever existed. */
export async function getUserPredictionHistory(userId) {
  const predictionIds = await db.sMembers(KEY('user', userId, 'entries'));
  const rows = await Promise.all(predictionIds.map(async (id) => {
    const [pred, pick] = await Promise.all([getPrediction(id), getEntry(id, userId)]);
    if (!pred || !pick) return null;
    const isResolved = pred.status === 'resolved';
    const wasCorrect = isResolved ? pick === pred.correctOption : null;
    return {
      predictionId: id,
      question: pred.question,
      showKey: pred.showKey,
      options: pred.options,
      pick,
      status: pred.status,
      correctOption: pred.correctOption || null,
      wasCorrect,
      pointsEarned: wasCorrect ? pred.pointsValue : 0,
      createdAt: pred.createdAt,
      closesAt: pred.closesAt,
      resolvedAt: pred.resolvedAt || null,
    };
  }));
  return rows.filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/** Aggregate stats for a profile page — events participated, win rate,
 * total points, current rank. */
export async function getUserStats(userId) {
  const history = await getUserPredictionHistory(userId);
  const resolved = history.filter(h => h.status === 'resolved');
  const correct = resolved.filter(h => h.wasCorrect);
  const rank = await getUserRank(userId);
  return {
    totalEntries: history.length,
    pendingCount: history.length - resolved.length,
    resolvedCount: resolved.length,
    correctCount: correct.length,
    winRate: resolved.length ? Math.round((correct.length / resolved.length) * 100) : 0,
    totalPoints: rank.score,
    rank: rank.rank,
  };
}

/* ─── LEADERBOARD ────────────────────────────────────────── */

/** NOTE: N+1-shaped — one getUser() lookup per leaderboard row, run
 * concurrently via Promise.all rather than sequentially, which helps
 * but still means `limit` concurrent Redis calls on every read of a
 * public leaderboard. Fine at limit<=100 on a low-latency store; if
 * this becomes a hot path, denormalize displayName/avatarUrl onto the
 * leaderboard entry itself (updated on upsertUser) instead of joining
 * at read time. */
export async function getLeaderboard(limit = 100) {
  const rows = await db.zRevRangeWithScores(KEY('leaderboard', 'alltime'), 0, limit - 1);
  const hydrated = await Promise.all(rows.map(async (r, i) => {
    const user = await getUser(r.member);
    return {
      rank: i + 1,
      userId: r.member,
      score: r.score,
      login: user?.login || 'unknown',
      displayName: user?.displayName || 'Unknown user',
      avatarUrl: user?.avatarUrl || '',
    };
  }));
  return hydrated;
}

export async function getUserRank(userId) {
  const rank = await db.zRevRank(KEY('leaderboard', 'alltime'), userId);
  const score = await db.zScore(KEY('leaderboard', 'alltime'), userId);
  if (rank === null || rank === undefined) return { rank: null, score: 0 };
  return { rank: rank + 1, score: Number(score) || 0 };
}
