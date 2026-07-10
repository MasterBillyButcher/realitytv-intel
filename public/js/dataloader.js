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
}

/** Load the copy bundled with this deploy — same-origin, fast, always available. */
async function loadBundledData() {
  try {
    const res = await fetch('data/data.js', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _applyDataJSON(await res.text());
    return true;
  } catch (err) {
    console.warn('[DataLoader] Bundled data.js failed to load/parse:', err.message);
    return false;
  }
}

/** Load the latest copy from GitHub — may be newer than the bundled one. */
async function loadDataFromGitHub() {
  const url = _rawUrl();
  try {
    const res = await fetch(url + '?cb=' + Date.now(), { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);
    _applyDataJSON(await res.text());
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

async function bootApp() {
  const bundledOK = await loadBundledData();
  await loadDataFromGitHub(); // best-effort refresh; bundled copy already in place either way

  if (!bundledOK && !window.SHOWS) {
    console.error('[DataLoader] No data source succeeded — site will render with no contestants.');
  }

  window._dataReady = true;
  if (typeof getShowKeys !== 'function') return;

  if (Array.isArray(window.HIDDEN_SHOWS_INIT) && typeof HIDDEN_SHOWS !== 'undefined') {
    HIDDEN_SHOWS.clear();
    window.HIDDEN_SHOWS_INIT.forEach(k => HIDDEN_SHOWS.add(k));
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
}
