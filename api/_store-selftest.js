/* ═══════════════════════════════════════════════════════════
   api/_store-selftest.js — Reality TV Intel 2026
   Admin-only. Exercises the full _store.js foundation end-to-end
   against your real, connected database: create a user, create a
   prediction, submit an entry, confirm a duplicate entry is
   correctly rejected, resolve the prediction, confirm the
   leaderboard reflects the score — then deletes every test key it
   created, so nothing test-related is left behind.

   This exists so the schema-redesign foundation is provably working
   on your actual Redis before anything (Twitch OAuth, the
   predictions UI) gets built on top of it — one broken layer under
   working-looking code is exactly what wastes a debugging session
   later.

   GET /api/_store-selftest  (requires an active admin session)
═══════════════════════════════════════════════════════════ */

import { isValidAdminSession } from './_auth.js';
import * as db from './_db.js';
import * as store from './_store.js';

function step(results, name, ok, detail) {
  results.push({ step: name, ok, detail: detail ?? null });
}

export default async function handler(req, res) {
  if (!isValidAdminSession(req)) {
    res.status(401).json({ error: 'Admin session required.' });
    return;
  }

  const results = [];
  const testUserId = '__selftest_user__';
  let predictionId = null;

  try {
    // 1. Connection
    step(results, 'Connection detected', db.connection.kind !== 'none', db.connection.kind === 'none' ? `checked: ${db.connection.checked.join(', ')}` : `via ${db.connection.envVar}`);
    if (db.connection.kind === 'none') throw new Error('No database connected — stopping here.');

    // 2. User upsert
    const user = await store.upsertUser({ id: testUserId, login: 'selftest', displayName: 'Self-Test User', avatarUrl: '' });
    step(results, 'Create/update user', !!user && user.id === testUserId, user);

    // 3. Create prediction
    const pred = await store.createPrediction({
      question: '[selftest] Which option wins?',
      options: [{ value: 'A' }, { value: 'B' }],
      showKey: '',
      createdBy: testUserId,
      pointsValue: 10,
    });
    predictionId = pred.id;
    step(results, 'Create prediction', pred.status === 'open' && pred.options.length === 2, { id: pred.id, status: pred.status });

    // 4. Submit entry
    const entry1 = await store.submitEntry(predictionId, testUserId, 'A');
    step(results, 'Submit entry', entry1.ok === true, entry1);

    // 5. Duplicate entry must be rejected (this is the concurrency guarantee)
    const entry2 = await store.submitEntry(predictionId, testUserId, 'B');
    step(results, 'Duplicate entry correctly rejected', entry2.ok === false, entry2);

    // 6. Entry counts
    const counts = await store.getEntryCounts(predictionId);
    step(results, 'Entry counts updated', counts.A === '1', counts);

    // 7. Resolve — testUserId picked 'A', mark 'A' as correct
    const resolved = await store.resolvePrediction(predictionId, 'A');
    step(results, 'Resolve prediction', resolved.prediction.status === 'resolved' && resolved.winners.includes(testUserId), { winners: resolved.winners, status: resolved.prediction.status });

    // 8. Leaderboard reflects the score
    const rank = await store.getUserRank(testUserId);
    step(results, 'Leaderboard scored correctly', rank.score === 10, rank);

    const allPassed = results.every(r => r.ok);
    res.status(allPassed ? 200 : 500).json({ allPassed, results, connection: db.connection.kind });
  } catch (err) {
    step(results, 'Unhandled error', false, err.message);
    res.status(500).json({ allPassed: false, results, connection: db.connection.kind, error: err.message });
  } finally {
    // Clean up every test key regardless of pass/fail, so nothing
    // test-related lingers in the real database. Keys must match the
    // rti: prefix _store.js actually writes to.
    try {
      await db.del(`rti:user:${testUserId}`);
      await db.zRem('rti:leaderboard:alltime', testUserId);
      if (predictionId) {
        await db.del(`rti:prediction:${predictionId}`);
        await db.del(`rti:prediction:${predictionId}:entries`);
        await db.del(`rti:prediction:${predictionId}:counts`);
        await db.sRem('rti:predictions:open', predictionId);
        await db.sRem('rti:predictions:closed', predictionId);
        await db.sRem('rti:predictions:resolved', predictionId);
      }
    } catch (cleanupErr) {
      console.warn('[_store-selftest] Cleanup had an issue (non-fatal):', cleanupErr.message);
    }
  }
}
