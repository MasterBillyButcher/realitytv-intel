/* ═══════════════════════════════════════════════════════════
   app.js — Reality TV Intel 2026
   Rendering · Navigation · CRUD · Sort · Growth logic.
═══════════════════════════════════════════════════════════ */

/* ─── STATE ─────────────────────────────────────────────── */
let HIDDEN = new Set();
let HIDDEN_SHOWS = new Set(); // show keys hidden from public view
let editMode = false;
let editTarget = null;
let _copySource = null; // { key, id } — contestant pending a copy-to-show action
let showEditKey = null;

window._growthOrder = window._growthOrder || {};
window._growthSort = window._growthSort || {};
window._growthScope = window._growthScope || {}; // 'active' (default) or 'all' — per show

/* ─── SHOW VISIBILITY HELPERS ───────────────────────────── */
function isShowHidden(key) { return HIDDEN_SHOWS.has(key); }
function toggleShowHidden(key) {
  isShowHidden(key) ? HIDDEN_SHOWS.delete(key) : HIDDEN_SHOWS.add(key);
  rebuildSidebar();
  renderOverview();
  updateStats();
  renderShowList();
  if (typeof _autoPersist === 'function') _autoPersist();
  const nowHidden = isShowHidden(key);
  toast(nowHidden
    ? `"${window.SHOWS[key]?.label}" hidden from public`
    : `✓ "${window.SHOWS[key]?.label}" now visible`,
    nowHidden ? 'warn' : '');
}

const THEME_KEY = 'realityTV2026_theme';

/* ─── SHOW KEY HELPERS ──────────────────────────────────── */
function getShowKeys() {
  return Object.keys(window.SHOWS || {}).sort((a, b) => {
    const sa = window.SHOWS[a] || {}, sb = window.SHOWS[b] || {};
    const ta = showSortTime(sa), tb = showSortTime(sb);
    return ta !== tb ? ta - tb : String(sa.label || a).localeCompare(String(sb.label || b));
  });
}
function showSortTime(s) {
  const t = Date.parse(s?.releaseDate || s?.date || '');
  return isNaN(t) ? Infinity : t;
}
function showDateLabel(s) { return s?.date || formatReleaseDate(s?.releaseDate) || 'TBC'; }
function formatReleaseDate(v) {
  if (!v) return '';
  const t = Date.parse(v);
  return isNaN(t) ? v : new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', year:'numeric' }).format(new Date(t));
}

/* ─── THEME ─────────────────────────────────────────────── */
function getCurrentTheme() {
  return document.body.classList.contains('theme-light') ? 'light' : 'dark';
}
function setTheme(theme, persist = true) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.body.classList.toggle('theme-light', next === 'light');
  const btn = document.getElementById('themeBtn');
  if (btn) {
    const label = document.getElementById('themeBtnLabel');
    const text = next === 'light' ? 'Light Mode' : 'Dark Mode';
    if (label) label.textContent = text; else btn.innerHTML = text;
    btn.title = next === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
  }
  if (persist) {
    localStorage.setItem(THEME_KEY, next);
    if (typeof _autoPersist === 'function') _autoPersist();
  }
}
function toggleTheme() {
  const next = getCurrentTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  toast(next === 'light' ? 'Light mode' : 'Dark mode');
}

/* ─── FOLLOWER UTILS ────────────────────────────────────── */
function parseF(s) {
  if (!s || s === 'N/V') return null;
  const m = String(s).trim().replace(/,/g,'').replace(/\s/g,'').match(/([\d.]+)([KMBkmb]?)/);
  if (!m) return null;
  const n = parseFloat(m[1]), u = (m[2] || '').toUpperCase();
  return u === 'K' ? n * 1e3 : u === 'M' ? n * 1e6 : u === 'B' ? n * 1e9 : n;
}
function fmtF(n, dp = 2) {
  if (n === null || n === undefined || isNaN(n)) return 'N/V';
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(dp) + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.round(n).toLocaleString();
}
function normalizeFollowerInput(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 'N/V';
  if (/^n\/?v$/i.test(raw)) return 'N/V';

  /* Admin typed shorthand like "3.5M" or "420K" — that IS the precision
     they intended, so format it consistently. */
  if (/[KMBkmb]\s*$/.test(raw)) {
    const p = parseF(raw);
    return p === null ? raw : fmtF(p, p >= 1e6 ? 1 : 0);
  }

  /* Admin typed an exact number (e.g. "10123456" or "10,123,456") —
     keep it EXACT. Rounding this to K/M at save time is what was
     hiding single-follower changes in growth calculations. Display
     functions format this for readability; storage stays precise. */
  const cleaned = raw.replace(/,/g, '');
  if (/^\d+(\.\d+)?$/.test(cleaned)) {
    return String(Math.round(parseFloat(cleaned)));
  }

  return raw;
}

/** Display-only formatter: shows the stored value as K/M for readability
    without touching what's actually saved. Use this anywhere a follower
    count is rendered to the user (tables, cards, rankings). */
function displayFollower(stored) {
  if (!stored || stored === 'N/V') return 'N/V';
  const n = parseF(stored);
  return n === null ? stored : fmtF(n, n >= 1e6 ? 1 : 0);
}
function calcGrowth(last, cur) {
  const l = parseF(last), c = parseF(cur);
  if (l === null || c === null) return { diff:'N/V', rate:'N/V', diffRaw:null, rateRaw:null };
  const d = c - l, r = l > 0 ? (d / l) * 100 : 0;
  return {
    diff: (d >= 0 ? '+' : '') + fmtF(d, 1),
    rate: (r >= 0 ? '+' : '') + r.toFixed(2) + '%',
    diffRaw: d,
    rateRaw: r
  };
}

/* ─── MISC HELPERS ──────────────────────────────────────── */
function contestantInitials(name) {
  return String(name || '??').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '??';
}
function badge(s) {
  const u = (s || '').toUpperCase();
  if (u.includes('ELIMINATED')) return '<span class="bdg be">✗ ELIMINATED</span>';
  if (u.includes('WILDCARD')) return '<span class="bdg bwc">★ WILDCARD</span>';
  if (u.includes('CONFIRMED')) return '<span class="bdg bc">✓ CONFIRMED</span>';
  if (u.includes('RUMOURED') || u.includes('RUMORED')) return '<span class="bdg br">~ RUMOURED</span>';
  if (u.includes('APPROACHED')) return '<span class="bdg ba">→ APPROACHED</span>';
  return `<span class="bdg bw">${sanitizeHTML(s || '')}</span>`;
}
function rowCls(s) {
  const u = (s || '').toUpperCase();
  if (u.includes('ELIMINATED')) return 're';
  if (u.includes('WILDCARD')) return 'rwc';
  if (u.includes('CONFIRMED')) return 'rc';
  if (u.includes('RUMOURED') || u.includes('RUMORED')) return 'rr';
  if (u.includes('APPROACHED')) return 'ra';
  return '';
}
function isH(k, id) { return HIDDEN.has(k + '::' + id); }
function toggleH(k, id) {
  const key = k + '::' + id;
  HIDDEN.has(key) ? HIDDEN.delete(key) : HIDDEN.add(key);
  renderAll(); updateStats();
  if (typeof renderHideMgr === 'function') renderHideMgr();
  if (typeof _autoPersist === 'function') _autoPersist();
}
function ed(val, k, id, f) {
  const isFoll = /^foll(Before|Last|Cur)$/.test(f);
  if (!editMode) {
    const shown = isFoll ? displayFollower(val) : (val || '');
    return `<span>${shown}</span>`;
  }
  return `<span contenteditable="true" data-k="${k}" data-i="${id}" data-f="${f}" onblur="inlineSave(this)">${val || ''}</span>`;
}
function inlineSave(el) {
  const { k, i, f } = el.dataset;
  const c = (window.DB[k] || []).find(x => x.id === parseInt(i));
  if (c) {
    const raw = el.innerText.trim();
    c[f] = /^foll(Before|Last|Cur)$/.test(f) ? normalizeFollowerInput(raw) : sanitizeHTML(raw);
    toast('✓ Saved: ' + f);
    if (typeof _autoPersist === 'function') _autoPersist();
  }
}

/* ─── AVATAR ────────────────────────────────────────────── */
function contestantAvatar(c) {
  const name = c?.name || 'Contestant';
  const init = contestantInitials(name);
  const photo = String(c?.photo || '').trim();
  if (!photo) {
    return `<div class="contestant-avatar"><div class="contestant-avatar-fallback">${init}</div></div>`;
  }
  return `<div class="contestant-avatar">
    <img src="${photo.replace(/"/g, '&quot;')}" alt="${sanitizeHTML(name)}" loading="lazy"
      onload="this.nextElementSibling.style.display='none'"
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
    <div class="contestant-avatar-fallback" style="display:none">${init}</div>
  </div>`;
}

/* ─── INSTAGRAM LINK ────────────────────────────────────── */
function igLink(igVal) {
  if (!igVal || igVal === 'N/V') return '<span style="color:var(--mut);font-size:10px">N/V</span>';
  // Remove ALL whitespace (leading, trailing, internal) and the @ prefix
  const handle = igVal.replace(/\s/g, '').replace(/^@/, '');
  if (!handle) return '<span style="color:var(--mut);font-size:10px">N/V</span>';
  const icon = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`;
  return `<a class="ig-link" href="https://www.instagram.com/${handle}" target="_blank" rel="noopener noreferrer">${icon} @${handle}</a>`;
}

/* ─── TOAST ─────────────────────────────────────────────── */
function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.className = 'toast' + (type ? ' ' + type : '');
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ─── IN-APP CONFIRM DIALOG ──────────────────────────────
   Replaces the native window.confirm() used for destructive actions
   (delete, logout, clear data, etc). The native dialog is an
   unstyled OS-level popup — on several mobile browsers/webviews it
   renders as a jarring plain black box before the text paints in,
   which read as a broken "black screen" flash. This is a themed
   in-app modal instead, built from the same .mbg/.modal markup
   already used elsewhere, so it never leaves the page's own look. */
function appConfirm(message, opts = {}) {
  return new Promise(resolve => {
    let bg = document.getElementById('confirm-mbg');
    if (!bg) {
      bg = document.createElement('div');
      bg.id = 'confirm-mbg';
      bg.className = 'mbg';
      bg.innerHTML = `
        <div class="modal" style="max-width:380px">
          <div class="mtitle" id="confirm-title">Are you sure?</div>
          <div id="confirm-msg" style="font-size:13px;color:var(--txt2);line-height:1.6;margin:4px 0 18px"></div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn b-gh" id="confirm-cancel">Cancel</button>
            <button class="btn b-warn" id="confirm-ok">Confirm</button>
          </div>
        </div>`;
      document.body.appendChild(bg);
      bg.addEventListener('click', e => { if (e.target === bg) settle(false); });
    }
    document.getElementById('confirm-title').textContent = opts.title || 'Are you sure?';
    document.getElementById('confirm-msg').textContent = message;
    const okBtn = document.getElementById('confirm-ok');
    okBtn.textContent = opts.okLabel || 'Confirm';
    okBtn.className = 'btn ' + (opts.danger === false ? 'b-gld' : 'b-warn');

    function settle(result) {
      bg.classList.remove('open');
      document.removeEventListener('keydown', onKey);
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      resolve(result);
    }
    function onKey(e) { if (e.key === 'Escape') settle(false); if (e.key === 'Enter') settle(true); }
    const cancelBtn = document.getElementById('confirm-cancel');
    okBtn.onclick = () => settle(true);
    cancelBtn.onclick = () => settle(false);
    document.addEventListener('keydown', onKey);
    bg.classList.add('open');
  });
}

/* ─── PANEL NAVIGATION ──────────────────────────────────── */
function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const p = document.getElementById('panel-' + id);
  if (p) p.classList.add('active');
  document.querySelectorAll('.sb-item').forEach(s => s.classList.toggle('active', s.dataset.panel === id));
  if (id === 'overview') renderOverview();
  if (id === 'rankings') renderRankings();
  if (id === 'growth-all') renderGrowthAll();
  if (id === 'export') rebuildExportPanel();
}

/* ─── EDIT MODE ─────────────────────────────────────────── */
function toggleEdit() {
  editMode = !editMode;
  const btn = document.getElementById('editBtn');
  const label = document.getElementById('editBtnLabel');
  if (label) label.textContent = 'Edit Mode: ' + (editMode ? 'ON' : 'OFF');
  else btn.textContent = 'Edit Mode: ' + (editMode ? 'ON' : 'OFF'); // fallback if markup changes
  btn.style.color = editMode ? 'var(--acc)' : '';
  btn.style.borderColor = editMode ? 'var(--acc)' : '';
  document.body.classList.toggle('edit-on', editMode);
  renderAll();
  toast(editMode ? 'Edit Mode ON: click any field to edit' : '✓ Edit Mode OFF');
}

/* ─── SIDEBAR ───────────────────────────────────────────── */
function rebuildSidebar() {
  const el = document.getElementById('sidebar-shows');
  if (!el) return;
  const isAdmin = document.body.classList.contains('admin-active');
  el.innerHTML = getShowKeys()
    .filter(k => isAdmin || !isShowHidden(k))
    .map(k => {
      const hidden = isShowHidden(k);
      return `<div class="sb-item${hidden ? ' sb-show-hidden' : ''}" data-panel="show-${k}" onclick="showPanel('show-${k}')">
        <span class="sb-dot" style="background:${window.SHOWS[k].color};${hidden ? 'opacity:.4' : ''}"></span>
        <span style="${hidden ? 'opacity:.4' : ''}">${window.SHOWS[k].label}</span>
        <span class="sb-badge"${hidden ? ' style="opacity:.4"' : ''}>${(window.DB[k] || []).length}</span>
        ${hidden ? '<span style="font-size:9px;color:var(--mut);margin-left:auto">hidden</span>' : ''}
      </div>`;
    }).join('');
}

/* ─── BUILD SHOW PANEL ──────────────────────────────────── */
function buildShowPanel(key) {
  const s = window.SHOWS[key];
  if (!s) return;
  const ex = document.getElementById('panel-show-' + key);
  if (ex) ex.remove();

  const div = document.createElement('div');
  div.className = 'panel';
  div.id = 'panel-show-' + key;
  div.innerHTML = `
    <div class="ph">
      <div>
        <div class="ph-title show-title" style="color:${s.color}">${s.label}</div>
        <div class="ph-desc">${s.platform || 'TBC'} &middot; ${showDateLabel(s)} &middot; Host: ${s.host || 'TBC'} &middot; ${s.desc || ''}</div>
      </div>
      <div class="ph-act no-capture">
        <button class="btn b-gld b-sm" onclick="capture('sw-${key}-main','${key}')">Capture All</button>
        <button class="btn b-gh b-sm" onclick="exportCSV('${key}')">↓ CSV</button>
        <button class="btn b-acc b-sm admin-only" onclick="openAdd('${key}')">+ Add</button>
        <button class="btn b-gh b-sm admin-only" onclick="openShowEdit('${key}')">Edit Show</button>
      </div>
    </div>
    ${s.bannerUrl ? `<div class="show-banner no-capture"><img src="${s.bannerUrl.replace(/"/g,'&quot;')}" alt="${sanitizeHTML(s.label)} banner" onerror="this.parentElement.style.display='none'"></div>` : ''}
    <div id="sw-${key}-main">
      <div class="tab-bar no-capture">
        <button class="tab-btn active" onclick="switchTab('${key}','roster')">Roster</button>
        <button class="tab-btn" onclick="switchTab('${key}','cards')">Card View</button>
        <button class="tab-btn" onclick="switchTab('${key}','growth')">Growth</button>
      </div>

      <!-- ROSTER TAB -->
      <div class="tab-pane active" id="sw-${key}-roster">
        <div class="filter-bar no-capture">
          <div class="filter-bar-left">
            <div class="filter-search-wrap">
              <svg class="filter-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input type="text" placeholder="Search contestants…" class="roster-search filter-search-input" data-search-key="${key}" autocomplete="off">
            </div>
            <div class="filter-select-wrap">
              <label class="filter-label">Status</label>
              <select class="filter-select" id="fstat-${key}" onchange="filterTable('${key}')">
                <option value="">All</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="RUMOURED">Rumoured</option>
                <option value="APPROACHED">Approached</option>
                <option value="REPORTEDLY CONFIRMED">Rep. Confirmed</option>
                <option value="ELIMINATED">Eliminated</option>
                <option value="WILDCARD">Wildcard</option>
              </select>
            </div>
            <div class="filter-select-wrap">
              <label class="filter-label">Gender</label>
              <select class="filter-select" id="fgender-${key}" onchange="filterTable('${key}')">
                <option value="">All</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="NB">Non-Binary</option>
                <option value="O">Other</option>
              </select>
            </div>
            <button class="filter-reset-btn" onclick="resetFilters('${key}')" title="Clear all filters">✕ Clear</button>
          </div>
          <div class="filter-bar-right">
            <button class="btn b-pur b-sm" onclick="openHideMgr('${key}')">Show/Hide</button>
            <button class="btn b-gld b-sm" onclick="capture('sw-${key}-tbl','${key}_Table')">Capture</button>
          </div>
        </div>
        <div id="sw-${key}-hid-notice"></div>
        <div class="twrap" id="sw-${key}-tbl">
          <table id="tbl-${key}">
            <thead><tr>
              <th onclick="sortT('${key}',0)" title="Sort by number"># <span class="sarr">↕</span></th>
              <th onclick="sortT('${key}',1)" title="Sort by name">Contestant <span class="sarr">↕</span></th>
              <th>Tier / Profession</th>
              <th onclick="sortT('${key}',3)" title="Sort by status">Status <span class="sarr">↕</span></th>
              <th onclick="sortT('${key}',4)" title="Sort by followers">Followers <span class="sarr">↕</span></th>
              <th class="no-capture" style="cursor:default">Actions</th>
            </tr></thead>
            <tbody id="tb-${key}"></tbody>
          </table>
        </div>
        <div class="filter-results-count no-capture" id="fc-${key}" style="display:none"></div>
      </div>

      <!-- CARD TAB -->
      <div class="tab-pane" id="sw-${key}-cards">
        <div class="cgrid" id="sw-${key}-cgrid"></div>
      </div>

      <!-- GROWTH TAB -->
      <div class="tab-pane" id="sw-${key}-growth">
        <div class="ph" style="margin-bottom:12px">
          <div style="font-size:14px;font-weight:800">Instagram Growth: ${s.label}</div>
          <div class="ph-act no-capture">
            <button class="shift-to-last-btn admin-only" onclick="shiftCurrentToLast('${key}')" title="Roll Current → Last Checked and set today's date on Last Checked field">⟳ Roll Current → Last Checked</button>
            <button class="btn b-gld b-sm" onclick="capture('gtbl-inner-${key}','${key}_Growth')">Capture</button>
            <button class="btn b-gh b-sm" onclick="exportGrowthCSV('${key}')">↓ CSV</button>
          </div>
        </div>
        <div class="dnote no-capture admin-only" style="margin-bottom:10px">
          <strong>Tip:</strong> Enable <strong>Edit Mode</strong> → click any follower cell → type new value (e.g. <em>3.5M</em>) → Tab out.
          Growth recalculates instantly. Use <strong>⟳ Roll Current → Last Checked</strong> to archive today's numbers before entering new ones.
        </div>
        <div id="sw-${key}-gtbl"></div>
      </div>
    </div>`;

  document.getElementById('dynamic-panels').appendChild(div);
}

/* ─── TAB SWITCHING ─────────────────────────────────────── */
function switchTab(key, tab) {
  const host = document.getElementById('sw-' + key + '-main');
  if (!host) return;
  host.querySelectorAll('.tab-btn').forEach((b, i) =>
    b.classList.toggle('active', ['roster','cards','growth'][i] === tab));
  host.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  const pane = document.getElementById('sw-' + key + '-' + tab);
  if (pane) pane.classList.add('active');
  if (tab === 'cards') renderCards(key);
  if (tab === 'growth') renderGrowth(key);
}

/* ─── OVERVIEW ──────────────────────────────────────────── */
function renderOverview() {
  const el = document.getElementById('ov-cards');
  if (!el) return;
  const isAdmin = document.body.classList.contains('admin-active');
  el.innerHTML = getShowKeys()
    .filter(k => isAdmin || !isShowHidden(k))
    .map(k => {
      const s = window.SHOWS[k];
      const rows = window.DB[k] || [];
      const vis = rows.filter(c => !isH(k, c.id));
      const conf = vis.filter(c => (c.status || '').toUpperCase().includes('CONFIRMED')).length;
      const rum = vis.filter(c => (c.status || '').toUpperCase().includes('RUMOUR')).length;
      const hiddenShow = isShowHidden(k);
      return `<div class="ccard${hiddenShow ? ' show-card-hidden' : ''}" onclick="showPanel('show-${k}')" style="cursor:pointer">
        <div class="ccard-photo-wrap" style="aspect-ratio:2/1;border-top:3px solid ${s.color};background:linear-gradient(135deg,${s.color}22,${s.color}44);flex-direction:column;gap:6px">
          <div style="font-size:15px;font-weight:800;color:rgba(255,255,255,.9);letter-spacing:.04em;text-align:center;padding:0 12px">${s.label}</div>
          ${hiddenShow ? `<div style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,.7);color:var(--mut);font-size:9px;font-weight:700;padding:2px 7px;border-radius:6px;letter-spacing:.06em">HIDDEN</div>` : ''}
        </div>
        <div class="ccard-body">
          <div class="ccard-top-row">
            <span style="font-size:9px;font-weight:800;color:${s.color};letter-spacing:.1em;text-transform:uppercase">${s.platform || 'TBC'}</span>
          </div>
          <div class="ccard-name" style="color:${s.color};margin-top:4px">${s.label}</div>
          <div class="ccard-role">${showDateLabel(s)} · Host: ${s.host || 'TBC'}</div>
          <div class="cdiv"></div>
          <div class="crow"><span class="crow-l">Contestants</span><span class="crow-r tm" style="color:var(--blu)">${vis.length}</span></div>
          <div class="crow"><span class="crow-l">Confirmed</span><span class="crow-r" style="color:var(--grn)">${conf}</span></div>
          <div class="crow"><span class="crow-l">Rumoured</span><span class="crow-r" style="color:var(--gld)">${rum}</span></div>
          <div class="ccard-footer">
            <button class="btn b-acc b-sm" style="flex:1;justify-content:center" onclick="event.stopPropagation();showPanel('show-${k}')">View Roster →</button>
            ${isAdmin ? `<button class="btn ${hiddenShow ? 'b-grn' : 'b-warn'} b-sm no-capture" onclick="event.stopPropagation();toggleShowHidden('${k}')" title="${hiddenShow ? 'Publish show' : 'Hide show from public'}">${hiddenShow ? '✓ Publish' : 'Hide'}</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
}

/* ─── STATS BAR ─────────────────────────────────────────── */
function updateStats() {
  const isAdmin = document.body.classList.contains('admin-active');
  /* "Shows" = published/active seasons only. Hidden shows never count
     here, even for admin — this stat represents what's actually live,
     not what exists in the database. Manage hidden shows via the
     sidebar or Overview cards, which do surface them to admin. */
  const publicKeys = getShowKeys().filter(k => !isShowHidden(k));
  const visKeys = getShowKeys().filter(k => isAdmin || !isShowHidden(k));
  const allC = visKeys.flatMap(k => (window.DB[k] || []).map(c => ({ ...c, _k: k })));
  setText('st-shows', publicKeys.length);
  setText('st-total', allC.length);
  setText('st-conf', allC.filter(c => (c.status || '').toUpperCase().includes('CONFIRMED')).length);
  setText('st-rum', allC.filter(c => (c.status || '').toUpperCase().includes('RUMOUR')).length);
  setText('st-hid', HIDDEN.size);
  updateInstagramStats();
}
function setText(id, val) { const e = document.getElementById(id); if (e) e.textContent = val; }

/* ─── INSTAGRAM INTELLIGENCE STRIP (Overview) ──────────────
   Aggregates real per-contestant follower data across every visible
   show. Every figure here is derived directly from window.DB via the
   same parseF/calcGrowth helpers the Growth tab already uses — nothing
   here is invented, and any field that genuinely has no valid data
   (e.g. no contestant currently shows negative growth) renders a
   plain "—" / "None" rather than 0, NaN, or a fabricated value. */
function updateInstagramStats() {
  if (!document.getElementById('ig-total')) return; // not on this page
  // Hidden shows and hidden/eliminated contestants never count here,
  // for anyone (including admin) — this strip represents what's
  // actually being tracked, not everything that exists in the DB.
  const visKeys = getShowKeys().filter(k => !isShowHidden(k));
  const allC = visKeys.flatMap(k => (window.DB[k] || [])
    .filter(c => !isH(k, c.id))
    .map(c => ({ ...c, _k: k })));

  let totalFollowers = 0, totalCounted = 0;
  let most = null, mostVal = -1;
  let fastest = null, fastestRate = -Infinity;
  let decline = null, declineDiff = Infinity;

  allC.forEach(c => {
    const cur = parseF(c.follCur);
    if (cur !== null) { totalFollowers += cur; totalCounted++; }
    if (cur !== null && cur > mostVal) { mostVal = cur; most = c; }

    const g = calcGrowth(c.follBefore, c.follCur);
    if (g.rateRaw !== null && isFinite(g.rateRaw) && g.rateRaw > 0 && g.rateRaw > fastestRate) {
      fastestRate = g.rateRaw; fastest = { c, g };
    }
    if (g.diffRaw !== null && isFinite(g.diffRaw) && g.diffRaw < 0 && g.diffRaw < declineDiff) {
      declineDiff = g.diffRaw; decline = { c, g };
    }
  });

  setText('ig-total', totalCounted ? fmtF(totalFollowers, 2) : '-');
  setText('ig-total-sub', totalCounted ? `Across ${totalCounted} tracked contestant${totalCounted === 1 ? '' : 's'}` : 'No follower data yet');

  setText('ig-most', most ? fmtF(mostVal, 2) : '-');
  setText('ig-most-sub', most ? `${most.name} · ${window.SHOWS[most._k]?.label || most._k}` : 'No data yet');

  setText('ig-fastest', fastest ? '+' + fastest.g.rateRaw.toFixed(2) + '%' : 'None');
  setText('ig-fastest-sub', fastest ? `${fastest.c.name} · ${window.SHOWS[fastest.c._k]?.label || fastest.c._k}` : 'No growth recorded yet');

  setText('ig-decline', decline ? fmtF(decline.g.diffRaw, 1) : 'None');
  setText('ig-decline-sub', decline ? `${decline.c.name} · ${window.SHOWS[decline.c._k]?.label || decline.c._k}` : 'Nobody is currently declining');
}

/* ─── TABLE RENDER ──────────────────────────────────────── */
function renderTable(key) {
  const tbody = document.getElementById('tb-' + key);
  if (!tbody || !window.DB[key]) return;
  const hidden = [];
  const isAdmin = document.body.classList.contains('admin-active');

  tbody.innerHTML = (window.DB[key] || []).map((c, i) => {
    const hid = isH(key, c.id);
    if (hid) hidden.push(c.name);
    const gender = (c.gender || '').toUpperCase().trim();
    const cStatus = (c.status || '').toUpperCase().trim();
    return `<tr class="${rowCls(c.status)}${hid ? ' row-hidden' : ''}"
      data-search="${(c.name + ' ' + (c.status || '') + ' ' + (c.profession || '') + ' ' + (c.tier || '')).toLowerCase()}"
      data-gender="${gender}"
      data-status="${cStatus}"
      data-id="${c.id}"
      ${isAdmin ? `draggable="true" data-key="${key}"
        ondragstart="rosterDragStart(event)" ondragover="rosterDragOver(event)"
        ondrop="rosterDrop(event,'${key}')" ondragleave="rosterDragLeave(event)"` : ''}>
      <td class="tm" style="color:var(--mut);width:44px">${isAdmin ? '⠿ ' : ''}${i + 1}</td>
      <td>
        <div class="contestant-cell">
          ${contestantAvatar(c)}
          <div>
            <div class="tn">${(c.bio && !editMode) ? `<a href="javascript:void(0)" class="bio-link" onclick="openBio('${key}',${c.id})">${ed(c.name, key, c.id, 'name')}</a>` : ed(c.name, key, c.id, 'name')}</div>
            <div class="ts">${gender} · ${igLink(c.ig)}</div>
          </div>
        </div>
      </td>
      <td><span style="font-size:11px;color:var(--mut)">${ed(c.tier || c.profession || '', key, c.id, 'tier')}</span></td>
      <td>${badge(c.status)}</td>
      <td><span class="tm" style="color:var(--blu)">${ed(c.follCur || 'N/V', key, c.id, 'follCur')}</span></td>
      <td class="no-capture">
        <div style="display:flex;gap:4px;align-items:center">
          <button class="hide-btn${hid ? ' is-hid' : ''}" onclick="toggleH('${key}',${c.id})" title="${hid ? 'Show' : 'Hide'}" aria-label="${hid ? 'Show' : 'Hide'} ${sanitizeHTML(c.name)}">${hid
            ? '<svg class="btn-icon" viewBox="0 0 18 18"><path d="M2 9 Q9 3 16 9 Q9 15 2 9 Z"/><circle cx="9" cy="9" r="2.3"/><path d="M2.5 2.5 L15.5 15.5"/></svg>'
            : '<svg class="btn-icon" viewBox="0 0 18 18"><path d="M2 9 Q9 3 16 9 Q9 15 2 9 Z"/><circle cx="9" cy="9" r="2.3"/></svg>'}</button>
          <button class="btn b-gh b-xs admin-only" onclick="openEdit('${key}',${c.id})" title="Edit" aria-label="Edit ${sanitizeHTML(c.name)}"><svg class="btn-icon" viewBox="0 0 18 18"><path d="M11.5 3 L15 6.5 L6 15.5 L2.5 15.5 L2.5 12 Z M9.5 5 L13 8.5"/></svg></button>
          <button class="btn b-gh b-xs admin-only" onclick="openCopyToShow('${key}',${c.id})" title="Copy to another show" aria-label="Copy ${sanitizeHTML(c.name)} to another show"><svg class="btn-icon" viewBox="0 0 18 18"><rect x="6.5" y="6.5" width="9" height="9" rx="1.3"/><path d="M11.5 6.5 L11.5 3.5 A1.3 1.3 0 0 0 10.2 2.5 L3.5 2.5 A1.3 1.3 0 0 0 2.5 3.5 L2.5 10.2 A1.3 1.3 0 0 0 3.5 11.5 L6.5 11.5"/></svg></button>
          <button class="btn b-red b-xs admin-only" onclick="delRow('${key}',${c.id})" title="Delete" aria-label="Delete ${sanitizeHTML(c.name)}">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  const notice = document.getElementById('sw-' + key + '-hid-notice');
  if (notice) {
    notice.innerHTML = hidden.length
      ? `<div class="hid-notice no-capture"><span class="hid-count">${hidden.length}</span> hidden:
          <span style="color:var(--txt)">${hidden.join(', ')}</span>
          <button class="btn b-gh b-xs" onclick="showAllInShow('${key}')">Restore All</button>
        </div>` : '';
  }
}

/* ─── FILTER / SORT ─────────────────────────────────────── */
function filterTbl(key, q) {
  const q2 = q.toLowerCase();
  document.querySelectorAll(`#tb-${key} tr`).forEach(tr => {
    if (tr.classList.contains('row-hidden')) { tr.style.display = 'none'; return; }
    tr.style.display = tr.dataset.search?.includes(q2) ? '' : 'none';
  });
}
/* ─── UNIFIED FILTER ────────────────────────────────────── */
function filterTable(key) {
  const q = (document.querySelector(`.roster-search[data-search-key="${key}"]`)?.value || '').toLowerCase().trim();
  const status = (document.getElementById('fstat-' + key)?.value || '').toUpperCase().trim();
  const gender = (document.getElementById('fgender-' + key)?.value || '').toUpperCase().trim();

  let visible = 0, total = 0;
  document.querySelectorAll(`#tb-${key} tr`).forEach(tr => {
    // Always keep admin-hidden rows hidden
    if (tr.classList.contains('row-hidden')) {
      tr.style.display = 'none';
      return;
    }
    total++;
    const name = (tr.dataset.search || '').toLowerCase();
    const tGender = (tr.dataset.gender || '').toUpperCase().trim();
    const tStatus = (tr.dataset.status || '').toUpperCase();

    const matchQ = !q || name.includes(q);
    const matchS = !status || tStatus.includes(status);
    const matchG = !gender || tGender === gender;

    const show = matchQ && matchS && matchG;
    tr.style.display = show ? '' : 'none';
    if (show) visible++;
  });

  const fc = document.getElementById('fc-' + key);
  if (fc) {
    const hasFilter = q || status || gender;
    fc.style.display = hasFilter ? 'block' : 'none';
    fc.textContent = hasFilter ? `Showing ${visible} of ${total} contestants` : '';
  }
}

function resetFilters(key) {
  const searchEl = document.querySelector(`.roster-search[data-search-key="${key}"]`);
  if (searchEl) searchEl.value = '';
  const statEl = document.getElementById('fstat-' + key);
  if (statEl) statEl.value = '';
  const genderEl = document.getElementById('fgender-' + key);
  if (genderEl) genderEl.value = '';
  filterTable(key);
}

/* Keep old names as shims for anything that still calls them */
function filterStat(key, val) { filterTable(key); }
function filterGender(key, val) { filterTable(key); }

let _sortDirs = {};
function sortT(key, col) {
  const tbody = document.getElementById('tb-' + key);
  if (!tbody) return;
  const sk = key + '-' + col;
  _sortDirs[sk] = !_sortDirs[sk];
  const asc = _sortDirs[sk];

  // Sort only visible (non-hidden) rows to avoid disturbing hide-manager state
  const allRows = Array.from(tbody.querySelectorAll('tr'));
  const visible = allRows.filter(r => !r.classList.contains('row-hidden'));
  const hiddenRows = allRows.filter(r => r.classList.contains('row-hidden'));

  visible.sort((a, b) => {
    const at = a.cells[col]?.textContent.trim() || '';
    const bt = b.cells[col]?.textContent.trim() || '';
    const an = parseF(at) ?? parseFloat(at);
    const bn = parseF(bt) ?? parseFloat(bt);
    const numericComp = !isNaN(an) && !isNaN(bn) ? (asc ? an - bn : bn - an) : 0;
    return numericComp || (asc ? at.localeCompare(bt) : bt.localeCompare(at));
  });

  // Append visible sorted rows first, hidden rows last (they stay display:none)
  visible.forEach(r => tbody.appendChild(r));
  hiddenRows.forEach(r => tbody.appendChild(r));

  document.querySelectorAll(`#tbl-${key} th`).forEach((th, i) => {
    const s = th.querySelector('.sarr');
    if (s) s.innerHTML = i === col ? (asc ? '↑' : '↓') : '↕';
    th.classList.toggle('srtd', i === col);
  });

  // Re-apply current filter so display states stay correct after sort
  filterTable(key);
}

/* ─── CARDS RENDER ──────────────────────────────────────── */
function renderCards(key) {
  const el = document.getElementById('sw-' + key + '-cgrid');
  if (!el || !window.DB[key]) return;
  const col = window.SHOWS[key]?.color || '#4A9EFF';
  const isAdmin = document.body.classList.contains('admin-active');

  el.innerHTML = (window.DB[key] || []).map((c, i) => {
    const hid = isH(key, c.id);
    const g = calcGrowth(c.follLast, c.follCur);
    const g2 = calcGrowth(c.follBefore, c.follCur);
    const gcol = g.rateRaw !== null ? (g.rateRaw >= 0 ? 'var(--grn)' : '#CC4444') : 'var(--mut)';
    const initials = contestantInitials(c.name);
    const photo = String(c?.photo || '').trim();

    const photoBlock = photo
      ? `<div class="ccard-photo-wrap" style="border-top:3px solid ${col}">
           <img class="ccard-photo-img" src="${photo.replace(/"/g, '&quot;')}" alt="${sanitizeHTML(c.name)}" loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
           <div class="ccard-photo-fallback" style="display:none">
             <div class="ccard-avatar-ring" style="--avatar-col:${col}">
               <div class="ccard-initials">${initials}</div>
             </div>
           </div>
         </div>`
      : `<div class="ccard-photo-empty" style="border-top:3px solid ${col}">
           <div class="ccard-avatar-ring" style="--avatar-col:${col}">
             <div class="ccard-initials">${initials}</div>
           </div>
         </div>`;

    return `<div class="ccard${hid ? ' c-hid' : ''}"
      ${isAdmin ? `draggable="true" data-id="${c.id}" data-key="${key}"
        ondragstart="rosterDragStart(event)" ondragover="rosterDragOver(event)"
        ondrop="rosterDrop(event,'${key}')" ondragleave="rosterDragLeave(event)"` : ''}>
      ${photoBlock}
      <div class="ccard-body">
        <div class="ccard-top-row">
          ${badge(c.status)}
          <span class="ccard-num">${isAdmin ? '⠿ ' : ''}#${i + 1}</span>
        </div>
        <div class="ccard-name">${sanitizeHTML(c.name)}</div>
        <div class="ccard-role">${sanitizeHTML(c.profession || '')} · ${c.gender || ''}</div>
        <div class="cdiv"></div>
        <div class="crow"><span class="crow-l">Followers</span><span class="crow-r tm" style="color:var(--blu)">${displayFollower(c.follCur)}</span></div>
        <div class="crow"><span class="crow-l">Growth</span><span class="crow-r tm" style="color:${gcol}">${g.rate}</span></div>
        <div class="crow"><span class="crow-l">Total</span><span class="crow-r tm" style="color:var(--mut)">${g2.rate}</span></div>
        <div class="crow"><span class="crow-l">Instagram</span><span class="crow-r">${igLink(c.ig)}</span></div>
        ${c.knownFor ? `<div class="crow" style="align-items:flex-start"><span class="crow-l">Known For</span><span class="crow-r" style="color:var(--mut);white-space:normal;text-align:right">${sanitizeHTML(c.knownFor)}</span></div>` : ''}
        <div class="ccard-footer no-capture">
          ${c.bio ? `<button class="btn b-pur b-sm" style="flex:1;justify-content:center" onclick="openBio('${key}',${c.id})"><svg class="btn-icon" viewBox="0 0 18 18"><circle cx="9" cy="6" r="3"/><path d="M3 15.5 A6 5 0 0 1 15 15.5"/></svg>Profile</button>` : ''}
          <button class="btn b-gh b-sm admin-only" style="flex:1;justify-content:center" onclick="openEdit('${key}',${c.id})"><svg class="btn-icon" viewBox="0 0 18 18"><path d="M11.5 3 L15 6.5 L6 15.5 L2.5 15.5 L2.5 12 Z M9.5 5 L13 8.5"/></svg>Edit</button>
          <button class="btn b-gh b-sm admin-only" style="flex:1;justify-content:center" onclick="openCopyToShow('${key}',${c.id})" title="Copy to another show"><svg class="btn-icon" viewBox="0 0 18 18"><rect x="6.5" y="6.5" width="9" height="9" rx="1.3"/><path d="M11.5 6.5 L11.5 3.5 A1.3 1.3 0 0 0 10.2 2.5 L3.5 2.5 A1.3 1.3 0 0 0 2.5 3.5 L2.5 10.2 A1.3 1.3 0 0 0 3.5 11.5 L6.5 11.5"/></svg>Copy</button>
          <button class="btn ${hid ? 'b-grn' : 'b-warn'} b-sm" onclick="toggleH('${key}',${c.id})">${hid
            ? '<svg class="btn-icon" viewBox="0 0 18 18"><path d="M2 9 Q9 3 16 9 Q9 15 2 9 Z"/><circle cx="9" cy="9" r="2.3"/></svg>Show'
            : '<svg class="btn-icon" viewBox="0 0 18 18"><path d="M2 9 Q9 3 16 9 Q9 15 2 9 Z"/><circle cx="9" cy="9" r="2.3"/><path d="M2.5 2.5 L15.5 15.5"/></svg>Hide'}</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ─── GROWTH SORT STATE ─────────────────────────────────── */
function getGrowthSortKey(key) { return window._growthSort[key] || 'gain-desc'; }
function getGrowthScope(key) { return window._growthScope[key] || 'active'; }
function setGrowthScope(key, val) {
  window._growthScope[key] = val;
  renderGrowth(key);
}
function setGrowthSort(key, val) {
  window._growthSort[key] = val;
  renderGrowth(key);
  if (typeof _autoPersist === 'function') _autoPersist();
}

/* ─── GROWTH TABLE: COLUMN VISIBILITY ───────────────────────
   Per-visitor display preference (stored in this browser only) for
   which growth-table columns to show. Every column is visible by
   default; each viewer can hide the ones they don't care about
   without affecting anyone else's view. */
const GROWTH_COLS = [
  { id: 'handle', label: 'Insta Handle' },
  { id: 'before', label: 'Before Show' },
  { id: 'last', label: 'Last Checked' },
  { id: 'current', label: 'Current' },
  { id: 'growthLast', label: 'Growth (Last → Now)' },
  { id: 'growthRate', label: 'Growth Rate %' },
  { id: 'totalGrowth', label: 'Total Growth' },
  { id: 'totalRate', label: 'Total Rate %' },
];
const GROWTH_COLS_KEY = 'rti_growth_hidden_cols';
window._growthHiddenCols = window._growthHiddenCols || new Set(
  (() => { try { return JSON.parse(localStorage.getItem(GROWTH_COLS_KEY)) || []; } catch { return []; } })()
);
function isGrowthColHidden(id) { return window._growthHiddenCols.has(id); }
function toggleGrowthCol(id) {
  const set = window._growthHiddenCols;
  set.has(id) ? set.delete(id) : set.add(id);
  localStorage.setItem(GROWTH_COLS_KEY, JSON.stringify([...set]));
  const active = document.querySelector('.tab-pane.active [id^="sw-"][id$="-gtbl"]');
  if (active) { const k = active.id.replace(/^sw-/, '').replace(/-gtbl$/, ''); renderGrowth(k); }
  if (document.getElementById('ga-wrap')) renderGrowthAll();
}
function growthColumnsMenuHTML(menuId) {
  return `<div class="growth-cols-menu" id="${menuId}" style="display:none">
    ${GROWTH_COLS.map(c => `
      <label class="growth-cols-item">
        <input type="checkbox" ${isGrowthColHidden(c.id) ? '' : 'checked'} onchange="toggleGrowthCol('${c.id}')">
        ${c.label}
      </label>`).join('')}
  </div>`;
}
function toggleGrowthColsMenu(btn) {
  const menu = btn.nextElementSibling;
  const open = menu.style.display !== 'none';
  document.querySelectorAll('.growth-cols-menu').forEach(m => m.style.display = 'none');
  menu.style.display = open ? 'none' : 'block';
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.growth-cols-wrap')) {
    document.querySelectorAll('.growth-cols-menu').forEach(m => m.style.display = 'none');
  }
});

/* ─── GROWTH TABLE ──────────────────────────────────────── */
function buildGrowthHTML(key) {
  const scope = getGrowthScope(key);
  const isAdmin = document.body.classList.contains('admin-active');
  // Non-admins can only ever see active contestants, regardless of the
  // scope toggle — "All" (including hidden/eliminated) is an admin-only
  // view.
  const raw = scope === 'all' && isAdmin
    ? (window.DB[key] || [])
    : (window.DB[key] || []).filter(c => !isH(key, c.id));
  if (!raw.length) {
    return `<div style="color:var(--mut);padding:40px 20px;text-align:center;font-size:13px">
      No visible contestants. Add via <strong>+ Add</strong> or enable <strong>Edit Mode</strong>.
    </div>`;
  }

  const sortVal = getGrowthSortKey(key);
  const customOrder = window._growthOrder[key];

  let data;
  if (sortVal === 'custom' && customOrder?.length) {
    const byId = Object.fromEntries(raw.map(c => [c.id, c]));
    const ord = customOrder.map(id => byId[id]).filter(Boolean);
    raw.forEach(c => { if (!customOrder.includes(c.id)) ord.push(c); });
    data = ord;
  } else {
    data = [...raw].sort((a, b) => {
      const ga = calcGrowth(a.follLast, a.follCur);
      const gb = calcGrowth(b.follLast, b.follCur);
      const ta = calcGrowth(a.follBefore, a.follCur);
      const tb = calcGrowth(b.follBefore, b.follCur);
      const cA = parseF(a.follCur) ?? 0;
      const cB = parseF(b.follCur) ?? 0;
      switch (sortVal) {
        case 'gain-desc': return (gb.diffRaw ?? -Infinity) - (ga.diffRaw ?? -Infinity);
        case 'gain-asc': return (ga.diffRaw ?? Infinity) - (gb.diffRaw ?? Infinity);
        case 'totalgain-desc': return (tb.diffRaw ?? -Infinity) - (ta.diffRaw ?? -Infinity);
        case 'totalgain-asc': return (ta.diffRaw ?? Infinity) - (tb.diffRaw ?? Infinity);
        case 'growth-desc': return (gb.rateRaw ?? -Infinity) - (ga.rateRaw ?? -Infinity);
        case 'growth-asc': return (ga.rateRaw ?? Infinity) - (gb.rateRaw ?? Infinity);
        case 'total-desc': return (tb.rateRaw ?? -Infinity) - (ta.rateRaw ?? -Infinity);
        case 'total-asc': return (ta.rateRaw ?? Infinity) - (tb.rateRaw ?? Infinity);
        case 'followers-desc': return cB - cA;
        case 'followers-asc': return cA - cB;
        case 'name': return a.name.localeCompare(b.name);
        default: return (gb.diffRaw ?? -Infinity) - (ga.diffRaw ?? -Infinity);
      }
    });
  }

  const s = window.SHOWS[key];
  const hasCustom = customOrder?.length;

  const show = id => !isGrowthColHidden(id);

  const rows = data.map((c, idx) => {
    const g1 = calcGrowth(c.follLast, c.follCur);
    const g2 = calcGrowth(c.follBefore, c.follCur);
    const neg1 = g1.rateRaw !== null && g1.rateRaw < 0;
    const hi1 = g1.rateRaw !== null && g1.rateRaw >= 5;
    const md1 = g1.rateRaw !== null && g1.rateRaw >= 1 && g1.rateRaw < 5;
    const neg2 = g2.rateRaw !== null && g2.rateRaw < 0;
    const hi2 = g2.rateRaw !== null && g2.rateRaw >= 50;

    function eC(val, f) {
      const isFoll = /^foll(Before|Last|Cur)$/.test(f);
      if (!editMode) return (isFoll ? displayFollower(val) : val) || 'N/V';
      return `<span contenteditable="true"
        onblur="saveGrowthCell('${key}',${c.id},'${f}',this.innerText)"
        style="min-width:55px;display:inline-block;text-align:center">${val || 'N/V'}</span>`;
    }

    return `<tr draggable="true" data-id="${c.id}" data-key="${key}"
      ondragstart="growthDragStart(event)"
      ondragover="growthDragOver(event)"
      ondrop="growthDrop(event,'${key}')"
      ondragleave="growthDragLeave(event)">
      <td style="font-weight:700">${eC(c.name, 'name')}</td>
      ${show('handle') ? `<td>${igLink(c.ig)}</td>` : ''}
      ${show('before') ? `<td>${eC(c.follBefore, 'follBefore')}</td>` : ''}
      ${show('last') ? `<td>${eC(c.follLast, 'follLast')}</td>` : ''}
      ${show('current') ? `<td>${eC(c.follCur, 'follCur')}</td>` : ''}
      ${show('growthLast') ? `<td class="${neg1 ? 'neg' : hi1 ? 'hi' : md1 ? 'md' : ''}">${g1.diff}</td>` : ''}
      ${show('growthRate') ? `<td class="${neg1 ? 'neg' : hi1 ? 'hi' : md1 ? 'md' : ''}">${g1.rate}</td>` : ''}
      ${show('totalGrowth') ? `<td class="${neg2 ? 'neg' : hi2 ? 'hi' : ''}">${g2.diff}</td>` : ''}
      ${show('totalRate') ? `<td class="${neg2 ? 'neg' : hi2 ? 'hi' : ''}">${g2.rate}</td>` : ''}
    </tr>`;
  }).join('');

  const colsMenuId = `growth-cols-menu-${key}`;

  return `<div class="growth-sort-bar no-capture">
    <span class="sort-label">Sort by</span>
    <select class="sort-select" onchange="setGrowthSort('${key}', this.value)">
      <optgroup label="Follower Gain (this period)">
        <option value="gain-desc"${sortVal === 'gain-desc' ? ' selected' : ''}>Highest gain first</option>
        <option value="gain-asc"${sortVal === 'gain-asc' ? ' selected' : ''}>Lowest gain first</option>
      </optgroup>
      <optgroup label="Growth Rate %  (this period)">
        <option value="growth-desc"${sortVal === 'growth-desc' ? ' selected' : ''}>Highest rate first</option>
        <option value="growth-asc"${sortVal === 'growth-asc' ? ' selected' : ''}>Lowest rate first</option>
      </optgroup>
      <optgroup label="Total Gain (since before show)">
        <option value="totalgain-desc"${sortVal === 'totalgain-desc' ? ' selected' : ''}>Highest total gain first</option>
        <option value="totalgain-asc"${sortVal === 'totalgain-asc' ? ' selected' : ''}>Lowest total gain first</option>
      </optgroup>
      <optgroup label="Total Rate % (since before show)">
        <option value="total-desc"${sortVal === 'total-desc' ? ' selected' : ''}>Highest total rate first</option>
        <option value="total-asc"${sortVal === 'total-asc' ? ' selected' : ''}>Lowest total rate first</option>
      </optgroup>
      <optgroup label="Follower Count">
        <option value="followers-desc"${sortVal === 'followers-desc' ? ' selected' : ''}>Most followers first</option>
        <option value="followers-asc"${sortVal === 'followers-asc' ? ' selected' : ''}>Fewest followers first</option>
      </optgroup>
      <optgroup label="Other">
        <option value="name"${sortVal === 'name' ? ' selected' : ''}>Name, A to Z</option>
        <option value="custom"${sortVal === 'custom' ? ' selected' : ''}>Custom order (drag to arrange)</option>
      </optgroup>
    </select>
    ${sortVal === 'custom' ? '<span style="font-size:10px;color:var(--mut);margin-left:4px">Drag rows to reorder</span>' : ''}
    ${hasCustom ? `<button class="btn b-gh b-xs" onclick="resetGrowthOrder('${key}')">✕ Reset order</button>` : ''}
    ${isAdmin ? `
    <span style="width:1px;height:16px;background:var(--bdr2);margin:0 4px"></span>
    <span class="sort-label">Show</span>
    <button class="sort-pill${scope === 'active' ? ' active' : ''}" onclick="setGrowthScope('${key}','active')" title="Only active (non-eliminated) contestants">Active only</button>
    <button class="sort-pill${scope === 'all' ? ' active' : ''}" onclick="setGrowthScope('${key}','all')" title="Every contestant, including eliminated/hidden">All contestants</button>
    ` : ''}
    <span style="width:1px;height:16px;background:var(--bdr2);margin:0 4px"></span>
    ${isAdmin ? `<button class="btn b-gld b-xs live-refresh-btn" id="live-refresh-btn-${key}" onclick="refreshFollowersLive('${key}')" title="Fetch live Instagram follower counts for ${s?.label || key} right now">⟳ Refresh Followers</button>` : ''}
    <div class="growth-cols-wrap" style="position:relative">
      <button class="btn b-gh b-xs" onclick="toggleGrowthColsMenu(this)" title="Choose which columns to display">Columns</button>
      ${growthColumnsMenuHTML(colsMenuId)}
    </div>
  </div>
  <div class="gtbl-wrap" id="gtbl-inner-${key}">
    <div class="gtbl-title">${s?.label || key.toUpperCase()}: Instagram Follower Growth Analysis</div>
    <table>
      <thead><tr>
        <th style="min-width:200px">Contestant</th>
        ${show('handle') ? '<th>Insta Handle</th>' : ''}
        ${show('before') ? '<th>Before Show</th>' : ''}
        ${show('last') ? '<th>Last Checked</th>' : ''}
        ${show('current') ? '<th>Current ✓</th>' : ''}
        ${show('growthLast') ? '<th>Growth (Last→Now)</th>' : ''}
        ${show('growthRate') ? '<th>Growth Rate %</th>' : ''}
        ${show('totalGrowth') ? '<th>Total Growth</th>' : ''}
        ${show('totalRate') ? '<th>Total Rate %</th>' : ''}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

/* ─── GROWTH DRAG-REORDER ───────────────────────────────── */
let _dragSrc = null;

/* ─── ROSTER / CARD DRAG-REORDER ────────────────────────────
   Unlike the growth table (which keeps a separate display-only
   order), this reorders window.DB[key] itself — the change is
   real, persists, and is reflected in the # numbering and the
   exported data.js immediately. */
let _rosterDragSrc = null;

function rosterDragStart(e) {
  _rosterDragSrc = e.currentTarget;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', e.currentTarget.dataset.id);
  setTimeout(() => { if (_rosterDragSrc) _rosterDragSrc.style.opacity = '0.4'; }, 0);
}
function rosterDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}
function rosterDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function rosterDrop(e, key) {
  e.preventDefault();
  const target = e.currentTarget;
  target.classList.remove('drag-over');
  if (!_rosterDragSrc || _rosterDragSrc === target) {
    if (_rosterDragSrc) _rosterDragSrc.style.opacity = '';
    _rosterDragSrc = null;
    return;
  }

  const srcId = parseInt(_rosterDragSrc.dataset.id);
  const tgtId = parseInt(target.dataset.id);
  _rosterDragSrc.style.opacity = '';
  _rosterDragSrc = null;

  const arr = window.DB[key];
  if (!arr) return;
  const srcIdx = arr.findIndex(c => c.id === srcId);
  const tgtIdx = arr.findIndex(c => c.id === tgtId);
  if (srcIdx === -1 || tgtIdx === -1) return;

  const [moved] = arr.splice(srcIdx, 1);
  arr.splice(tgtIdx, 0, moved);

  renderTable(key);
  const cEl = document.getElementById('sw-' + key + '-cgrid');
  if (cEl) renderCards(key);
  renderRankings();
  if (typeof _autoPersist === 'function') _autoPersist();
  toast('✓ Reordered. Drag again or click ↓ Save JSON to publish');
}

function growthDragStart(e) {
  _dragSrc = e.currentTarget;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', e.currentTarget.dataset.id);
  setTimeout(() => { if (_dragSrc) _dragSrc.style.opacity = '0.4'; }, 0);
}
function growthDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}
function growthDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function growthDrop(e, key) {
  e.preventDefault();
  const target = e.currentTarget;
  target.classList.remove('drag-over');
  if (!_dragSrc || _dragSrc === target) {
    if (_dragSrc) _dragSrc.style.opacity = '';
    _dragSrc = null; return;
  }
  window._growthSort[key] = 'custom';
  const tbody = target.closest('tbody');
  const srcId = parseInt(_dragSrc.dataset.id);
  const tgtId = parseInt(target.dataset.id);
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const ids = rows.map(r => parseInt(r.dataset.id));
  const si = ids.indexOf(srcId), ti = ids.indexOf(tgtId);
  ids.splice(si, 1); ids.splice(ti, 0, srcId);
  window._growthOrder[key] = ids;
  _dragSrc.style.opacity = '';
  _dragSrc = null;
  renderGrowth(key);
  if (typeof _autoPersist === 'function') _autoPersist();
  toast('↕ Custom order saved');
}
function resetGrowthOrder(key) {
  delete window._growthOrder[key];
  window._growthSort[key] = 'growth-desc';
  renderGrowth(key);
  toast('✓ Reset to highest growth');
}
function saveGrowthCell(key, id, f, val) {
  const c = (window.DB[key] || []).find(x => x.id === id);
  if (c) {
    const isFoll = /^foll(Before|Last|Cur)$/.test(f);
    const oldVal = c[f];
    c[f] = isFoll ? normalizeFollowerInput(val) : sanitizeHTML(val.trim());
    // Editing the Last Checked or Current number directly in the growth
    // table is itself "checking" that number — stamp today's date on the
    // matching date field automatically, same as the main edit form does.
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    if (f === 'follLast' && c[f] !== oldVal) c.follLastDate = today;
    if (f === 'follCur'  && c[f] !== oldVal) c.follCurDate = today;
    renderGrowth(key);
    toast('✓ Updated: ' + f);
    if (typeof _autoPersist === 'function') _autoPersist();
  }
}

/* ─── SHIFT CURRENT → LAST CHECKED ──────────────────────── */
/**
 * For every visible contestant in a show:
 * - copies follCur → follLast
 * - copies follCurDate (or today) → follLastDate
 * - clears follCur and follCurDate so the admin can enter fresh values
 */
function shiftCurrentToLast(key) {
  const today = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  const data = (window.DB[key] || []).filter(c => !isH(key, c.id));
  let shifted = 0;
  data.forEach(c => {
    if (c.follCur && c.follCur !== 'N/V') {
      c.follLast = c.follCur;
      c.follLastDate = c.follCurDate || today;
      c.follCur = 'N/V';
      c.follCurDate = '';
      shifted++;
    }
  });
  renderGrowth(key);
  renderTable(key);
  if (typeof _autoPersist === 'function') _autoPersist();
  if (shifted > 0) {
    toast(`⟳ Rolled ${shifted} contestants. Enter new Current values now`);
    if (typeof logActivity === 'function') logActivity('Rolled Current → Last Checked', `${shifted} contestants in ${window.SHOWS[key]?.label || key}`, '⟳');
  } else {
    toast('No Current follower values to roll', 'warn');
  }
}

/* ─── RENDER GROWTH ─────────────────────────────────────── */
function renderGrowth(key) {
  const el = document.getElementById('sw-' + key + '-gtbl');
  if (el) el.innerHTML = buildGrowthHTML(key);
}
function renderGrowthAll() {
  const el = document.getElementById('ga-wrap');
  if (!el) return;
  el.innerHTML = getShowKeys()
    .filter(k => !isShowHidden(k))
    .map(k => `
    <div style="margin-bottom:28px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:7px">
        <div style="font-size:13px;font-weight:800;color:${window.SHOWS[k].color}">${window.SHOWS[k].label}</div>
        <div style="display:flex;gap:6px" class="no-capture">
          <button class="btn b-gld b-sm" onclick="capture('gtbl-inner-${k}','${k}_Growth')">Capture</button>
          <button class="btn b-gh b-sm" onclick="exportGrowthCSV('${k}')">↓ CSV</button>
        </div>
      </div>
      <div id="ggrow-${k}">${buildGrowthHTML(k)}</div>
    </div>`).join('');
}

/* ─── RANKINGS ──────────────────────────────────────────── */
function renderRankings() {
  const all = [];
  Object.keys(window.DB).forEach(k => {
    if (isShowHidden(k)) return;
    (window.DB[k] || []).filter(c => !isH(k, c.id)).forEach(c =>
      all.push({ ...c, _k: k, _sl: window.SHOWS[k]?.label, _sc: window.SHOWS[k]?.color })
    );
  });
  // Sort by follower count (primary) then name (secondary)
  all.sort((a, b) => {
    const fa = parseF(a.follCur) ?? 0;
    const fb = parseF(b.follCur) ?? 0;
    return fb !== fa ? fb - fa : a.name.localeCompare(b.name);
  });

  const tbody = document.getElementById('rank-tbody');
  if (!tbody) return;
  tbody.innerHTML = all.map((c, i) => {
    const rank = i < 3
      ? `<span class="rank-badge r${i + 1}">${i + 1}</span>`
      : `<span class="rank-badge rn">${i + 1}</span>`;
    const gender = (c.gender || '').toUpperCase().trim();
    return `<tr class="${rowCls(c.status)}"
      data-status="${(c.status || '').toLowerCase()}"
      data-show="${c._k}"
      data-gender="${gender}"
      data-name="${(c.name || '').toLowerCase()}">
      <td style="text-align:center">${rank}</td>
      <td>
        <div class="contestant-cell">
          ${contestantAvatar(c)}
          <div>
            <div class="tn">${sanitizeHTML(c.name)}</div>
            <div class="ts">${gender} · ${igLink(c.ig)}</div>
          </div>
        </div>
      </td>
      <td><span style="font-size:11px;font-weight:700;color:${c._sc}">${sanitizeHTML(c._sl || '')}</span></td>
      <td>${badge(c.status)}</td>
      <td><span class="tm" style="color:var(--blu)">${displayFollower(c.follCur)}</span></td>
      <td><span style="font-size:11px;color:var(--mut)">${sanitizeHTML(c.tier || c.profession || '')}</span></td>
      <td style="font-size:10px;color:var(--mut);max-width:200px">${sanitizeHTML(c.knownFor || '')}</td>
    </tr>`;
  }).join('');
  _populateRankFilters();
}

/* ─── RANKINGS FILTER ───────────────────────────────────── */
function _populateRankFilters() {
  const sel = document.getElementById('rank-show-filter');
  if (!sel) return;
  sel.innerHTML = '<option value="">All Shows</option>' +
    Object.keys(window.SHOWS || {})
      .filter(k => !isShowHidden(k))
      .map(k =>
        `<option value="${k}">${window.SHOWS[k].label}</option>`
      ).join('');
}

function filterRankings() {
  const status = (document.getElementById('rank-status-filter')?.value || '').toUpperCase().trim();
  const show = document.getElementById('rank-show-filter')?.value || '';
  const gender = (document.getElementById('rank-gender-filter')?.value || '').toUpperCase().trim();
  const q = (document.getElementById('rank-search')?.value || '').toLowerCase().trim();

  let visible = 0;
  document.querySelectorAll('#rank-tbody tr').forEach(tr => {
    const tStatus = (tr.dataset.status || '').toUpperCase();
    const tGender = (tr.dataset.gender || '').toUpperCase().trim();
    const tName = (tr.dataset.name || '').toLowerCase();
    const tShow = tr.dataset.show || '';

    const ok = (!status || tStatus.includes(status))
            && (!show || tShow === show)
            && (!gender || tGender === gender)
            && (!q || tName.includes(q));
    tr.style.display = ok ? '' : 'none';
    if (ok) visible++;
  });
}

function resetRankFilters() {
  const ids = ['rank-status-filter','rank-show-filter','rank-gender-filter'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const s = document.getElementById('rank-search'); if (s) s.value = '';
  filterRankings();
}

/* ─── HIDE/SHOW HELPERS ─────────────────────────────────── */
function showAll() {
  HIDDEN.clear();
  renderAll(); updateStats();
  if (typeof renderHideMgr === 'function') renderHideMgr();
  toast('✓ All contestants visible');
  if (typeof _autoPersist === 'function') _autoPersist();
}
function showAllInShow(key) {
  [...HIDDEN].filter(h => h.startsWith(key + '::')).forEach(h => HIDDEN.delete(h));
  renderAll(); updateStats();
  toast('✓ All restored for ' + (window.SHOWS[key]?.label || key));
  if (typeof _autoPersist === 'function') _autoPersist();
}
function hideRumoured() {
  Object.keys(window.DB).forEach(k =>
    (window.DB[k] || []).filter(c => (c.status || '').toUpperCase().includes('RUMOUR'))
      .forEach(c => HIDDEN.add(k + '::' + c.id))
  );
  renderAll(); updateStats();
  toast('Rumoured contestants hidden', 'warn');
  if (typeof _autoPersist === 'function') _autoPersist();
}
function hideAllVisible() {
  Object.keys(window.DB).forEach(k =>
    (window.DB[k] || []).forEach(c => HIDDEN.add(k + '::' + c.id))
  );
  renderAll(); updateStats();
  toast('All hidden', 'warn');
  if (typeof _autoPersist === 'function') _autoPersist();
}

/* ─── HIDE MANAGER MODAL ────────────────────────────────── */
function openHideMgr(key) {
  document.getElementById('modal-hide').classList.add('open');
  const sel = document.getElementById('hm-show-filter');
  if (sel) {
    sel.innerHTML = '<option value="">All Shows</option>' +
      getShowKeys().map(k => `<option value="${k}" ${k === key ? 'selected' : ''}>${window.SHOWS[k].label}</option>`).join('');
  }
  renderHideMgr();
}
function renderHideMgr() {
  const grid = document.getElementById('hm-grid');
  if (!grid) return;
  const filterKey = document.getElementById('hm-show-filter')?.value || '';
  const q = (document.getElementById('hm-search')?.value || '').toLowerCase();
  const keys = filterKey ? [filterKey] : getShowKeys();
  let all = [];
  keys.forEach(k => (window.DB[k] || []).forEach(c => all.push({ ...c, _k: k })));
  if (q) all = all.filter(c => c.name.toLowerCase().includes(q));
  const hiddenCount = all.filter(c => isH(c._k, c.id)).length;
  setText('hm-count', hiddenCount);
  grid.innerHTML = all.map(c => {
    const vis = !isH(c._k, c.id);
    const eliminated = (c.status || '').toUpperCase().trim() === 'ELIMINATED';
    return `<div class="hm-item ${vis ? 'hm-vis' : 'hm-hid'}" onclick="toggleH('${c._k}',${c.id});renderHideMgr()">
      <div class="hm-chk">${vis ? '✓' : ''}</div>
      <div>
        <div class="hm-name">${sanitizeHTML(c.name)}</div>
        <div class="hm-show">${sanitizeHTML(window.SHOWS[c._k]?.label || c._k)}${!vis && eliminated ? ' · <span style="color:var(--mut)">eliminated</span>' : ''}</div>
      </div>
    </div>`;
  }).join('');
}

/* ─── SHOW MANAGER ──────────────────────────────────────── */
function openShowMgr() {
  showEditKey = null;
  resetShowForm();
  document.getElementById('modal-shows').classList.add('open');
  renderShowList();
  checkDbStatus();
}

/** Shows whether the live database is connected and migrated, or still
 * running off the bundled fallback (meaning /api/data is either
 * unconfigured or hasn't been seeded yet via migrateToDatabase()). */
async function checkDbStatus() {
  const el = document.getElementById('db-status');
  if (!el) return;
  el.textContent = 'Checking…';
  try {
    const res = await fetch('/api/data', { cache: 'no-cache' });
    const source = res.headers.get('X-Data-Source');
    const connection = res.headers.get('X-Db-Connection');
    const dbError = res.headers.get('X-Db-Error');
    const connLabel = { 'redis-url': 'Redis (TCP)', 'rest': 'REST-based store', 'none': 'not detected' }[connection] || connection;

    if (res.ok && source === 'database') {
      el.innerHTML = `<span style="color:var(--grn)">✓ Connected via ${sanitizeHTML(connLabel)}. Live data is being served from the database.</span>`;
    } else if (res.ok && source === 'bundled-fallback' && connection === 'none') {
      el.innerHTML = '<span style="color:var(--gld)">No database connection detected at all. Currently serving the bundled backup file. Connect a database in Vercel Storage, then redeploy.</span>';
    } else if (res.ok && source === 'bundled-fallback') {
      el.innerHTML = `<span style="color:var(--gld)">${sanitizeHTML(connLabel)} detected but the read failed${dbError ? ': ' + sanitizeHTML(dbError) : ''}. Currently serving the bundled backup file.</span>`;
    } else if (res.status === 503) {
      const data = await res.json().catch(() => ({}));
      el.innerHTML = `<span style="color:var(--red)">✕ No data source reachable. Connection: ${sanitizeHTML(data.connectionDetected || 'unknown')}${data.databaseIssue ? ', error: ' + sanitizeHTML(data.databaseIssue) : ''}</span>`;
    } else {
      el.innerHTML = '<span style="color:var(--mut)">Could not determine status (HTTP ' + res.status + ')</span>';
    }
  } catch (err) {
    el.innerHTML = '<span style="color:var(--red)">✕ /api/data is unreachable: ' + sanitizeHTML(err.message) + '</span>';
  }
}

/** One-time migration — POSTs whatever's currently loaded (the
 * bundled data.js, or your live in-progress edits) into the database
 * as its first canonical copy. Safe to click again later too — it's
 * just "publish now," same as the button in the Export panel. */
async function migrateToDatabase() {
  await publishLive();
  checkDbStatus();
}

function openShowEdit(key) {
  showEditKey = key;
  const s = window.SHOWS[key];
  if (!s) return;
  document.getElementById('show-edit-title').textContent = 'Edit Show: ' + s.label;
  document.getElementById('ns-name').value = s.label || '';
  document.getElementById('ns-key').value = key;
  document.getElementById('ns-key').disabled = true;
  document.getElementById('ns-platform').value = s.platform || '';
  document.getElementById('ns-host').value = s.host || '';
  document.getElementById('ns-desc').value = s.desc || '';
  document.getElementById('ns-color').value = s.color || '#4A9EFF';
  document.getElementById('ns-banner').value = s.bannerUrl || '';
  if (s.releaseDate) document.getElementById('ns-date').value = s.releaseDate;
  document.getElementById('ns-add-btn').textContent = '✓ Update Show';
  document.getElementById('modal-shows').classList.add('open');
}
function resetShowForm() {
  document.getElementById('show-edit-title').textContent = 'Manage Shows';
  ['ns-name','ns-key','ns-host','ns-date','ns-desc','ns-platform','ns-banner'].forEach(id => {
    const e = document.getElementById(id); if (e) { e.value = ''; e.disabled = false; }
  });
  document.getElementById('ns-color').value = '#4A9EFF';
  document.getElementById('ns-add-btn').textContent = '+ Create Show';
}
function renderShowList() {
  const el = document.getElementById('show-list');
  if (!el) return;
  el.innerHTML = getShowKeys().map(k => {
    const s = window.SHOWS[k];
    const hidden = isShowHidden(k);
    return `<div class="show-item${hidden ? ' show-item-hidden' : ''}">
      <span class="show-dot" style="background:${s.color};${hidden ? 'opacity:.4' : ''}"></span>
      <div style="flex:1;${hidden ? 'opacity:.5' : ''}">
        <div class="show-name">${sanitizeHTML(s.label)}</div>
        <div class="show-meta-sm">${sanitizeHTML(s.platform || '')} · ${showDateLabel(s)} · ${(window.DB[k] || []).length} contestants${hidden ? ' · <span style="color:var(--warn)">hidden from public</span>' : ''}</div>
      </div>
      <button class="btn ${hidden ? 'b-grn' : 'b-warn'} b-xs" onclick="toggleShowHidden('${k}')" title="${hidden ? 'Publish: make visible to public' : 'Hide from public view'}">
        ${hidden ? '✓ Publish' : 'Hide'}
      </button>
      <button class="btn b-gh b-xs" onclick="openShowEdit('${k}')">Edit</button>
      ${getShowKeys().length > 1 ? `<button class="btn b-red b-xs" onclick="removeShow('${k}')">Delete</button>` : ''}
    </div>`;
  }).join('');
}
function addShow() {
  const name = document.getElementById('ns-name').value.trim();
  const key = showEditKey || document.getElementById('ns-key').value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!name || !key) { toast('Name and key required', 'err'); return; }
  if (!showEditKey && window.SHOWS[key]) { toast('Key already exists', 'err'); return; }
  const payload = {
    label: sanitizeHTML(name), key,
    color: document.getElementById('ns-color').value,
    platform: sanitizeHTML(document.getElementById('ns-platform').value),
    host: sanitizeHTML(document.getElementById('ns-host').value || 'TBC'),
    releaseDate: document.getElementById('ns-date').value || '',
    date: formatReleaseDate(document.getElementById('ns-date').value) || document.getElementById('ns-date').value || 'TBC',
    desc: sanitizeHTML(document.getElementById('ns-desc').value || ''),
    bannerUrl: document.getElementById('ns-banner').value.trim() || '',
  };
  const errs = validateShow({ ...payload, key });
  if (errs.length) { toast(errs[0], 'err'); return; }
  const editing = !!showEditKey;
  if (editing) {
    window.SHOWS[key] = { ...payload, key };
    if (!window.DB[key]) window.DB[key] = window.DB[showEditKey] || [];
    if (showEditKey !== key) { delete window.SHOWS[showEditKey]; delete window.DB[showEditKey]; }
    showEditKey = null;
  } else {
    window.SHOWS[key] = { ...payload, key };
    window.DB[key] = [];
  }
  refreshShowUIs();
  closeModal('modal-shows');
  toast((editing ? '✓ Updated: ' : '✓ Created: ') + name);
  if (typeof logActivity === 'function') logActivity(editing ? 'Updated show' : 'Created show', name, editing ? '' : '');
  if (typeof _autoPersist === 'function') _autoPersist();
}
async function removeShow(key) {
  const lbl = window.SHOWS[key]?.label || key;
  if (!await appConfirm('Remove "' + lbl + '"? All data lost.', { title: 'Remove show' })) return;
  delete window.SHOWS[key]; delete window.DB[key];
  const p = document.getElementById('panel-show-' + key); if (p) p.remove();
  rebuildSidebar(); renderOverview(); updateStats(); renderShowList();
  showPanel('overview');
  toast('Show removed', 'warn');
  if (typeof _autoPersist === 'function') _autoPersist();
}

/* ─── CONTESTANT MODAL ──────────────────────────────────── */
function populateShowSel() {
  const sel = document.getElementById('f-show');
  if (!sel) return;
  sel.innerHTML = getShowKeys().map(k => `<option value="${k}">${window.SHOWS[k].label}</option>`).join('');
}
function openAdd(dk) {
  editTarget = null;
  populateShowSel();
  document.getElementById('mc-title').textContent = 'Add Contestant';
  if (dk) document.getElementById('f-show').value = dk;
  ['name','ig','photo','fb','fbd','fl','fld','fc','fcd','tier','kf','his'].forEach(id => {
    const e = document.getElementById('f-' + id); if (e) e.value = '';
  });
  document.getElementById('f-status').value = 'CONFIRMED';
  document.getElementById('modal-c').classList.add('open');
}
function openEdit(key, id) {
  const c = (window.DB[key] || []).find(x => x.id === id);
  if (!c) return;
  editTarget = { key, id };
  populateShowSel();
  document.getElementById('mc-title').textContent = 'Edit: ' + c.name;
  const map = {
    name:'name', gender:'gender', status:'status', profession:'profession', tier:'tier', ig:'ig', photo:'photo',
    fb:'follBefore', fbd:'follBeforeDate', fl:'follLast', fld:'follLastDate', fc:'follCur', fcd:'follCurDate',
    kf:'knownFor', his:'history'
  };
  document.getElementById('f-show').value = key;
  Object.entries(map).forEach(([fi, cf]) => {
    const e = document.getElementById('f-' + fi); if (e) e.value = c[cf] || '';
  });
  document.getElementById('modal-c').classList.add('open');
}
function saveContestant() {
  const key = document.getElementById('f-show').value;
  const name = document.getElementById('f-name').value.trim();
  if (!name) { toast('Name required', 'err'); return; }
  if (!window.DB[key]) window.DB[key] = [];
  const obj = {
    name: sanitizeHTML(name),
    gender: document.getElementById('f-gender').value,
    status: document.getElementById('f-status').value,
    profession: sanitizeHTML(document.getElementById('f-profession').value),
    tier: sanitizeHTML(document.getElementById('f-tier').value),
    ig: sanitizeHTML(document.getElementById('f-ig').value),
    photo: document.getElementById('f-photo').value.trim(),
    follBefore: normalizeFollowerInput(document.getElementById('f-fb').value),
    follBeforeDate: sanitizeHTML(document.getElementById('f-fbd').value),
    follLast: normalizeFollowerInput(document.getElementById('f-fl').value),
    follLastDate: sanitizeHTML(document.getElementById('f-fld').value),
    follCur: normalizeFollowerInput(document.getElementById('f-fc').value),
    follCurDate: sanitizeHTML(document.getElementById('f-fcd').value),
    knownFor: sanitizeHTML(document.getElementById('f-kf').value),
    history: sanitizeHTML(document.getElementById('f-his').value),
  };
  const errors = validateContestant(obj);
  if (errors.length) { toast(errors[0], 'err'); return; }
  const wasEdit = !!editTarget;
  const previous = wasEdit ? (window.DB[key] || []).find(c => c.id === editTarget.id) : null;
  const previousStatus = (previous?.status || '').toUpperCase().trim();
  const newStatus = (obj.status || '').toUpperCase().trim();

  // Auto-stamp Last Checked / Current Checked with today's date the moment
  // the follower number actually changes, so the admin never has to
  // remember to update the date by hand. If they typed a date of their own
  // (different from what was already saved) that choice is respected
  // instead of being overwritten.
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  if (obj.follLast !== (previous?.follLast || '') && obj.follLastDate === (previous?.follLastDate || '')) {
    obj.follLastDate = today;
  }
  if (obj.follCur !== (previous?.follCur || '') && obj.follCurDate === (previous?.follCurDate || '')) {
    obj.follCurDate = today;
  }
  if (!wasEdit) {
    if (obj.follLast && obj.follLast !== 'N/V' && !obj.follLastDate) obj.follLastDate = today;
    if (obj.follCur && obj.follCur !== 'N/V' && !obj.follCurDate) obj.follCurDate = today;
  }

  if (editTarget && editTarget.key === key) {
    const idx = (window.DB[key] || []).findIndex(c => c.id === editTarget.id);
    if (idx > -1) {
      obj.id = editTarget.id;
      // Preserve fields the edit form doesn't expose (bio, in
      // particular) — this used to silently wipe a contestant's whole
      // profile every time an admin edited any other field, since obj
      // is a fresh literal that never included bio at all.
      const existing = window.DB[key][idx];
      if (existing?.bio) obj.bio = existing.bio;
      window.DB[key][idx] = obj;
    }
  } else {
    const ids = (window.DB[key] || []).map(c => c.id);
    obj.id = ids.length ? Math.max(...ids) + 1 : 1;
    window.DB[key].push(obj);
  }

  // Auto-hide on the ELIMINATED transition only — i.e. either a brand
  // new contestant added as already-eliminated, or an existing one just
  // switched from a non-eliminated status to ELIMINATED. This fires
  // exactly once per elimination event; it never re-hides someone the
  // admin has since manually restored, because on later saves
  // previousStatus is already ELIMINATED and the condition won't match
  // again. This is what makes them drop out of the Growth table and
  // get skipped by the live follower refresh (both key off HIDDEN).
  if (newStatus === 'ELIMINATED' && previousStatus !== 'ELIMINATED') {
    HIDDEN.add(key + '::' + obj.id);
  }

  closeModal('modal-c');
  renderAll(); rebuildSidebar(); updateStats();
  const autoHidden = newStatus === 'ELIMINATED' && previousStatus !== 'ELIMINATED';
  toast(
    (wasEdit ? '✓ Updated' : '✓ Added to ' + (window.SHOWS[key]?.label || key)) +
    (autoHidden ? ', auto-hidden from Growth (eliminated). Unhide in Visibility if needed.' : '')
  );
  if (typeof logActivity === 'function') {
    logActivity(wasEdit ? 'Edited contestant' : 'Added contestant', obj.name + ' · ' + (window.SHOWS[key]?.label || key), wasEdit ? '' : '');
    if (autoHidden) logActivity('Auto-hidden (eliminated)', obj.name + ' · ' + (window.SHOWS[key]?.label || key), '');
  }
  if (typeof _autoPersist === 'function') _autoPersist();
}
async function delRow(key, id) {
  if (!await appConfirm('Delete this contestant? This cannot be undone.', { title: 'Delete contestant' })) return;
  const c = (window.DB[key] || []).find(x => x.id === id);
  window.DB[key] = (window.DB[key] || []).filter(c => c.id !== id);
  HIDDEN.delete(key + '::' + id);
  renderAll(); rebuildSidebar(); updateStats();
  toast('Removed', 'warn');
  if (typeof logActivity === 'function') logActivity('Removed contestant', (c?.name || '?') + ' · ' + (window.SHOWS[key]?.label || key), '');
  if (typeof _autoPersist === 'function') _autoPersist();
}

/* ─── COPY CONTESTANT TO ANOTHER SHOW ───────────────────────
   Duplicates a contestant's full record (photo, bio, followers,
   socials — everything) into a different show as a brand-new,
   independent entry. The original record is never touched — this
   is a copy, not a move, since the same person can legitimately be
   a real contestant on two different shows at once. */
function openCopyToShow(key, id) {
  const c = (window.DB[key] || []).find(x => x.id === id);
  if (!c) return;
  _copySource = { key, id };

  document.getElementById('copy-show-name').textContent = c.name;

  const otherShows = getShowKeys().filter(k => k !== key);
  const list = document.getElementById('copy-show-list');
  if (!otherShows.length) {
    list.innerHTML = '<div style="color:var(--mut);font-size:12px;text-align:center;padding:20px 0">No other shows exist yet. Add one via Shows first.</div>';
  } else {
    list.innerHTML = otherShows.map(k => `
      <button class="btn b-gh" style="justify-content:flex-start;width:100%"
        onclick="confirmCopyToShow('${k}')">
        ${sanitizeHTML(window.SHOWS[k]?.label || k)}
        <span style="margin-left:auto;color:var(--mut);font-size:11px">${(window.DB[k] || []).length} contestants</span>
      </button>`).join('');
  }

  document.getElementById('modal-copy-show').classList.add('open');
}

function confirmCopyToShow(targetKey) {
  if (!_copySource) return;
  const { key: sourceKey, id } = _copySource;
  const original = (window.DB[sourceKey] || []).find(x => x.id === id);
  if (!original) { toast('Original contestant not found', 'err'); return; }
  if (!window.DB[targetKey]) window.DB[targetKey] = [];

  // Deep clone so the two entries are fully independent from this
  // point on — editing the copy (or the original) later never
  // affects the other one.
  const copy = JSON.parse(JSON.stringify(original));
  const existingIds = window.DB[targetKey].map(c => c.id);
  copy.id = existingIds.length ? Math.max(...existingIds) + 1 : 1;

  window.DB[targetKey].push(copy);
  closeModal('modal-copy-show');
  _copySource = null;

  renderAll(); rebuildSidebar(); updateStats();
  toast(`✓ Copied "${copy.name}" to ${window.SHOWS[targetKey]?.label || targetKey}. Original untouched`);
  if (typeof logActivity === 'function') logActivity('Copied contestant', `${copy.name} · ${window.SHOWS[sourceKey]?.label || sourceKey} → ${window.SHOWS[targetKey]?.label || targetKey}`, '');
  if (typeof _autoPersist === 'function') _autoPersist();
}

/* ─── MODAL HELPERS ─────────────────────────────────────── */
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  editTarget = null;
  if (id === 'modal-shows') resetShowForm();
}

/* ─── CONTESTANT BIO MODAL ──────────────────────────────── */
function openBio(key, id) {
  const c = (window.DB[key] || []).find(x => x.id === id);
  if (!c || !c.bio) return;

  const col = window.SHOWS[key]?.color || '#8B5CF6';
  const photo = String(c.photo || '').trim();

  const photoWrap = document.getElementById('bio-photo-wrap');
  photoWrap.style.borderColor = col;
  photoWrap.innerHTML = photo
    ? `<img src="${photo.replace(/"/g, '&quot;')}" alt="${sanitizeHTML(c.name)}"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
       <div class="bio-photo-fallback" style="display:none;background:linear-gradient(150deg,${col}30,${col}60)">${contestantInitials(c.name)}</div>`
    : `<div class="bio-photo-fallback" style="background:linear-gradient(150deg,${col}30,${col}60)">${contestantInitials(c.name)}</div>`;

  document.getElementById('bio-name').textContent = c.name;
  document.getElementById('bio-meta').innerHTML =
    `${sanitizeHTML(c.profession || '')}${c.gender ? ' · ' + sanitizeHTML(c.gender) : ''}
     <span class="bio-show-tag" style="color:${col};border-color:${col}55">${sanitizeHTML(window.SHOWS[key]?.label || key)}</span>`;

  const body = document.getElementById('bio-body');
  body.innerHTML = c.bio.map(sec => `
    <div class="bio-section">
      <div class="bio-section-heading">${sanitizeHTML(sec.heading)}</div>
      <div class="bio-section-content">${sanitizeBioHTML(sec.html)}</div>
    </div>
  `).join('');
  body.scrollTop = 0;

  document.getElementById('modal-bio').classList.add('open');
}

/* ─── RENDER ALL ────────────────────────────────────────── */
function renderAll() {
  getShowKeys().forEach(k => {
    renderTable(k);
    const cEl = document.getElementById('sw-' + k + '-cgrid');
    if (cEl && cEl.closest('.tab-pane.active')) renderCards(k);
    const gEl = document.getElementById('sw-' + k + '-gtbl');
    if (gEl && gEl.closest('.tab-pane.active')) renderGrowth(k);
  });
  renderOverview();
}
function refreshShowUIs() {
  // Rebuilding the per-show panels below throws away the current DOM
  // nodes entirely, including whichever one carried the .active class
  // that makes .panel { display:block }. Without capturing and
  // re-applying it, every panel ends up display:none and the content
  // area goes fully blank until the user manually clicks a sidebar
  // item — this was the "blank screen after any change" bug.
  const activeId = document.querySelector('.panel.active')?.id;
  rebuildDynamicPanels();
  rebuildSidebar();
  populateShowSel();
  renderOverview();
  renderAll();
  if (typeof renderShowList === 'function') renderShowList();
  if (typeof rebuildExportPanel === 'function') rebuildExportPanel();
  updateStats();
  const restoreId = activeId && document.getElementById(activeId) ? activeId : 'panel-overview';
  showPanel(restoreId.replace(/^panel-/, ''));
}
function rebuildDynamicPanels() {
  const host = document.getElementById('dynamic-panels');
  if (!host) return;
  host.innerHTML = '';
  getShowKeys().forEach(buildShowPanel);
}

/* ─── DEBOUNCED SEARCH ──────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  document.body.addEventListener('input', e => {
    const inp = e.target;
    if (inp.classList.contains('roster-search')) {
      filterTable(inp.dataset.searchKey);
    }
  });
  document.querySelectorAll('.mbg').forEach(m =>
    m.addEventListener('click', function (e) { if (e.target === this) closeModal(this.id); })
  );
});

/* ─── KEYBOARD SHORTCUTS ────────────────────────────────── */
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveToLocalStorage(true); }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') { e.preventDefault(); exportJSON(); }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') { e.preventDefault(); window.print(); }
  if (e.key === 'Escape') {
    document.querySelectorAll('.mbg.open').forEach(m => m.classList.remove('open'));
    if (typeof closeCaptureModal === 'function') closeCaptureModal();
  }
});

/* ─── MOBILE NAV DRAWER ─────────────────────────────────── */
function buildMobileNav() {
  const el = document.getElementById('mobile-nav-links');
  if (!el) return;
  const items = [
    { panel: 'overview', label: 'Overview' },
    { panel: 'rankings', label: 'Rankings' },
    { panel: 'growth-all', label: 'All Growth' },
    { panel: 'export', label: '↓ Export', adminOnly: true },
    { panel: 'help', label: 'Help', adminOnly: true },
  ];
  const showItems = getShowKeys().map(k => ({
    panel: 'show-' + k,
    label: window.SHOWS[k].label,
    color: window.SHOWS[k].color,
  }));

  const isAdmin = document.body.classList.contains('admin-active');
  const activeEl = document.querySelector('.sb-item.active');
  const activePanel = activeEl ? activeEl.dataset.panel : 'overview';

  el.innerHTML = '<div class="sb-sec">Navigate</div>' +
    items
      .filter(i => !i.adminOnly || isAdmin)
      .map(i => `<div class="sb-item${activePanel === i.panel ? ' active' : ''}"
        data-panel="${i.panel}"
        onclick="showPanel('${i.panel}');closeMobileNav()">${i.label}</div>`
      ).join('') +
    '<div class="sb-sec" style="margin-top:4px">Shows</div>' +
    showItems.map(i => `<div class="sb-item${activePanel === i.panel ? ' active' : ''}"
      data-panel="${i.panel}"
      onclick="showPanel('${i.panel}');closeMobileNav()">
      <span class="sb-dot" style="background:${i.color || 'var(--acc)'}"></span>${i.label}
    </div>`).join('');
}

function toggleMobileNav() {
  buildMobileNav();
  document.getElementById('mobile-nav-drawer').classList.toggle('open');
  document.getElementById('mobile-nav-overlay').classList.toggle('open');
}
function closeMobileNav() {
  document.getElementById('mobile-nav-drawer').classList.remove('open');
  document.getElementById('mobile-nav-overlay').classList.remove('open');
}

// Rebuild mobile nav when admin state changes
const _origActivateAdmin = window.activateAdmin;
document.addEventListener('DOMContentLoaded', () => {
  // Show mobile nav btn on small screens
  function checkMobileBtn() {
    const btn = document.getElementById('mobile-nav-btn');
    if (btn) btn.style.display = window.innerWidth <= 640 ? 'inline-flex' : 'none';
  }
  checkMobileBtn();
  window.addEventListener('resize', checkMobileBtn);
});
