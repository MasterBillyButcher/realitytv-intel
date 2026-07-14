/* ═══════════════════════════════════════════════════════════
   live-followers.js  —  Reality TV Intel 2026
   Admin-triggered live Instagram follower refresh via /api/followers
   (a Vercel serverless proxy — see api/followers.js for why this
   can't run purely client-side).
═══════════════════════════════════════════════════════════ */

const LIVE_BATCH_SIZE = 40; // stay under the API route's own cap with room to spare

function _collectRefreshTargets(scopeKey) {
  const keys = scopeKey ? [scopeKey] : getShowKeys();
  const targets = [];
  let skippedHidden = 0;
  keys.forEach(k => {
    (window.DB[k] || []).forEach(c => {
      // Hidden contestants (eliminated & auto-hidden, or hidden for any
      // other admin reason) are skipped entirely — no Apify credits
      // spent tracking someone who isn't shown in the Growth table.
      // Unhide them in 👁 Visibility to bring them back into refreshes.
      if (typeof isH === 'function' && isH(k, c.id)) { skippedHidden++; return; }
      const handle = String(c.ig || '').trim().replace(/^@/, '');
      if (handle && handle.toLowerCase() !== 'n/v') {
        targets.push({ key: k, id: c.id, handle: handle.toLowerCase(), contestant: c });
      }
    });
  });
  return { targets, skippedHidden };
}

async function refreshFollowersLive(scopeKey) {
  if (!document.body.classList.contains('admin-active')) {
    toast('Admin only', 'err');
    return;
  }

  const { targets, skippedHidden } = _collectRefreshTargets(scopeKey);
  if (!targets.length) {
    toast(skippedHidden
      ? `No refreshable profiles — all ${skippedHidden} contestant(s) in scope are hidden. Unhide in 👁 Visibility first.`
      : 'No Instagram handles found to refresh', 'warn');
    return;
  }

  const label = scopeKey ? (window.SHOWS[scopeKey]?.label || scopeKey) : 'all shows';
  const btnIds = ['live-refresh-btn', 'live-refresh-btn-all'];
  btnIds.forEach(id => {
    const b = document.getElementById(id);
    if (!b) return;
    b.disabled = true; // real buttons (per-show export list)
    b.classList.add('ecard-disabled'); // the Export panel's div-based card
  });
  toast(`⟳ Fetching live follower counts for ${targets.length} profile(s) in ${label}${skippedHidden ? ` (${skippedHidden} hidden, skipped)` : ''}…`);

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  let updated = 0;
  const failed = [];

  try {
    for (let i = 0; i < targets.length; i += LIVE_BATCH_SIZE) {
      const batch = targets.slice(i, i + LIVE_BATCH_SIZE);
      const usernames = [...new Set(batch.map(t => t.handle))];

      let data;
      try {
        const res = await fetch('/api/followers', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usernames }),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      } catch (e) {
        toast('Live fetch failed: ' + e.message, 'err');
        failed.push(...batch.map(t => t.contestant.name));
        continue;
      }

      console.log('[Live Followers] full response:', data);
      if (data.sampleRaw?.length) {
        console.log('[Live Followers] RAW sample from Apify (copy this if asking for help):', JSON.stringify(data.sampleRaw, null, 2));
      }
      if (data.tokensAttempted > 1) {
        toast(`⚠ Your primary Apify key was out of quota or invalid — used backup key #${data.tokensAttempted} instead. Check your primary account's credit balance.`, 'warn');
      }

      if ((data.received || 0) === 0) {
        toast('⚠ ' + (data.note || 'No usable data returned — check browser console (F12) for the raw Apify response.'), 'err');
        failed.push(...batch.map(t => t.contestant.name));
        continue;
      }

      const byHandle = {};
      (data.results || []).forEach(r => { byHandle[r.username.toLowerCase()] = r; });

      batch.forEach(t => {
        const result = byHandle[t.handle];
        if (!result || result.followers === null || result.followers === undefined) {
          const reason = result?.error ? ` (${result.error})` : '';
          failed.push(t.contestant.name + reason);
          return;
        }
        const c = t.contestant;
        /* Update Current only — Last Checked is now only touched by the
           explicit "⟳ Roll Current → Last Checked" button in the Growth
           tab, never automatically on a live refresh. This matters more
           here than anywhere else: a scheduled/frequent refresh would
           otherwise erode "Last" into "yesterday's number" every single
           run, making growth-since-last meaningless. */
        c.follCur = normalizeFollowerInput(String(result.followers));
        c.follCurDate = today;
        updated++;
      });
    }
  } finally {
    btnIds.forEach(id => {
      const b = document.getElementById(id);
      if (!b) return;
      b.disabled = false;
      b.classList.remove('ecard-disabled');
    });
  }

  if (typeof renderAll === 'function') renderAll();
  if (typeof renderRankings === 'function') renderRankings();

  let msg = `✓ Live-updated ${updated} contestant${updated !== 1 ? 's' : ''} in ${label}`;
  if (updated > 0) msg += ' — now click ↓ Save JSON to download and push to GitHub';
  if (failed.length) msg += ` — ${failed.length} failed: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}`;
  toast(msg, updated > 0 ? '' : 'warn');

  if (updated > 0) {
    if (typeof saveToLocalStorage === 'function') saveToLocalStorage(false);
    if (typeof logActivity === 'function') logActivity('Live follower refresh', `${updated} updated in ${label}`, '📡');
    _pulseSaveJsonButton();
  }
}

function _pulseSaveJsonButton() {
  document.querySelectorAll('button[onclick="exportJSON()"]').forEach(btn => {
    btn.classList.add('save-json-pulse');
    setTimeout(() => btn.classList.remove('save-json-pulse'), 6000);
  });
}
