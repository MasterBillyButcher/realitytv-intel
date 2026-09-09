/* ═══════════════════════════════════════════════════════════
   export.js — Reality TV Intel 2026
   CSV · JSON · Bulk import · Screenshot capture
═══════════════════════════════════════════════════════════ */

/* ─── SHARED PAYLOAD ────────────────────────────────────── */
function _buildDataPayload() {
  return {
    _meta: { savedAt: new Date().toISOString(), generator: 'Reality TV Intel 2026' },
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
}

/* ─── PUBLISH LIVE (primary save action) ────────────────────
   Writes straight to the live database — every visitor sees this
   within ~20s (the edge cache window), no export/upload/redeploy
   cycle required. This replaced "download data.js, upload to GitHub"
   as the main save path; that flow is still available as a manual
   backup via exportJSON() below. */
let _publishing = false;
async function publishLive() {
  if (_publishing) return;
  _publishing = true;
  const payload = _buildDataPayload();
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) {
        toast('Your admin session expired. Log in again, then publish.', 'warn');
      } else {
        const detail = data.databaseIssue ? ` (${data.databaseIssue}, connection: ${data.connectionDetected || 'unknown'})` : '';
        toast('Publish failed: ' + (data.error || res.status) + detail, 'warn');
        console.error('[Publish] Full diagnostic:', data);
      }
      return;
    }
    toast('✓ Published: live for everyone within ~20s');
    if (typeof logActivity === 'function') logActivity('Published live', Object.keys(window.SHOWS).length + ' shows', '');
  } catch (err) {
    toast('Publish failed. Check your connection and try again.', 'warn');
    console.error('[Publish]', err);
  } finally {
    _publishing = false;
  }
}

/* ─── JSON EXPORT (manual backup download) ──────────────────
   Not the primary publish path anymore — publishLive() is. This stays
   available for taking an offline backup, or as a manual fallback if
   the database is ever unreachable (see the Export panel's "Restore
   from backup" flow, which can POST this same file to /api/data). */
function exportJSON() {
  /* Strict JSON, not executable JS. Previously this file contained
     `window.SHOWS = {...}; window.DB = {...};` and was loaded via
     new Function(code)() — meaning anything that could write to this
     GitHub path (or intercept the raw.githubusercontent.com fetch)
     got arbitrary script execution in every visitor's browser, not
     just bad data. Pure JSON can only ever be parsed as data. */
  const payload = _buildDataPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'data-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('✓ Backup downloaded (this is not published, use Publish Live for that)');
  if (typeof logActivity === 'function') logActivity('Downloaded backup', Object.keys(window.SHOWS).length + ' shows', '');
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
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ─── SINGLE SHOW CSV ───────────────────────────────────── */
function exportCSV(key) {
  const s = window.SHOWS[key];
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
  const s = window.SHOWS[key];
  const data = (window.DB[key] || []).filter(c => !isH(key, c.id));
  if (!data.length) { toast('No visible contestants to export', 'warn'); return; }

  const hdrs = ['#','Name','Insta Handle','Before Show','Last Checked','Current',
    'Growth','Growth %','Total Growth','Total %'];
  let out = csvRow(hdrs);
  data.forEach((c, i) => {
    const g1 = calcGrowth(c.follLast, c.follCur);
    const g2 = calcGrowth(c.follBefore, c.follCur);
    out += csvRow([i + 1, c.name, c.ig, c.follBefore, c.follLast, c.follCur,
      g1.diff, g1.rate, g2.diff, g2.rate]);
  });
  downloadCSV(`${key}_growth_${_dateStamp()}.csv`, out);
  toast(`✓ ${s?.label || key} growth exported`);
}

/* ─── ALL GROWTH CSV ────────────────────────────────────── */
function exportAllGrowth() {
  const hdrs = ['Show','#','Name','Insta Handle','Before Show','Last Checked','Current',
    'Growth','Growth %','Total Growth','Total %'];
  let out = csvRow(hdrs);
  getShowKeys().filter(k => !isShowHidden(k)).forEach(k => {
    (window.DB[k] || []).filter(c => !isH(k, c.id)).forEach((c, i) => {
      const g1 = calcGrowth(c.follLast, c.follCur);
      const g2 = calcGrowth(c.follBefore, c.follCur);
      out += csvRow([window.SHOWS[k]?.label || k, i + 1, c.name, c.ig,
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
  let out = csvRow(hdrs);
  const all = [];
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
    `<button class="btn b-gld b-sm" onclick="capture('sw-${k}-tbl','${k}_Table')">${window.SHOWS[k].label} Table</button>
     <button class="btn b-gh b-sm" onclick="capture('gtbl-inner-${k}','${k}_Growth')">${window.SHOWS[k].label} Growth</button>
     <button class="btn b-pur b-sm admin-only" onclick="refreshFollowersLive('${k}')">${window.SHOWS[k].label} (Live)</button>`
  ).join('');
}

/* ─── SCREENSHOT / CAPTURE ──────────────────────────────── */
let _captureCanvas = null;
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

  const bg = document.getElementById('cap-modal-bg');
  const img = document.getElementById('cap-preview-img');
  const spinner = document.getElementById('cap-spinner');
  const info = document.getElementById('cap-info');
  const btns = [
    document.getElementById('cap-save-png'),
    document.getElementById('cap-save-jpg'),
    document.getElementById('cap-copy'),
    document.getElementById('cap-print'),
  ];

  img.style.display = 'none';
  spinner.style.display = 'flex';
  info.textContent = 'Generating…';
  btns.forEach(b => { if (b) b.disabled = true; });
  bg.classList.add('open');
  _captureCanvas = null;

  let hiddenAncestors = [];
  let hiddenEls = [];
  let wasHidden = false;
  let origStyle = '';
  let overflowEls = [];

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
       button were staying invisible after every capture.

       Uses display:none, NOT visibility:hidden. visibility:hidden makes
       an element invisible but leaves its box in the layout — the
       browser still reserves its full height for it. For a bar of
       admin-only controls (sort dropdown, Refresh Followers, Columns
       menu) sitting right above the table, that leftover reserved
       space is exactly the blank strip that was showing up below the
       real content in captures — worse for admins specifically because
       admin mode has more chrome in that bar to leave a gap for. */
    const seen = new Set();
    HIDE_IN_CAPTURE.forEach(sel => {
      el.querySelectorAll(sel).forEach(node => {
        if (seen.has(node)) return;
        seen.add(node);
        if (getComputedStyle(node).display !== 'none') {
          hiddenEls.push({ node, v: node.style.display });
          node.style.display = 'none';
        }
      });
    });

    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 200)));

    /* Measure the ACTUAL rendered content box, not el.scrollWidth /
       el.scrollHeight. scrollHeight measures el's own content box,
       which is not always the same thing as "how tall does the visible
       content really look" — it can include space from a child's
       collapsed/adjoining margin, a horizontal-scrollbar reservation
       from .gtbl-wrap's overflow-x:auto, or sub-pixel rounding drift
       between layout passes, none of which getBoundingClientRect() is
       vulnerable to since it reports the true painted box directly.
       This was the remaining source of the blank strip below captures
       that hiding the sort bar's chrome (the earlier fix) didn't fully
       eliminate — that fix was necessary but not sufficient. */
    /* html2canvas does not reliably paint content that overflows an
       overflow-x:auto/scroll container (e.g. .gtbl-wrap around the
       Growth table) — confirmed by direct testing: identical measured
       geometry (same fullWidth/fullHeight/x/y) produced a correctly
       painted capture when the container had been on-screen since page
       load, and a capture with the overflowing columns silently cut off
       when the SAME container had merely been hidden and re-shown just
       before capture (exactly what happens capturing a show that isn't
       the one currently on screen, e.g. from the Export panel). Setting
       overflow to visible during the capture removes the scroll-clip
       html2canvas is unreliable with entirely, instead of depending on
       it to rasterize the clipped-off portion correctly. */
    el.querySelectorAll('*').forEach(node => {
      const cs = getComputedStyle(node);
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll' ||
          cs.overflowY === 'auto' || cs.overflowY === 'scroll') {
        overflowEls.push({ node, x: node.style.overflowX, y: node.style.overflowY });
        node.style.overflowX = 'visible';
        node.style.overflowY = 'visible';
      }
    });
    {
      const cs = getComputedStyle(el);
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll' ||
          cs.overflowY === 'auto' || cs.overflowY === 'scroll') {
        overflowEls.push({ node: el, x: el.style.overflowX, y: el.style.overflowY });
        el.style.overflowX = 'visible';
        el.style.overflowY = 'visible';
      }
    }

    const elRect = el.getBoundingClientRect();
    let contentBottom = elRect.top;
    let contentRight = elRect.left;
    Array.from(el.children).forEach(child => {
      if (getComputedStyle(child).display === 'none') return;
      const r = child.getBoundingClientRect();
      if (r.bottom > contentBottom) contentBottom = r.bottom;
      if (r.right > contentRight) contentRight = r.right;
    });
    let fullWidth = Math.ceil(Math.max(contentRight - elRect.left, elRect.width));
    let fullHeight = Math.ceil(Math.max(contentBottom - elRect.top, 1));

    /* If a hidden ancestor got force-widened to 1400px above and the
       content actually needs more than that (this table does — 1529px),
       el's own box (and anything sized as a % of it, like .gtbl-title)
       stays pinned at 1400 while the table overflows past it. The crop
       width (fullWidth) already accounts for that overflow, but el's box
       itself doesn't grow to match, so a banner/background meant to
       span the full width falls short of the table's true right edge —
       visible as a blank/background-colour wedge in that top corner.
       Re-widen the forced ancestor to the now-known real content width
       and re-measure once, so el's own box (not just the crop) actually
       matches what the table needs. */
    if (hiddenAncestors.length && fullWidth > elRect.width) {
      const outer = hiddenAncestors[hiddenAncestors.length - 1].node;
      const target = fullWidth + 40;
      outer.style.setProperty('width', target + 'px', 'important');
      outer.style.setProperty('min-width', target + 'px', 'important');
      outer.style.setProperty('max-width', target + 'px', 'important');
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 100)));
      const elRect2 = el.getBoundingClientRect();
      let contentBottom2 = elRect2.top, contentRight2 = elRect2.left;
      Array.from(el.children).forEach(child => {
        if (getComputedStyle(child).display === 'none') return;
        const r = child.getBoundingClientRect();
        if (r.bottom > contentBottom2) contentBottom2 = r.bottom;
        if (r.right > contentRight2) contentRight2 = r.right;
      });
      fullWidth = Math.ceil(Math.max(contentRight2 - elRect2.left, elRect2.width));
      fullHeight = Math.ceil(Math.max(contentBottom2 - elRect2.top, 1));
    }

    // Target a genuinely 4K–8K wide output regardless of how many
    // columns happen to be visible (fewer columns = a narrower table
    // in CSS pixels, so a *fixed* multiplier like "always 6x" would
    // under- or over-shoot depending on that). Solve for the scale that
    // lands the output width at ~5760px (the midpoint of 3840–7680),
    // then clamp so it can never fall outside that 4K–8K band even for
    // an unusually narrow or wide table.
    const TARGET_WIDTH_PX = 5760;
    const MIN_SCALE = 3840 / fullWidth;
    const MAX_SCALE = 7680 / fullWidth;
    const idealScale = TARGET_WIDTH_PX / fullWidth;
    const targetScale = Math.min(Math.max(idealScale, MIN_SCALE), MAX_SCALE);

    // PNG is lossless, so there's no "quality" knob to turn — pixel
    // count is the only lever for genuinely maximum-detail captures,
    // and that's also naturally what produces a several-MB file
    // instead of a compact one (a flat-colour table like Growth would
    // otherwise compress down small even at high scale, since PNG is
    // very efficient on large solid-colour areas). Cascade down only
    // if the browser's own canvas-size ceiling is hit (mobile Safari
    // especially) — each fallback still targets the same 4K floor.
    // windowWidth/windowHeight is the virtual browser window html2canvas
    // lays the WHOLE cloned document out inside — it is not a crop size.
    // Passing fullWidth/fullHeight here (the captured element's OWN
    // natural/overflow size) used to force that entire virtual window to
    // the table's width, which reflows every flex/percentage ancestor
    // (the sidebar layout's `.content { flex: 1 1 0% }` in particular) to
    // a different size than the real page has right now. The clone then
    // renders the table at a different effective width/position than the
    // fullWidth/fullHeight box we just measured and told html2canvas to
    // crop, so the crop and the content stop lining up — the table paints
    // short of the canvas (a blank strip of the `backgroundColor` fill
    // below it) or past it (columns cut off on the right), depending on
    // which way that particular page's flex math happens to move. Confirmed
    // by forcing the window to the real page size instead: both symptoms
    // disappear.
    //
    // Fix: keep the virtual window at (at least) the real page's actual
    // size, so no ancestor reflows and el's position/size in the clone
    // matches what fullWidth/fullHeight were measured from. width/height
    // (the actual crop) still use fullWidth/fullHeight to include any
    // horizontal/vertical overflow beyond el's own visible box.
    const captureWindowWidth = Math.max(document.documentElement.scrollWidth, window.innerWidth, fullWidth);
    const captureWindowHeight = Math.max(document.documentElement.scrollHeight, window.innerHeight, fullHeight);

    let canvas, usedScale = targetScale;
    const scaleCascade = [targetScale, targetScale * 0.75, targetScale * 0.5, MIN_SCALE];
    const runCapture = (scale) => html2canvas(el, {
      backgroundColor: document.body.classList.contains('theme-light') ? '#F0F2F8' : '#08080F',
      scale,
      useCORS: true,
      logging: false,
      width: fullWidth,
      height: fullHeight,
      windowWidth: captureWindowWidth,
      windowHeight: captureWindowHeight,
      ignoreElements: node => {
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
           leans heavily on custom properties for its theme, which is
           the most likely reason it renders blank while Roster/Card
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
          cloneNode.style.color = cs.color;
          if (cs.borderTopWidth !== '0px') cloneNode.style.borderTopColor = cs.borderTopColor;
          if (cs.borderBottomWidth !== '0px') cloneNode.style.borderBottomColor = cs.borderBottomColor;
          if (cs.borderLeftWidth !== '0px') cloneNode.style.borderLeftColor = cs.borderLeftColor;
          if (cs.borderRightWidth !== '0px') cloneNode.style.borderRightColor = cs.borderRightColor;

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

    let lastErr;
    for (const s of scaleCascade) {
      try {
        canvas = await runCapture(s);
        usedScale = s;
        break;
      } catch (err) {
        lastErr = err;
        console.warn(`[Capture] ${s}x capture failed, trying next size down:`, err.message);
      }
    }
    if (!canvas) throw lastErr || new Error('Capture failed at every resolution tried');

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
    const w = canvas.width / usedScale, h = canvas.height / usedScale;
    const approxBytes = Math.round((dataURL.length - 'data:image/png;base64,'.length) * 0.75);
    const approxMB = (approxBytes / (1024 * 1024)).toFixed(1);

    img.src = dataURL;
    img.style.display = 'block';
    spinner.style.display = 'none';
    info.textContent = `${Math.round(w)} × ${Math.round(h)}px · ${usedScale}× resolution · ~${approxMB}MB`;
    btns.forEach(b => { if (b) b.disabled = false; });
    toast('✓ Preview ready. Choose Save, Copy or Print');

  } catch (e) {
    spinner.style.display = 'none';
    info.textContent = 'Failed: ' + e.message;
    toast('Capture failed: ' + e.message + '. Try Ctrl+P for PDF.', 'err');
    console.error('[Capture]', e);

  } finally {
    /* ALWAYS restore hidden chrome — even if html2canvas threw.
       This is what was making tabs/buttons disappear permanently
       after a failed capture. */
    hiddenEls.forEach(({ node, v }) => { node.style.display = v; });
    overflowEls.forEach(({ node, x, y }) => { node.style.overflowX = x; node.style.overflowY = y; });
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
    const a = document.createElement('a');
    if (fmt === 'jpg') {
      a.href = _captureCanvas.toDataURL('image/jpeg', 0.95);
      a.download = _captureFilename + '_' + date + '.jpg';
    } else {
      a.href = _captureCanvas.toDataURL('image/png');
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
        toast('✓ Image copied to clipboard. Paste anywhere');
      } catch (e) {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        toast('Clipboard blocked. Image opened in new tab (right-click to save)', 'warn');
      }
    }, 'image/png');
  } catch (e) {
    toast('Copy failed: ' + e.message, 'err');
  }
}

function printCapture() {
  if (!_captureCanvas) { toast('No capture ready', 'err'); return; }
  const dataURL = _captureCanvas.toDataURL('image/png');
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Print: Reality TV Intel</title>
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
