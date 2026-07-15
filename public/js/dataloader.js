/* ═══════════════════════════════════════════════════════════
   dataloader.js  —  Reality TV Intel 2026
   Loads data.js — first the local bundled copy, then tries GitHub
   for anything newer. Both go through JSON.parse, never eval.

   SECURITY MODEL CHANGE from the previous version:
   The old loader did `new Function(fetchedCode)()` on whatever text
   came back from raw.githubusercontent.com. That's arbitrary code
   execution on every visitor's browser if that GitHub path is ever
   compromised (repo takeover, someone else gaining push access, a
   supply-chain issue) — not just "bad data show up," full script
   execution. data.js is now strict JSON, so a corrupted or malicious
   file can only ever fail to parse or contain wrong data — it can
   never execute anything.

   This also removes the previous <script src="data/data.js"> tag
   from index.html: that tag relied on data.js being executable JS
   too (window.SHOWS = {...} as a side-effecting statement), which
   pure JSON content can't do. Now this file fetches the bundled copy
   the same way it fetches the GitHub copy — one consistent, safe
   code path instead of two different loading mechanisms.

   HOW TO CONFIGURE:
   Set your GitHub username and repo name below — that's it.
═══════════════════════════════════════════════════════════ */

const DATA_CONFIG = {
  owner:  'MasterBillyButcher',
  repo:   'realitytv-intel',
  file:   'public/data/data.js',
  branch: 'main',
};

function _rawUrl() {
  const { owner, repo, file, branch } = DATA_CONFIG;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file}`;
}

/** Parse fetched data.js text (strict JSON) and apply it to window.* */
function _applyDataJSON(text) {
  const parsed = JSON.parse(text); // throws on malformed/malicious content — never executes it
  if (!parsed || typeof parsed !== 'object') throw new Error('data.js did not contain a JSON object');
  if (parsed.SHOWS) window.SHOWS = parsed.SHOWS;
  if (parsed.DB)    window.DB    = parsed.DB;
  if (Array.isArray(parsed.HIDDEN_SHOWS_INIT)) window.HIDDEN_SHOWS_INIT = parsed.HIDDEN_SHOWS_INIT;
  // Per-contestant hidden list (e.g. eliminated contestants auto-hidden
  // by the admin) — previously this only ever lived in the admin's own
  // browser localStorage and never reached data.js/GitHub, so regular
  // visitors (and the admin on a different device) never saw it and the
  // followers API had no way to know who to skip. Now it round-trips
  // through data.js like HIDDEN_SHOWS_INIT already does.
  if (Array.isArray(parsed.HIDDEN_INIT)) window.HIDDEN_INIT = parsed.HIDDEN_INIT;
}

/** Load the copy bundled with this deploy — same-origin, fast, always available. */
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

/** Load the latest copy from GitHub — may be newer than the bundled one.
 * Returns true only if the fetched text actually differs from what's
 * already applied, so the caller can skip a disruptive re-render when
 * nothing changed (the common case — most loads match the bundled copy). */
let _lastAppliedText = null;

async function loadDataFromGitHub() {
  const url = _rawUrl();
  try {
    const res = await fetch(url + '?cb=' + Date.now(), { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);
    const text = await res.text();
    if (text === _lastAppliedText) return false; // identical — nothing to re-render
    _applyDataJSON(text);
    _lastAppliedText = text;
    console.log('[DataLoader] ✓ Loaded from GitHub:', url);
    return true;
  } catch (err) {
    console.warn('[DataLoader] GitHub fetch failed, keeping bundled data.js:', err.message);
    return false;
  }
}

/* ─── BOOT SEQUENCE ─────────────────────────────────────────
   Runs exactly once, at initial page load, before any panel has
   been built — there is no user interaction happening yet for this
   to "race" against. The bundled copy loads first so the page has
   correct data even if GitHub is unreachable; the GitHub copy then
   overwrites it if it successfully loads something newer. */
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

  try {
    const t = localStorage.getItem('realityTV2026_theme') || 'dark';
    if (typeof setTheme === 'function') setTheme(t, false);
  } catch {}

  _applyDeepLinkOnce();
}

/** Honors ?show=<key> (e.g. from a link on landing.html's 3D show
 * portals) by opening that show's panel directly. Only fires once, on
 * the first successful render — a later background GitHub refresh
 * re-running _renderApp() must never yank the visitor back to this
 * panel if they've since navigated elsewhere in the app. */
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
  // Same-origin bundled copy: fast, always available. Render as soon as
  // this lands — don't make every visitor wait on a cross-origin round
  // trip to GitHub before they see anything.
  const bundledOK = await loadBundledData();

  if (!bundledOK && !window.SHOWS) {
    console.error('[DataLoader] No data source succeeded — site will render with no contestants.');
  }

  window._dataReady = true;
  _renderApp();

  // GitHub copy may be newer (admin pushed an edit since this deploy) —
  // fetch it in the background and only re-render if it actually changes
  // anything. Never blocks first paint.
  loadDataFromGitHub().then(githubOK => {
    if (githubOK) _renderApp();
  });
}
