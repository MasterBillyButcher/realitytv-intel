/* ═══════════════════════════════════════════════════════════
   export.js  —  Reality TV Intel 2026
   CSV · JSON · Bulk import · Screenshot capture
═══════════════════════════════════════════════════════════ */

/* ─── JSON EXPORT (Save as data.js) ─────────────────────── */
function exportJSON() {
  const now    = new Date();
  const stamp  = now.toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });

  /* Strict JSON, not executable JS. Previously this file contained
     `window.SHOWS = {...}; window.DB = {...};` and was loaded via
     new Function(code)() — meaning anything that could write to this
     GitHub path (or intercept the raw.githubusercontent.com fetch)
     got arbitrary script execution in every visitor's browser, not
     just bad data. Pure JSON can only ever be parsed as data. */
  const payload = {
    _meta: { savedAt: stamp, generator: 'Reality TV Intel 2026' },
    SHOWS: window.SHOWS,
    DB: window.DB,
    HIDDEN_SHOWS_INIT: [...(typeof HIDDEN_SHOWS !== 'undefined' ? HIDDEN_SHOWS : [])],
    // Per-contestant hidden list — includes contestants auto-hidden on
    // elimination as well as any manually hidden/unhidden by the admin.
    // Publishing this is what makes "eliminated → hidden from Growth →
    // skipped by live follower refresh" apply site-wide, not just in
    // the admin's own browser.
    HIDDEN_INIT: [...(typeof HIDDEN !== 'undefined' ? HIDDEN : [])],
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'data.js';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('✓ data.js downloaded — upload to GitHub to publish');
  if (typeof logActivity === 'function') logActivity('Exported data.js', Object.keys(window.SHOWS).length + ' shows', '📁');
}

/* ─── CSV HELPERS ───────────────────────────────────────── */
function csvRow(arr) {
  return arr.map(v => {
    const s = String(v ?? '').replace(/"/g, '""');
    return /[",\n\r]/.test(s) ? `"${s}"` : s;
  }).join(',') + '\r\n';
}

function downloadCSV(filename, rows) {
  const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ─── SINGLE SHOW CSV ───────────────────────────────────── */
function exportCSV(key) {
  const s    = window.SHOWS[key];
  const data = (window.DB[key] || []).filter(c => !isH(key, c.id));
  if (!data.length) { toast('No visible contestants to export', 'warn'); return; }

  const hdrs = ['#','Name','Gender','Status','Tier','Profession','Instagram',
    'Followers Before','Before Date','Followers Last','Last Date',
    'Followers Current','Current Date','Known For','History'];
  let out = csvRow(hdrs);
  data.forEach((c, i) => {
    const g = calcGrowth(c.follLast, c.follCur);
    out += csvRow([
      i + 1, c.name, c.gender, c.status, c.tier, c.profession,
      c.ig, c.follBefore, c.follBeforeDate, c.follLast, c.follLastDate,
      c.follCur, c.follCurDate, c.knownFor, c.history
    ]);
  });
  downloadCSV(`${key}_roster_${_dateStamp()}.csv`, out);
  toast(`✓ ${s?.label || key} roster exported`);
}

/* ─── ALL SHOWS CSV ─────────────────────────────────────── */
function exportAllCSV() {
  const hdrs = ['Show','#','Name','Gender','Status','Tier','Profession','Instagram',
    'Followers Before','Followers Last','Followers Current','Known For'];
  let out = csvRow(hdrs);
  getShowKeys().filter(k => !isShowHidden(k)).forEach(k => {
    (window.DB[k] || []).filter(c => !isH(k, c.id)).forEach((c, i) => {
      out += csvRow([
        window.SHOWS[k]?.label || k,
        i + 1, c.name, c.gender, c.status, c.tier, c.profession,
        c.ig, c.follBefore, c.follLast, c.follCur, c.knownFor
      ]);
    });
  });
  downloadCSV(`all_rosters_${_dateStamp()}.csv`, out);
  toast('✓ All rosters exported');
}

/* ─── GROWTH CSV (single show) ──────────────────────────── */
function exportGrowthCSV(key) {
  const s    = window.SHOWS[key];
  const data = (window.DB[key] || []).filter(c => !isH(key, c.id));
  if (!data.length) { toast('No visible contestants to export', 'warn'); return; }

  const hdrs = ['#','Name','Before Show','Last Checked','Current',
    'Growth','Growth %','Total Growth','Total %'];
  let out = csvRow(hdrs);
  data.forEach((c, i) => {
    const g1 = calcGrowth(c.follLast,   c.follCur);
    const g2 = calcGrowth(c.follBefore, c.follCur);
    out += csvRow([i + 1, c.name, c.follBefore, c.follLast, c.follCur,
      g1.diff, g1.rate, g2.diff, g2.rate]);
  });
  downloadCSV(`${key}_growth_${_dateStamp()}.csv`, out);
  toast(`✓ ${s?.label || key} growth exported`);
}

/* ─── ALL GROWTH CSV ────────────────────────────────────── */
function exportAllGrowth() {
  const hdrs = ['Show','#','Name','Before Show','Last Checked','Current',
    'Growth','Growth %','Total Growth','Total %'];
  let out = csvRow(hdrs);
  getShowKeys().filter(k => !isShowHidden(k)).forEach(k => {
    (window.DB[k] || []).filter(c => !isH(k, c.id)).forEach((c, i) => {
      const g1 = calcGrowth(c.follLast,   c.follCur);
      const g2 = calcGrowth(c.follBefore, c.follCur);
      out += csvRow([window.SHOWS[k]?.label || k, i + 1, c.name,
        c.follBefore, c.follLast, c.follCur,
        g1.diff, g1.rate, g2.diff, g2.rate]);
    });
  });
  downloadCSV(`all_growth_${_dateStamp()}.csv`, out);
  toast('✓ All growth exported');
}

/* ─── RANKINGS CSV ──────────────────────────────────────── */
function exportRankCSV() {
  const hdrs = ['Rank','Name','Show','Status','Followers','Tier','Known For'];
  let out    = csvRow(hdrs);
  const all  = [];
  Object.keys(window.DB).filter(k => !isShowHidden(k)).forEach(k =>
    (window.DB[k] || []).filter(c => !isH(k, c.id)).forEach(c =>
      all.push({ ...c, _k: k, _sl: window.SHOWS[k]?.label })
    )
  );
  all.sort((a, b) => (parseF(b.follCur) ?? 0) - (parseF(a.follCur) ?? 0));
  all.forEach((c, i) => {
    out += csvRow([i + 1, c.name, c._sl, c.status, c.follCur, c.tier || c.profession, c.knownFor]);
  });
  downloadCSV(`rankings_${_dateStamp()}.csv`, out);
  toast('✓ Rankings exported');
}

function _dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

/* ─── EXPORT PANEL BUILDER ──────────────────────────────── */
function rebuildExportPanel() {
  const el = document.getElementById('per-show-exp');
  if (!el) return;
  el.innerHTML = getShowKeys().map(k =>
    `<button class="btn b-gld b-sm" onclick="capture('sw-${k}-tbl','${k}_Table')">📷 ${window.SHOWS[k].emoji || ''} ${window.SHOWS[k].label} Table</button>
     <button class="btn b-gh b-sm"  onclick="capture('sw-${k}-gtbl','${k}_Growth')">📈 ${window.SHOWS[k].label} Growth</button>
     <button class="btn b-pur b-sm admin-only" onclick="refreshFollowersLive('${k}')">🔄 ${window.SHOWS[k].label} (Live)</button>`
  ).join('');
}

/* ─── SCREENSHOT / CAPTURE ──────────────────────────────── */
let _captureCanvas   = null;
let _captureFilename = 'capture';

const HIDE_IN_CAPTURE = [
  '.topbar', '.sidebar', '.tbar', '.tab-bar', '.save-bar',
  '.ph-act', '.tb-r', '.tb-l button', '.no-capture',
  '.hid-notice', '.hide-btn', '.btn.b-red', '.btn.b-xs',
  '#editBtn', '#save-bar', '.ccard-footer',
];

async function capture(elId, filename) {
  const el = document.getElementById(elId);
  if (!el) { toast('Element not found: ' + elId, 'err'); return; }
  _captureFilename = (filename || elId).replace(/[^a-z0-9_\-]/gi, '_');

  const bg      = document.getElementById('cap-modal-bg');
  const img     = document.getElementById('cap-preview-img');
  const spinner = document.getElementById('cap-spinner');
  const info    = document.getElementById('cap-info');
  const btns    = [
    document.getElementById('cap-save-png'),
    document.getElementById('cap-save-jpg'),
    document.getElementById('cap-copy'),
    document.getElementById('cap-print'),
  ];

  img.style.display     = 'none';
  spinner.style.display = 'flex';
  info.textContent      = 'Generating…';
  btns.forEach(b => { if (b) b.disabled = true; });
  bg.classList.add('open');
  _captureCanvas = null;

  let hiddenAncestors = [];
  let hiddenEls  = [];
  let wasHidden  = false;
  let origStyle  = '';

  try {
    /* Walk up from el to <body>, forcing any hidden ancestor visible.
       This is the actual fix for "Per-Show Captures in the Export
       panel don't work for any show" — .panel and .tab-pane both use
       display:none for whichever isn't currently active (confirmed:
       `.panel { display: none; } .panel.active { display: block; }`).
       The previous code only force-displayed the DIRECTLY targeted
       element (e.g. sw-alliance-tbl) — but if that element's PARENT
       panel is display:none (true for every show except whichever one
       you're currently looking at), the browser never lays out or
       paints the child regardless of the child's own style. Capturing
       from the Export panel targets OTHER shows' panels almost every
       time, so this was failing for every per-show capture triggered
       from there, on every show, for both Table and Growth alike. */
    let node = el.parentElement;
    while (node && node !== document.body) {
      if (getComputedStyle(node).display === 'none') {
        hiddenAncestors.push({ node, orig: node.getAttribute('style') || '' });
        node.style.cssText += ';display:block!important;';
      }
      node = node.parentElement;
    }

    wasHidden = getComputedStyle(el).display === 'none' || el.offsetParent === null;
    origStyle = el.getAttribute('style') || '';
    if (wasHidden) {
      el.style.cssText = 'position:fixed!important;left:-9999px!important;top:0!important;display:block!important;z-index:-1!important;min-width:1200px!important;background:var(--bg)!important;';
    }
    // Any ancestor we force-opened also needs to be pulled off-screen
    // AND given an explicit width — not just made display:block. Without
    // a real width, a position:fixed element defaults to shrink-to-fit,
    // which gives width:100% / table-layout:fixed content (exactly what
    // the Growth table uses) nothing concrete to size against. That
    // mismatch is what produced the ~12,000px-wide blank captures.
    if (hiddenAncestors.length) {
      hiddenAncestors[hiddenAncestors.length - 1].node.style.cssText +=
        ';position:fixed!important;left:-9999px!important;top:0!important;z-index:-1!important;width:1400px!important;min-width:1400px!important;max-width:1400px!important;';
    }

    /* Hide UI chrome. Dedupe by node — an element can legitimately match
       MORE THAN ONE selector in HIDE_IN_CAPTURE (e.g. class="tab-bar
       no-capture", or class="btn b-red b-xs"). Without dedup, that same
       node gets pushed into hiddenEls twice: once with its real original
       visibility, and a second time capturing the mid-hide "hidden"
       state as if it were the original. Restoration then runs in order
       and the second entry silently overwrites the correct restore with
       "hidden" again — which is exactly why the tab bar and delete
       button were staying invisible after every capture. */
    const seen = new Set();
    HIDE_IN_CAPTURE.forEach(sel => {
      el.querySelectorAll(sel).forEach(node => {
        if (seen.has(node)) return;
        seen.add(node);
        if (getComputedStyle(node).display !== 'none') {
          hiddenEls.push({ node, v: node.style.visibility });
          node.style.visibility = 'hidden';
        }
      });
    });

    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 200)));

    /* Measure AFTER chrome is hidden and layout has settled, so the
       width we snapshot at matches the width we crop to — prevents
       html2canvas reflowing the responsive grid into extra columns
       that then get sliced off. */
    const fullWidth  = el.scrollWidth;
    const fullHeight = el.scrollHeight;

    const canvas = await html2canvas(el, {
      backgroundColor: document.body.classList.contains('theme-light') ? '#F0F2F8' : '#08080F',
      scale:           2,
      useCORS:         true,
      logging:         false,
      width:           fullWidth,
      height:          fullHeight,
      windowWidth:     fullWidth,
      windowHeight:    fullHeight,
      ignoreElements:  node => {
        const tag = (node.tagName || '').toLowerCase();
        if (tag === 'button') return true;
        const cls = String(node.className || '');
        return cls.includes('no-capture') || cls.includes('tbar') ||
               cls.includes('tab-bar') || cls.includes('ph-act') ||
               cls.includes('tb-r') || cls.includes('hide-btn') ||
               cls.includes('save-bar') || cls.includes('topbar') ||
               cls.includes('sidebar');
      },
      onclone: (clonedDoc, clonedRoot) => {
        /* html2canvas doesn't reliably resolve CSS custom properties
           (var(--gtbl-row), var(--acc), etc.) when rendering its cloned
           document — this is a long-standing, documented limitation,
           not something its options can toggle off. The Growth table
           leans heavily on custom properties for its cyan theme, which
           is the most likely reason it renders blank while Roster/Card
           View (which use fewer var()-dependent backgrounds) succeed.

           Fix: walk the ORIGINAL (still-live, still-styled) tree and the
           CLONE in lockstep, and copy each original element's already-
           RESOLVED computed color values onto the clone as literal
           inline styles. By the time html2canvas reads the clone, there
           is no var() left to resolve — just plain rgb() values it
           can't get wrong. */
        function inlineComputedColors(origNode, cloneNode) {
          if (origNode.nodeType !== 1 || cloneNode.nodeType !== 1) return;
          const cs = getComputedStyle(origNode);
          cloneNode.style.backgroundColor = cs.backgroundColor;
          cloneNode.style.color           = cs.color;
          if (cs.borderTopWidth !== '0px')    cloneNode.style.borderTopColor    = cs.borderTopColor;
          if (cs.borderBottomWidth !== '0px') cloneNode.style.borderBottomColor = cs.borderBottomColor;
          if (cs.borderLeftWidth !== '0px')   cloneNode.style.borderLeftColor   = cs.borderLeftColor;
          if (cs.borderRightWidth !== '0px')  cloneNode.style.borderRightColor  = cs.borderRightColor;

          const oChildren = origNode.children;
          const cChildren = cloneNode.children;
          for (let i = 0; i < oChildren.length && i < cChildren.length; i++) {
            inlineComputedColors(oChildren[i], cChildren[i]);
          }
        }
        try {
          inlineComputedColors(el, clonedRoot);
        } catch (cloneErr) {
          console.warn('[Capture] onclone color-inlining skipped:', cloneErr.message);
        }
      },
    });

    let dataURL;
    try {
      dataURL = canvas.toDataURL('image/png');
    } catch (taintErr) {
      // Canvas is CORS-tainted (a photo loaded without proper CORS
      // headers) — it exists but can never be read out as an image,
      // for saving, copying, or previewing. Don't store it as "ready";
      // that was the actual bug — a tainted canvas was being saved to
      // _captureCanvas BEFORE this check, so Save/Copy would silently
      // fail later with zero feedback instead of a clear error here.
      throw new Error('One or more images couldn\'t be captured due to a cross-origin restriction (CORS). Try again after re-hosting any photo URLs that block this.');
    }
    _captureCanvas = canvas;
    const w = canvas.width / 2, h = canvas.height / 2;

    img.src           = dataURL;
    img.style.display = 'block';
    spinner.style.display = 'none';
    info.textContent  = `${Math.round(w)} × ${Math.round(h)}px · 2× retina`;
    btns.forEach(b => { if (b) b.disabled = false; });
    toast('✓ Preview ready — choose Save, Copy or Print');

  } catch (e) {
    spinner.style.display = 'none';
    info.textContent = 'Failed: ' + e.message;
    toast('Capture failed: ' + e.message + '. Try Ctrl+P for PDF.', 'err');
    console.error('[Capture]', e);

  } finally {
    /* ALWAYS restore hidden chrome — even if html2canvas threw.
       This is what was making tabs/buttons disappear permanently
       after a failed capture. */
    hiddenEls.forEach(({ node, v }) => { node.style.visibility = v; });
    if (wasHidden) el.setAttribute('style', origStyle);
    // Restore ancestor panels/tabs we force-opened, innermost first —
    // order doesn't actually matter for correctness here since each
    // restores its own exact original style string, but innermost-first
    // avoids any visible flash of a still-repositioned outer wrapper.
    for (let i = hiddenAncestors.length - 1; i >= 0; i--) {
      const { node, orig } = hiddenAncestors[i];
      if (orig) node.setAttribute('style', orig); else node.removeAttribute('style');
    }
  }
}

function captureCurrentPanel() {
  const active = document.querySelector('.panel.active');
  if (!active) { toast('No active panel', 'err'); return; }
  capture(active.id, 'CurrentView');
}

function closeCaptureModal() {
  document.getElementById('cap-modal-bg').classList.remove('open');
  const img = document.getElementById('cap-preview-img');
  img.src = ''; img.style.display = 'none';
  document.getElementById('cap-spinner').style.display = 'flex';
  _captureCanvas = null;
}

function saveCapture(fmt) {
  if (!_captureCanvas) { toast('No capture ready', 'err'); return; }
  try {
    const date = _dateStamp();
    const a    = document.createElement('a');
    if (fmt === 'jpg') {
      a.href     = _captureCanvas.toDataURL('image/jpeg', 0.95);
      a.download = _captureFilename + '_' + date + '.jpg';
    } else {
      a.href     = _captureCanvas.toDataURL('image/png');
      a.download = _captureFilename + '_' + date + '.png';
    }
    a.click();
    toast('✓ Saved: ' + a.download);
  } catch (e) {
    toast('Save failed: ' + e.message, 'err');
    console.error('[Capture Save]', e);
  }
}

async function copyCapture() {
  if (!_captureCanvas) { toast('No capture ready', 'err'); return; }
  try {
    _captureCanvas.toBlob(async blob => {
      if (!blob) {
        toast('Copy failed: browser could not generate an image blob (likely a CORS-restricted photo). Try Save instead.', 'err');
        return;
      }
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast('✓ Image copied to clipboard — paste anywhere');
      } catch (e) {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        toast('Clipboard blocked — image opened in new tab (right-click to save)', 'warn');
      }
    }, 'image/png');
  } catch (e) {
    toast('Copy failed: ' + e.message, 'err');
  }
}

function printCapture() {
  if (!_captureCanvas) { toast('No capture ready', 'err'); return; }
  const dataURL = _captureCanvas.toDataURL('image/png');
  const win     = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Print — Reality TV Intel</title>
    <style>*{margin:0;padding:0}body{background:#fff}img{max-width:100%;height:auto;display:block}
    @media print{img{max-width:100%;page-break-inside:avoid}}</style>
    </head><body><img src="${dataURL}" onload="window.print();setTimeout(()=>window.close(),500)"></body></html>`);
  win.document.close();
}

/* init capture modal backdrop */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('cap-modal-bg')?.addEventListener('click', function (e) {
    if (e.target === this) closeCaptureModal();
  });
});
