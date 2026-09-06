/* ═══════════════════════════════════════════════════════════
   dataloader.js  —  Reality TV Intel 2026
   Loads data from the live database (/api/data), falling back to the
   bundled copy only if the database is unreachable or hasn't been
   migrated yet. Both go through JSON.parse, never eval.

   HISTORY:
   v1 used `new Function(fetchedCode)()` on whatever text came back
   from GitHub — arbitrary code execution on every visitor's browser
   if that path was ever compromised. v2 switched to strict JSON
   fetched from GitHub raw, with the bundled copy as a fallback. This
   version (v3) replaces GitHub entirely with a real database behind
   /api/data — admin edits are now live for every visitor within
   ~20s (the edge cache window) instead of requiring an export,
   manual GitHub upload, and a full redeploy.
═══════════════════════════════════════════════════════════ */

/** Parse fetched data text (strict JSON) and apply it to window.* */
function _applyDataJSON(text) {
  const parsed = JSON.parse(text); // throws on malformed/malicious content — never executes it
  if (!parsed || typeof parsed !== 'object') throw new Error('data payload did not contain a JSON object');
  if (parsed.SHOWS) window.SHOWS = parsed.SHOWS;
  if (parsed.DB)    window.DB    = parsed.DB;
  if (Array.isArray(parsed.HIDDEN_SHOWS_INIT)) window.HIDDEN_SHOWS_INIT = parsed.HIDDEN_SHOWS_INIT;
  if (Array.isArray(parsed.HIDDEN_INIT))       window.HIDDEN_INIT       = parsed.HIDDEN_INIT;
}

let _lastAppliedText = null;

/** Primary source — the live database via /api/data. Same-origin, and
 * edge-cached for ~20s server-side, so this is both the freshest and
 * the fastest option; there's no reason to prefer the bundled copy
 * when this succeeds. */
async function loadFromDatabase() {
  try {
    const res = await fetch('/api/data', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text === _lastAppliedText) return 'unchanged';
    _applyDataJSON(text);
    _lastAppliedText = text;
    return 'changed';
  } catch (err) {
    console.warn('[DataLoader] /api/data failed:', err.message);
    return 'failed';
  }
}

/** Fallback only — the copy bundled with this deploy. Used if the
 * database has never been migrated yet, or is briefly unreachable, so
 * the site still shows correct-as-of-last-deploy data instead of
 * nothing. Same-origin, fast, always available. */
async function loadBundledData() {
  try {
    const res = await fetch('data/data.js', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    _applyDataJSON(text);
    _lastAppliedText = text;
    return true;
  } catch (err) {
    console.warn('[DataLoader] Bundled data.js failed to load/parse:', err.message);
    return false;
  }
}

/* ─── BOOT SEQUENCE ───────────────────────────────────────── */
window._dataReady = false;

/** Build/rebuild every panel from whatever's currently in window.SHOWS/window.DB. */
function _renderApp() {
  if (typeof getShowKeys !== 'function') return;

  if (Array.isArray(window.HIDDEN_SHOWS_INIT) && typeof HIDDEN_SHOWS !== 'undefined') {
    HIDDEN_SHOWS.clear();
    window.HIDDEN_SHOWS_INIT.forEach(k => HIDDEN_SHOWS.add(k));
  }

  if (Array.isArray(window.HIDDEN_INIT) && typeof HIDDEN !== 'undefined') {
    HIDDEN.clear();
    window.HIDDEN_INIT.forEach(k => HIDDEN.add(k));
  }

  const dp = document.getElementById('dynamic-panels');
  if (dp) dp.innerHTML = '';

  Object.keys(window.SHOWS || {}).forEach(k => {
    if (typeof buildShowPanel === 'function') buildShowPanel(k);
  });

  if (typeof rebuildSidebar       === 'function') rebuildSidebar();
  if (typeof renderAll            === 'function') renderAll();
  if (typeof renderOverview       === 'function') renderOverview();
  if (typeof updateStats          === 'function') updateStats();
  if (typeof rebuildExportPanel   === 'function') rebuildExportPanel();
  if (typeof renderActivityFeed   === 'function') renderActivityFeed();
  if (typeof _populateRankFilters === 'function') _populateRankFilters();
  if (typeof populatePredictionShowDropdown === 'function') populatePredictionShowDropdown();

  try {
    const t = localStorage.getItem('realityTV2026_theme') || 'dark';
    if (typeof setTheme === 'function') setTheme(t, false);
  } catch {}

  _applyDeepLinkOnce();
}

/** Honors ?show=<key> (e.g. from a link on the 3D landing page's show
 * portals) by opening that show's panel directly. Only fires once, on
 * the first successful render — a later background poll re-running
 * _renderApp() must never yank the visitor back to this panel if
 * they've since navigated elsewhere in the app. */
let _deepLinkApplied = false;
function _applyDeepLinkOnce() {
  if (_deepLinkApplied) return;
  _deepLinkApplied = true;
  try {
    const key = new URLSearchParams(location.search).get('show');
    if (key && window.SHOWS && window.SHOWS[key] && typeof showPanel === 'function') {
      showPanel('show-' + key);
    }
  } catch {}
}

async function bootApp() {
  const dbResult = await loadFromDatabase();

  if (dbResult === 'failed') {
    // Database unreachable or not migrated yet — bundled copy keeps
    // the site correct-as-of-last-deploy instead of showing nothing.
    const bundledOK = await loadBundledData();
    if (!bundledOK && !window.SHOWS) {
      console.error('[DataLoader] No data source succeeded — site will render with no contestants.');
    }
  }

  window._dataReady = true;
  _renderApp();

  // Background poll — picks up admin edits made from another device or
  // tab while this one stays open, without needing a page refresh.
  // 45s matches the spirit of the 20s edge cache without hammering it.
  setInterval(async () => {
    if (document.hidden) return; // don't bother polling a backgrounded tab
    const result = await loadFromDatabase();
    if (result === 'changed') _renderApp();
  }, 45000);
}
