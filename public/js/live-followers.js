/* ═══════════════════════════════════════════════════════════
   live-followers.js — Reality TV Intel 2026
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
      // Unhide them in Visibility to bring them back into refreshes.
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
      ? `No refreshable profiles. All ${skippedHidden} contestant(s) in scope are hidden. Unhide in Visibility first.`
      : 'No Instagram handles found to refresh', 'warn');
    return;
  }

  const label = scopeKey ? (window.SHOWS[scopeKey]?.label || scopeKey) : 'all shows';
  // Every button that can trigger a live refresh — the single "all shows"
  // card in the Export panel, plus one "⟳ Refresh Followers" button per
  // show's Growth tab (all of which exist in the DOM simultaneously,
  // since every show panel is built up front, not just the visible one).
  const allRefreshBtns = [
    document.getElementById('live-refresh-btn-all'),
    ...document.querySelectorAll('.live-refresh-btn'),
  ].filter(Boolean);
  allRefreshBtns.forEach(b => {
    b.disabled = true;
    b.classList.add('ecard-disabled'); // no-op on real <button>s, needed for the Export panel's div-based card
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
        toast(`⚠ Your primary Apify key was out of quota or invalid. Used backup key #${data.tokensAttempted} instead. Check your primary account's credit balance.`, 'warn');
      }

      if ((data.received || 0) === 0) {
        toast('⚠ ' + (data.note || 'No usable data returned. Check browser console (F12) for the raw Apify response.'), 'err');
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
    allRefreshBtns.forEach(b => {
      b.disabled = false;
      b.classList.remove('ecard-disabled');
    });
  }

  if (typeof renderAll === 'function') renderAll();
  if (typeof renderRankings === 'function') renderRankings();

  let msg = `Live-updated ${updated} contestant${updated !== 1 ? 's' : ''} in ${label}`;
  if (updated > 0) msg += '. Click Publish Live to push it to everyone';
  if (failed.length) msg += ` · ${failed.length} failed: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}`;
  toast(msg, updated > 0 ? '' : 'warn');

  if (updated > 0) {
    // Stamp when this scope was last refreshed, so the Growth tab can
    // show a live "refreshed Xm Ys ago" readout. Keyed per show (plus
    // an 'all' key) so refreshing one show doesn't reset another's
    // timer — matching the fact that the refresh itself is per-show.
    setLastRefreshed(scopeKey);
    if (typeof saveToLocalStorage === 'function') saveToLocalStorage(false);
    if (typeof logActivity === 'function') logActivity('Live follower refresh', `${updated} updated in ${label}`, '');
    _pulseSaveJsonButton();
  }
}

/* ─── LAST-REFRESHED TIMESTAMPS ─────────────────────────────
   Per-scope, stored in localStorage so the readout survives a page
   reload. A per-show refresh stamps only that show; the "all shows"
   refresh stamps every show plus the 'all' bucket, since it genuinely
   did refresh each of them. */
const REFRESH_TS_PREFIX = 'rti_last_refresh_';

function setLastRefreshed(scopeKey) {
  const now = Date.now();
  try {
    if (scopeKey) {
      localStorage.setItem(REFRESH_TS_PREFIX + scopeKey, String(now));
    } else {
      localStorage.setItem(REFRESH_TS_PREFIX + 'all', String(now));
      (typeof getShowKeys === 'function' ? getShowKeys() : []).forEach(k =>
        localStorage.setItem(REFRESH_TS_PREFIX + k, String(now))
      );
    }
  } catch { /* storage disabled — the readout just won't persist */ }
}

function getLastRefreshed(scopeKey) {
  try {
    const raw = localStorage.getItem(REFRESH_TS_PREFIX + (scopeKey || 'all'));
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

/** "3h 12m 08s ago" / "just now" — seconds always shown so the readout
 *  visibly ticks every second rather than looking frozen. */
function formatSinceRefresh(ts) {
  if (!ts) return 'Never refreshed';
  const secs = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (secs < 3) return 'Refreshed just now';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = n => String(n).padStart(2, '0');
  let out;
  if (d) out = `${d}d ${h}h ${pad(m)}m`;
  else if (h) out = `${h}h ${pad(m)}m ${pad(s)}s`;
  else if (m) out = `${m}m ${pad(s)}s`;
  else out = `${s}s`;
  return `Refreshed ${out} ago`;
}

/* One shared ticker drives every readout on the page, rather than one
   interval per show panel. Runs once a second so the seconds actually
   count up in real time. */
function _tickRefreshReadouts() {
  document.querySelectorAll('[data-refresh-readout]').forEach(el => {
    const scope = el.getAttribute('data-refresh-readout') || '';
    const ts = getLastRefreshed(scope === 'all' ? null : scope);
    el.textContent = formatSinceRefresh(ts);
    el.classList.toggle('refresh-stale', !ts);
  });
}
setInterval(_tickRefreshReadouts, 1000);
document.addEventListener('DOMContentLoaded', _tickRefreshReadouts);

function _pulseSaveJsonButton() {
  document.querySelectorAll('button[onclick="exportJSON()"]').forEach(btn => {
    btn.classList.add('save-json-pulse');
    setTimeout(() => btn.classList.remove('save-json-pulse'), 6000);
  });
}
