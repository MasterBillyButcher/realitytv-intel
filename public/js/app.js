/* ═══════════════════════════════════════════════════════════
   app.js  —  Reality TV Intel 2026
   Rendering · Navigation · CRUD · Sort · Growth logic.
═══════════════════════════════════════════════════════════ */

/* ─── STATE ─────────────────────────────────────────────── */
let HIDDEN       = new Set();
let HIDDEN_SHOWS = new Set();   // show keys hidden from public view
let editMode     = false;
let editTarget   = null;
let _copySource  = null; // { key, id } — contestant pending a copy-to-show action
let showEditKey  = null;

window._growthOrder = window._growthOrder || {};
window._growthSort  = window._growthSort  || {};

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
    ? `👁 "${window.SHOWS[key]?.label}" hidden from public`
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
    btn.innerHTML = next === 'light' ? '☀ Light Mode' : '☾ Dark Mode';
    btn.title     = next === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
  }
  if (persist) {
    localStorage.setItem(THEME_KEY, next);
    if (typeof _autoPersist === 'function') _autoPersist();
  }
}
function toggleTheme() {
  const next = getCurrentTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  toast(next === 'light' ? '☀ Light mode' : '☾ Dark mode');
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
  if (u.includes('ELIMINATED'))                        return '<span class="bdg be">✗ ELIMINATED</span>';
  if (u.includes('WILDCARD'))                          return '<span class="bdg bwc">★ WILDCARD</span>';
  if (u.includes('CONFIRMED'))                         return '<span class="bdg bc">✓ CONFIRMED</span>';
  if (u.includes('RUMOURED') || u.includes('RUMORED')) return '<span class="bdg br">~ RUMOURED</span>';
  if (u.includes('APPROACHED'))                        return '<span class="bdg ba">→ APPROACHED</span>';
  return `<span class="bdg bw">${sanitizeHTML(s || '')}</span>`;
}
function rowCls(s) {
  const u = (s || '').toUpperCase();
  if (u.includes('ELIMINATED'))                        return 're';
  if (u.includes('WILDCARD'))                          return 'rwc';
  if (u.includes('CONFIRMED'))                         return 'rc';
  if (u.includes('RUMOURED') || u.includes('RUMORED')) return 'rr';
  if (u.includes('APPROACHED'))                        return 'ra';
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

/* ─── PANEL NAVIGATION ──────────────────────────────────── */
function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const p = document.getElementById('panel-' + id);
  if (p) p.classList.add('active');
  document.querySelectorAll('.sb-item').forEach(s => s.classList.toggle('active', s.dataset.panel === id));
  if (id === 'overview')   renderOverview();
  if (id === 'rankings')   renderRankings();
  if (id === 'growth-all') renderGrowthAll();
  if (id === 'export')     rebuildExportPanel();
}

/* ─── EDIT MODE ─────────────────────────────────────────── */
function toggleEdit() {
  editMode = !editMode;
  const btn = document.getElementById('editBtn');
  btn.textContent       = '✎ Edit Mode: ' + (editMode ? 'ON' : 'OFF');
  btn.style.color       = editMode ? 'var(--acc)' : '';
  btn.style.borderColor = editMode ? 'var(--acc)' : '';
  document.body.classList.toggle('edit-on', editMode);
  renderAll();
  toast(editMode ? '✎ Edit Mode ON — click any field to edit' : '✓ Edit Mode OFF');
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
        <div class="ph-title show-title" style="color:${s.color}">${s.emoji || '◆'} ${s.label}</div>
        <div class="ph-desc">${s.platform || 'TBC'} &middot; ${showDateLabel(s)} &middot; Host: ${s.host || 'TBC'} &middot; ${s.desc || ''}</div>
      </div>
      <div class="ph-act no-capture">
        <button class="btn b-gld b-sm" onclick="capture('sw-${key}-main','${key}')">📷 Capture All</button>
        <button class="btn b-gh b-sm"  onclick="exportCSV('${key}')">↓ CSV</button>
        <button class="btn b-acc b-sm admin-only" onclick="openAdd('${key}')">+ Add</button>
        <button class="btn b-gh b-sm admin-only"  onclick="openShowEdit('${key}')">✎ Edit Show</button>
      </div>
    </div>
    ${s.bannerUrl ? `<div class="show-banner no-capture"><img src="${s.bannerUrl.replace(/"/g,'&quot;')}" alt="${sanitizeHTML(s.label)} banner" onerror="this.parentElement.style.display='none'"></div>` : ''}
    <div id="sw-${key}-main">
      <div class="tab-bar no-capture">
        <button class="tab-btn active" onclick="switchTab('${key}','roster')">Roster</button>
        <button class="tab-btn"        onclick="switchTab('${key}','cards')">Card View</button>
        <button class="tab-btn"        onclick="switchTab('${key}','growth')">📈 Growth</button>
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
            <button class="btn b-pur b-sm" onclick="openHideMgr('${key}')">👁 Show/Hide</button>
            <button class="btn b-gld b-sm" onclick="capture('sw-${key}-tbl','${key}_Table')">📷 Capture</button>
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
          <div style="font-size:14px;font-weight:800">📈 Instagram Growth — ${s.label}</div>
          <div class="ph-act no-capture">
            <button class="shift-to-last-btn admin-only" onclick="shiftCurrentToLast('${key}')" title="Roll Current → Last Checked and set today's date on Last Checked field">⟳ Roll Current → Last Checked</button>
            <button class="btn b-gld b-sm" onclick="capture('gtbl-inner-${key}','${key}_Growth')">📷 Capture</button>
            <button class="btn b-gh b-sm"  onclick="exportGrowthCSV('${key}')">↓ CSV</button>
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
  if (tab === 'cards')  renderCards(key);
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
      const s    = window.SHOWS[k];
      const rows = window.DB[k] || [];
      const vis  = rows.filter(c => !isH(k, c.id));
      const conf = vis.filter(c => (c.status || '').toUpperCase().includes('CONFIRMED')).length;
      const rum  = vis.filter(c => (c.status || '').toUpperCase().includes('RUMOUR')).length;
      const hiddenShow = isShowHidden(k);
      return `<div class="ccard${hiddenShow ? ' show-card-hidden' : ''}" onclick="showPanel('show-${k}')" style="cursor:pointer">
        <div class="ccard-photo-wrap" style="aspect-ratio:2/1;border-top:3px solid ${s.color};background:linear-gradient(135deg,${s.color}22,${s.color}44);flex-direction:column;gap:6px">
          <div style="font-size:32px">${s.emoji || '📺'}</div>
          <div style="font-size:11px;font-weight:800;color:rgba(255,255,255,.75);letter-spacing:.06em;text-align:center;padding:0 8px">${s.label}</div>
          ${hiddenShow ? `<div style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,.7);color:var(--mut);font-size:9px;font-weight:700;padding:2px 7px;border-radius:999px;letter-spacing:.06em">HIDDEN</div>` : ''}
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
            ${isAdmin ? `<button class="btn ${hiddenShow ? 'b-grn' : 'b-warn'} b-sm no-capture" onclick="event.stopPropagation();toggleShowHidden('${k}')" title="${hiddenShow ? 'Publish show' : 'Hide show from public'}">${hiddenShow ? '✓ Publish' : '👁 Hide'}</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
}

/* ─── STATS BAR ─────────────────────────────────────────── */
function updateStats() {
  const isAdmin    = document.body.classList.contains('admin-active');
  /* "Shows" = published/active seasons only. Hidden shows never count
     here, even for admin — this stat represents what's actually live,
     not what exists in the database. Manage hidden shows via the
     sidebar or Overview cards, which do surface them to admin. */
  const publicKeys = getShowKeys().filter(k => !isShowHidden(k));
  const visKeys    = getShowKeys().filter(k => isAdmin || !isShowHidden(k));
  const allC       = visKeys.flatMap(k => (window.DB[k] || []).map(c => ({ ...c, _k: k })));
  setText('st-shows', publicKeys.length);
  setText('st-total', allC.length);
  setText('st-conf',  allC.filter(c => (c.status || '').toUpperCase().includes('CONFIRMED')).length);
  setText('st-rum',   allC.filter(c => (c.status || '').toUpperCase().includes('RUMOUR')).length);
  setText('st-hid',   HIDDEN.size);
}
function setText(id, val) { const e = document.getElementById(id); if (e) e.textContent = val; }

/* ─── TABLE RENDER ──────────────────────────────────────── */
function renderTable(key) {
  const tbody = document.getElementById('tb-' + key);
  if (!tbody || !window.DB[key]) return;
  const hidden  = [];
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
          <button class="hide-btn${hid ? ' is-hid' : ''}" onclick="toggleH('${key}',${c.id})" title="${hid ? 'Show' : 'Hide'}">👁</button>
          <button class="btn b-gh b-xs admin-only" onclick="openEdit('${key}',${c.id})">✎</button>
          <button class="btn b-gh b-xs admin-only" onclick="openCopyToShow('${key}',${c.id})" title="Copy to another show">📋</button>
          <button class="btn b-red b-xs admin-only" onclick="delRow('${key}',${c.id})">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  const notice = document.getElementById('sw-' + key + '-hid-notice');
  if (notice) {
    notice.innerHTML = hidden.length
      ? `<div class="hid-notice no-capture">👁 <span class="hid-count">${hidden.length}</span> hidden:
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
  const q      = (document.querySelector(`.roster-search[data-search-key="${key}"]`)?.value || '').toLowerCase().trim();
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
    const name    = (tr.dataset.search || '').toLowerCase();
    const tGender = (tr.dataset.gender || '').toUpperCase().trim();
    const tStatus = (tr.dataset.status || '').toUpperCase();

    const matchQ = !q      || name.includes(q);
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
    fc.textContent   = hasFilter ? `Showing ${visible} of ${total} contestants` : '';
  }
}

function resetFilters(key) {
  const searchEl = document.querySelector(`.roster-search[data-search-key="${key}"]`);
  if (searchEl) searchEl.value = '';
  const statEl   = document.getElementById('fstat-'   + key);
  if (statEl)   statEl.value   = '';
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
  const asc  = _sortDirs[sk];

  // Sort only visible (non-hidden) rows to avoid disturbing hide-manager state
  const allRows    = Array.from(tbody.querySelectorAll('tr'));
  const visible    = allRows.filter(r => !r.classList.contains('row-hidden'));
  const hiddenRows = allRows.filter(r =>  r.classList.contains('row-hidden'));

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
  const col     = window.SHOWS[key]?.color || '#4A9EFF';
  const isAdmin = document.body.classList.contains('admin-active');

  el.innerHTML = (window.DB[key] || []).map((c, i) => {
    const hid       = isH(key, c.id);
    const g         = calcGrowth(c.follLast, c.follCur);
    const g2        = calcGrowth(c.follBefore, c.follCur);
    const gcol      = g.rateRaw !== null ? (g.rateRaw >= 0 ? 'var(--grn)' : '#CC4444') : 'var(--mut)';
    const initials  = contestantInitials(c.name);
    const photo     = String(c?.photo || '').trim();

    const photoBlock = photo
      ? `<div class="ccard-photo-wrap" style="border-top:3px solid ${col}">
           <img class="ccard-photo-img" src="${photo.replace(/"/g, '&quot;')}" alt="${sanitizeHTML(c.name)}" loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
           <div class="ccard-photo-fallback" style="display:none;background:linear-gradient(150deg,${col}22,${col}55)">
             <div class="ccard-initials">${initials}</div>
             <div class="ccard-no-photo-meta">
               <div class="ccard-no-photo-name">${sanitizeHTML(c.name)}</div>
               <div class="ccard-no-photo-sub">${sanitizeHTML(c.profession || '')}</div>
             </div>
           </div>
         </div>`
      : `<div class="ccard-photo-wrap ccard-photo-fallback" style="border-top:3px solid ${col};background:linear-gradient(150deg,${col}18,${col}40)">
           <div class="ccard-initials">${initials}</div>
           <div class="ccard-no-photo-meta">
             <div class="ccard-no-photo-name">${sanitizeHTML(c.name)}</div>
             <div class="ccard-no-photo-sub">${sanitizeHTML(c.profession || '')} · ${c.gender || ''}</div>
             ${c.follCur && c.follCur !== 'N/V' ? `<div class="ccard-no-photo-foll" style="color:${col}">${displayFollower(c.follCur)} followers</div>` : ''}
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
          ${c.bio ? `<button class="btn b-pur b-sm" style="flex:1;justify-content:center" onclick="openBio('${key}',${c.id})">ℹ️ Profile</button>` : ''}
          <button class="btn b-gh b-sm admin-only" style="flex:1;justify-content:center" onclick="openEdit('${key}',${c.id})">✎ Edit</button>
          <button class="btn b-gh b-sm admin-only" style="flex:1;justify-content:center" onclick="openCopyToShow('${key}',${c.id})" title="Copy to another show">📋 Copy</button>
          <button class="btn ${hid ? 'b-grn' : 'b-warn'} b-sm" onclick="toggleH('${key}',${c.id})">${hid ? '✓ Show' : '👁 Hide'}</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ─── GROWTH SORT STATE ─────────────────────────────────── */
function getGrowthSortKey(key) { return window._growthSort[key] || 'growth-desc'; }
function setGrowthSort(key, val) {
  window._growthSort[key] = val;
  renderGrowth(key);
  if (typeof _autoPersist === 'function') _autoPersist();
}

/* ─── GROWTH TABLE ──────────────────────────────────────── */
function buildGrowthHTML(key) {
  const raw = (window.DB[key] || []).filter(c => !isH(key, c.id));
  if (!raw.length) {
    return `<div style="color:var(--mut);padding:40px 20px;text-align:center;font-size:13px">
      No visible contestants. Add via <strong>+ Add</strong> or enable <strong>Edit Mode</strong>.
    </div>`;
  }

  const sortVal     = getGrowthSortKey(key);
  const customOrder = window._growthOrder[key];

  let data;
  if (sortVal === 'custom' && customOrder?.length) {
    const byId = Object.fromEntries(raw.map(c => [c.id, c]));
    const ord  = customOrder.map(id => byId[id]).filter(Boolean);
    raw.forEach(c => { if (!customOrder.includes(c.id)) ord.push(c); });
    data = ord;
  } else {
    data = [...raw].sort((a, b) => {
      const ga = calcGrowth(a.follLast,   a.follCur);
      const gb = calcGrowth(b.follLast,   b.follCur);
      const ta = calcGrowth(a.follBefore, a.follCur);
      const tb = calcGrowth(b.follBefore, b.follCur);
      const cA = parseF(a.follCur) ?? 0;
      const cB = parseF(b.follCur) ?? 0;
      switch (sortVal) {
        case 'growth-desc':    return (gb.rateRaw ?? -Infinity) - (ga.rateRaw ?? -Infinity);
        case 'growth-asc':     return (ga.rateRaw ??  Infinity) - (gb.rateRaw ??  Infinity);
        case 'total-desc':     return (tb.rateRaw ?? -Infinity) - (ta.rateRaw ?? -Infinity);
        case 'total-asc':      return (ta.rateRaw ??  Infinity) - (tb.rateRaw ??  Infinity);
        case 'followers-desc': return cB - cA;
        case 'followers-asc':  return cA - cB;
        case 'name':           return a.name.localeCompare(b.name);
        default:               return (gb.rateRaw ?? -Infinity) - (ga.rateRaw ?? -Infinity);
      }
    });
  }

  const s          = window.SHOWS[key];
  const hasCustom  = customOrder?.length;

  const rows = data.map((c, idx) => {
    const g1   = calcGrowth(c.follLast,   c.follCur);
    const g2   = calcGrowth(c.follBefore, c.follCur);
    const neg1 = g1.rateRaw !== null && g1.rateRaw < 0;
    const hi1  = g1.rateRaw !== null && g1.rateRaw >= 5;
    const md1  = g1.rateRaw !== null && g1.rateRaw >= 1 && g1.rateRaw < 5;
    const g2col = g2.rateRaw !== null && g2.rateRaw >= 50 ? '#005500' :
                  g2.rateRaw !== null && g2.rateRaw < 0   ? '#880000' : '#000000';

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
      <td>${eC(c.follBefore, 'follBefore')}</td>
      <td>${eC(c.follLast,   'follLast')}</td>
      <td>${eC(c.follCur,    'follCur')}</td>
      <td class="${neg1 ? 'neg' : hi1 ? 'hi' : md1 ? 'md' : ''}">${g1.diff}</td>
      <td class="${neg1 ? 'neg' : hi1 ? 'hi' : md1 ? 'md' : ''}">${g1.rate}</td>
      <td>${g2.diff}</td>
      <td style="color:${g2col}">${g2.rate}</td>
    </tr>`;
  }).join('');

  return `<div class="growth-sort-bar no-capture">
    <span class="sort-label">Sort by</span>
    ${[
      ['growth-desc',    '📈', 'Highest Growth'],
      ['growth-asc',     '📉', 'Lowest Growth'],
      ['total-desc',     '🚀', 'Total Growth ↑'],
      ['total-asc',      '⬇️', 'Total Growth ↓'],
      ['followers-desc', '👥', 'Most Followers'],
      ['followers-asc',  '👤', 'Fewest Followers'],
      ['name',           '🔤', 'A–Z'],
      ['custom',         '↕️', 'Custom'],
    ].map(([val, ico, lbl]) =>
      `<button class="sort-pill${sortVal === val ? ' active' : ''}"
        onclick="setGrowthSort('${key}','${val}')"
        title="${lbl}">${ico} ${lbl}</button>`
    ).join('')}
    ${sortVal === 'custom' ? '<span style="font-size:10px;color:var(--mut);margin-left:4px">↕ Drag rows to reorder</span>' : ''}
    ${hasCustom ? `<button class="btn b-gh b-xs" onclick="resetGrowthOrder('${key}')">✕ Reset order</button>` : ''}
  </div>
  <div class="gtbl-wrap" id="gtbl-inner-${key}">
    <div class="gtbl-title">${s?.emoji || ''} ${s?.label || key.toUpperCase()} — Instagram Follower Growth Analysis</div>
    <table>
      <thead><tr>
        <th style="min-width:200px">Contestant ↕</th>
        <th>Before Show</th>
        <th>Last Checked</th>
        <th>Current ✓</th>
        <th>Growth (Last→Now)</th>
        <th>Growth Rate %</th>
        <th>Total Growth</th>
        <th>Total Rate %</th>
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
  toast('✓ Reordered — drag again or click ↓ Save JSON to publish');
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
  const rows  = Array.from(tbody.querySelectorAll('tr'));
  const ids   = rows.map(r => parseInt(r.dataset.id));
  const si    = ids.indexOf(srcId), ti = ids.indexOf(tgtId);
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
    c[f] = /^foll(Before|Last|Cur)$/.test(f) ? normalizeFollowerInput(val) : sanitizeHTML(val.trim());
    renderGrowth(key);
    toast('✓ Updated: ' + f);
    if (typeof _autoPersist === 'function') _autoPersist();
  }
}

/* ─── SHIFT CURRENT → LAST CHECKED ──────────────────────── */
/**
 * For every visible contestant in a show:
 *  - copies follCur → follLast
 *  - copies follCurDate (or today) → follLastDate
 *  - clears follCur and follCurDate so the admin can enter fresh values
 */
function shiftCurrentToLast(key) {
  const today = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  const data  = (window.DB[key] || []).filter(c => !isH(key, c.id));
  let shifted = 0;
  data.forEach(c => {
    if (c.follCur && c.follCur !== 'N/V') {
      c.follLast     = c.follCur;
      c.follLastDate = c.follCurDate || today;
      c.follCur      = 'N/V';
      c.follCurDate  = '';
      shifted++;
    }
  });
  renderGrowth(key);
  renderTable(key);
  if (typeof _autoPersist === 'function') _autoPersist();
  if (shifted > 0) {
    toast(`⟳ Rolled ${shifted} contestants — enter new Current values now`);
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
        <div style="font-size:13px;font-weight:800;color:${window.SHOWS[k].color}">${window.SHOWS[k].emoji || ''} ${window.SHOWS[k].label}</div>
        <div style="display:flex;gap:6px" class="no-capture">
          <button class="btn b-gld b-sm" onclick="capture('gtbl-inner-${k}','${k}_Growth')">📷 Capture</button>
          <button class="btn b-gh b-sm"  onclick="exportGrowthCSV('${k}')">↓ CSV</button>
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
  const show   = document.getElementById('rank-show-filter')?.value || '';
  const gender = (document.getElementById('rank-gender-filter')?.value || '').toUpperCase().trim();
  const q      = (document.getElementById('rank-search')?.value || '').toLowerCase().trim();

  let visible = 0;
  document.querySelectorAll('#rank-tbody tr').forEach(tr => {
    const tStatus = (tr.dataset.status || '').toUpperCase();
    const tGender = (tr.dataset.gender || '').toUpperCase().trim();
    const tName   = (tr.dataset.name   || '').toLowerCase();
    const tShow   = tr.dataset.show || '';

    const ok = (!status || tStatus.includes(status))
            && (!show   || tShow === show)
            && (!gender || tGender === gender)
            && (!q      || tName.includes(q));
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
    return `<div class="hm-item ${vis ? 'hm-vis' : 'hm-hid'}" onclick="toggleH('${c._k}',${c.id});renderHideMgr()">
      <div class="hm-chk">${vis ? '✓' : ''}</div>
      <div>
        <div class="hm-name">${sanitizeHTML(c.name)}</div>
        <div class="hm-show">${sanitizeHTML(window.SHOWS[c._k]?.label || c._k)}</div>
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
}
function openShowEdit(key) {
  showEditKey = key;
  const s = window.SHOWS[key];
  if (!s) return;
  document.getElementById('show-edit-title').textContent = '✎ Edit Show: ' + s.label;
  document.getElementById('ns-name').value     = s.label || '';
  document.getElementById('ns-key').value      = key;
  document.getElementById('ns-key').disabled   = true;
  document.getElementById('ns-platform').value = s.platform || '';
  document.getElementById('ns-host').value     = s.host || '';
  document.getElementById('ns-emoji').value    = s.emoji || '';
  document.getElementById('ns-desc').value     = s.desc || '';
  document.getElementById('ns-color').value    = s.color || '#4A9EFF';
  document.getElementById('ns-banner').value   = s.bannerUrl || '';
  if (s.releaseDate) document.getElementById('ns-date').value = s.releaseDate;
  document.getElementById('ns-add-btn').textContent = '✓ Update Show';
  document.getElementById('modal-shows').classList.add('open');
}
function resetShowForm() {
  document.getElementById('show-edit-title').textContent = '⚙ Manage Shows';
  ['ns-name','ns-key','ns-host','ns-date','ns-desc','ns-platform','ns-emoji','ns-banner'].forEach(id => {
    const e = document.getElementById(id); if (e) { e.value = ''; e.disabled = false; }
  });
  document.getElementById('ns-color').value = '#4A9EFF';
  document.getElementById('ns-add-btn').textContent = '+ Create Show';
}
function renderShowList() {
  const el = document.getElementById('show-list');
  if (!el) return;
  el.innerHTML = getShowKeys().map(k => {
    const s      = window.SHOWS[k];
    const hidden = isShowHidden(k);
    return `<div class="show-item${hidden ? ' show-item-hidden' : ''}">
      <span class="show-dot" style="background:${s.color};${hidden ? 'opacity:.4' : ''}"></span>
      <div style="flex:1;${hidden ? 'opacity:.5' : ''}">
        <div class="show-name">${s.emoji || ''} ${sanitizeHTML(s.label)}</div>
        <div class="show-meta-sm">${sanitizeHTML(s.platform || '')} · ${showDateLabel(s)} · ${(window.DB[k] || []).length} contestants${hidden ? ' · <span style="color:var(--warn)">hidden from public</span>' : ''}</div>
      </div>
      <button class="btn ${hidden ? 'b-grn' : 'b-warn'} b-xs" onclick="toggleShowHidden('${k}')" title="${hidden ? 'Publish — make visible to public' : 'Hide from public view'}">
        ${hidden ? '✓ Publish' : '👁 Hide'}
      </button>
      <button class="btn b-gh b-xs" onclick="openShowEdit('${k}')">✎</button>
      ${getShowKeys().length > 1 ? `<button class="btn b-red b-xs" onclick="removeShow('${k}')">🗑</button>` : ''}
    </div>`;
  }).join('');
}
function addShow() {
  const name = document.getElementById('ns-name').value.trim();
  const key  = showEditKey || document.getElementById('ns-key').value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!name || !key) { toast('Name and key required', 'err'); return; }
  if (!showEditKey && window.SHOWS[key]) { toast('Key already exists', 'err'); return; }
  const payload = {
    label:       sanitizeHTML(name), key,
    color:       document.getElementById('ns-color').value,
    platform:    sanitizeHTML(document.getElementById('ns-platform').value),
    host:        sanitizeHTML(document.getElementById('ns-host').value || 'TBC'),
    releaseDate: document.getElementById('ns-date').value || '',
    date:        formatReleaseDate(document.getElementById('ns-date').value) || document.getElementById('ns-date').value || 'TBC',
    desc:        sanitizeHTML(document.getElementById('ns-desc').value || ''),
    emoji:       document.getElementById('ns-emoji').value || '📺',
    bannerUrl:   document.getElementById('ns-banner').value.trim() || '',
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
  if (typeof logActivity === 'function') logActivity(editing ? 'Updated show' : 'Created show', name, editing ? '✏️' : '📺');
  if (typeof _autoPersist === 'function') _autoPersist();
}
function removeShow(key) {
  const lbl = window.SHOWS[key]?.label || key;
  if (!confirm('Remove "' + lbl + '"? All data lost.')) return;
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
  const key  = document.getElementById('f-show').value;
  const name = document.getElementById('f-name').value.trim();
  if (!name) { toast('Name required', 'err'); return; }
  if (!window.DB[key]) window.DB[key] = [];
  const obj = {
    name:           sanitizeHTML(name),
    gender:         document.getElementById('f-gender').value,
    status:         document.getElementById('f-status').value,
    profession:     sanitizeHTML(document.getElementById('f-profession').value),
    tier:           sanitizeHTML(document.getElementById('f-tier').value),
    ig:             sanitizeHTML(document.getElementById('f-ig').value),
    photo:          document.getElementById('f-photo').value.trim(),
    follBefore:     normalizeFollowerInput(document.getElementById('f-fb').value),
    follBeforeDate: sanitizeHTML(document.getElementById('f-fbd').value),
    follLast:       normalizeFollowerInput(document.getElementById('f-fl').value),
    follLastDate:   sanitizeHTML(document.getElementById('f-fld').value),
    follCur:        normalizeFollowerInput(document.getElementById('f-fc').value),
    follCurDate:    sanitizeHTML(document.getElementById('f-fcd').value),
    knownFor:       sanitizeHTML(document.getElementById('f-kf').value),
    history:        sanitizeHTML(document.getElementById('f-his').value),
  };
  const errors = validateContestant(obj);
  if (errors.length) { toast(errors[0], 'err'); return; }
  const wasEdit = !!editTarget;
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
  closeModal('modal-c');
  renderAll(); rebuildSidebar(); updateStats();
  toast(wasEdit ? '✓ Updated' : '✓ Added to ' + (window.SHOWS[key]?.label || key));
  if (typeof logActivity === 'function') logActivity(wasEdit ? 'Edited contestant' : 'Added contestant', obj.name + ' · ' + (window.SHOWS[key]?.label || key), wasEdit ? '✏️' : '➕');
  if (typeof _autoPersist === 'function') _autoPersist();
}
function delRow(key, id) {
  if (!confirm('Delete this contestant?')) return;
  const c = (window.DB[key] || []).find(x => x.id === id);
  window.DB[key] = (window.DB[key] || []).filter(c => c.id !== id);
  HIDDEN.delete(key + '::' + id);
  renderAll(); rebuildSidebar(); updateStats();
  toast('Removed', 'warn');
  if (typeof logActivity === 'function') logActivity('Removed contestant', (c?.name || '?') + ' · ' + (window.SHOWS[key]?.label || key), '🗑️');
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
    list.innerHTML = '<div style="color:var(--mut);font-size:12px;text-align:center;padding:20px 0">No other shows exist yet — add one via ⚙ Shows first.</div>';
  } else {
    list.innerHTML = otherShows.map(k => `
      <button class="btn b-gh" style="justify-content:flex-start;width:100%"
        onclick="confirmCopyToShow('${k}')">
        ${window.SHOWS[k]?.emoji || ''} ${sanitizeHTML(window.SHOWS[k]?.label || k)}
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
  toast(`✓ Copied "${copy.name}" to ${window.SHOWS[targetKey]?.label || targetKey} — original untouched`);
  if (typeof logActivity === 'function') logActivity('Copied contestant', `${copy.name} · ${window.SHOWS[sourceKey]?.label || sourceKey} → ${window.SHOWS[targetKey]?.label || targetKey}`, '📋');
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

  const col   = window.SHOWS[key]?.color || '#8B5CF6';
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
  rebuildDynamicPanels();
  rebuildSidebar();
  populateShowSel();
  renderOverview();
  renderAll();
  if (typeof renderShowList === 'function') renderShowList();
  if (typeof rebuildExportPanel === 'function') rebuildExportPanel();
  updateStats();
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
  if ((e.ctrlKey || e.metaKey) && e.key === 's')              { e.preventDefault(); saveToLocalStorage(true); }
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
    { panel: 'overview',   label: '🏠 Overview' },
    { panel: 'rankings',   label: '🏆 Rankings' },
    { panel: 'growth-all', label: '📈 All Growth' },
    { panel: 'export',     label: '↓ Export', adminOnly: true },
    { panel: 'help',       label: '❓ Help',   adminOnly: true },
  ];
  const showItems = getShowKeys().map(k => ({
    panel: 'show-' + k,
    label: (window.SHOWS[k].emoji || '') + ' ' + window.SHOWS[k].label,
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
