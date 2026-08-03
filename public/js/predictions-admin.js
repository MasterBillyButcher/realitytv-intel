/* ═══════════════════════════════════════════════════════════
   predictions-admin.js — Reality TV Intel 2026
   Admin panel logic for creating and managing predictions. Lets the
   admin pick a show, then pick contestants from that show's actual
   roster (window.DB, already loaded by dataloader.js) as prediction
   options — instead of typing names by hand, which would drift out
   of sync with the real roster (wrong spelling, missing photos,
   elimination status not reflected, etc).
═══════════════════════════════════════════════════════════ */

let pfSelectedOptions = []; // [{value, label, photo}]

function populatePredictionShowDropdown() {
  const sel = document.getElementById('pf-show');
  if (!sel || !window.SHOWS) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">— choose a show —</option>' +
    Object.keys(window.SHOWS).map(k => `<option value="${k}">${sanitizeHTML(window.SHOWS[k].label || k)}</option>`).join('');
  if (current) sel.value = current;
}

function onPredictionShowChange() {
  const showKey = document.getElementById('pf-show').value;
  const picker = document.getElementById('pf-contestant-picker');
  if (!showKey) {
    picker.innerHTML = '<span style="color:var(--mut);font-size:12px">Choose a show to see its contestants</span>';
    return;
  }
  const contestants = (window.DB[showKey] || []).filter(c => !isH(showKey, c.id)); // active (non-hidden) only, matches Growth's "active" scoping
  if (!contestants.length) {
    picker.innerHTML = '<span style="color:var(--mut);font-size:12px">No active contestants in this show</span>';
    return;
  }
  picker.innerHTML = contestants.map(c => {
    const isSelected = pfSelectedOptions.some(o => o.value === c.name);
    return `<div class="pf-contestant-chip ${isSelected ? 'pf-chip-selected' : ''}" data-name="${sanitizeHTML(c.name)}" onclick="togglePredictionContestant('${showKey}', ${c.id})">
      ${contestantAvatarImgTag(c)}
      <span>${sanitizeHTML(c.name)}</span>
    </div>`;
  }).join('');
}

/** Small inline <img>, not the full contestantAvatar() fallback markup
 * used elsewhere — this picker needs a plain image tag it can size
 * itself, and a broken photo here just means no photo, not a big deal
 * in a compact chip. */
function contestantAvatarImgTag(c) {
  const photo = String(c.photo || '').trim();
  if (!photo) return '';
  return `<img src="${photo.replace(/"/g, '&quot;')}" alt="" onerror="this.remove()">`;
}

function togglePredictionContestant(showKey, contestantId) {
  const c = (window.DB[showKey] || []).find(x => x.id === contestantId);
  if (!c) return;
  const idx = pfSelectedOptions.findIndex(o => o.value === c.name);
  if (idx > -1) {
    pfSelectedOptions.splice(idx, 1);
  } else {
    pfSelectedOptions.push({ value: c.name, label: c.name, photo: String(c.photo || '').trim() });
  }
  onPredictionShowChange();
  renderSelectedOptions();
}

function renderSelectedOptions() {
  const el = document.getElementById('pf-selected-options');
  if (!pfSelectedOptions.length) { el.innerHTML = '<span style="color:var(--mut);font-size:11px">No options selected yet</span>'; return; }
  el.innerHTML = pfSelectedOptions.map((o, i) => `
    <div class="pf-selected-chip">
      <span>${sanitizeHTML(o.label)}</span>
      <button onclick="removeSelectedOption(${i})" aria-label="Remove ${sanitizeHTML(o.label)}">✕</button>
    </div>
  `).join('');
}

function removeSelectedOption(index) {
  pfSelectedOptions.splice(index, 1);
  renderSelectedOptions();
  onPredictionShowChange(); // re-sync chip highlighting in the contestant picker
}

document.addEventListener('DOMContentLoaded', () => {
  const customInput = document.getElementById('pf-custom-option');
  if (customInput) {
    customInput.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const val = customInput.value.trim();
      if (!val) return;
      if (pfSelectedOptions.some(o => o.value === val)) { toast('That option is already added', 'warn'); return; }
      pfSelectedOptions.push({ value: val, label: val, photo: '' });
      customInput.value = '';
      renderSelectedOptions();
    });
  }
});

async function createPredictionFromForm() {
  const question = document.getElementById('pf-question').value.trim();
  const displayMode = document.getElementById('pf-displaymode').value;
  const showKey = document.getElementById('pf-show').value;
  const closesAtLocal = document.getElementById('pf-closesat').value;
  const pointsValue = Number(document.getElementById('pf-points').value) || 10;

  if (!question) { toast('Question is required', 'warn'); return; }
  if (pfSelectedOptions.length < 2) { toast('Add at least 2 options', 'warn'); return; }
  if (displayMode === 'photo' && pfSelectedOptions.some(o => !o.photo)) {
    toast('Photo mode needs every option to have a photo — custom text options can\'t use photo mode', 'warn');
    return;
  }

  const closesAt = closesAtLocal ? new Date(closesAtLocal).toISOString() : '';

  try {
    const res = await fetch('/api/predictions', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, options: pfSelectedOptions, showKey, closesAt, pointsValue, displayMode }),
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Failed to create prediction', 'warn'); return; }

    toast('✓ Prediction created — live immediately');
    document.getElementById('pf-question').value = '';
    pfSelectedOptions = [];
    renderSelectedOptions();
    loadAdminPredictions('open');
  } catch (err) {
    toast('Failed to create prediction — ' + err.message, 'warn');
  }
}

/* ─── MANAGE EXISTING ────────────────────────────────────── */
async function loadAdminPredictions(status) {
  const el = document.getElementById('admin-predictions-list');
  el.innerHTML = '<div style="color:var(--mut);font-size:12px">Loading…</div>';
  try {
    const res = await fetch('/api/predictions?status=' + status, { credentials: 'include', cache: 'no-cache' });
    const data = await res.json();
    const predictions = data.predictions || [];
    if (!predictions.length) { el.innerHTML = '<div style="color:var(--mut);font-size:12px">Nothing here.</div>'; return; }

    el.innerHTML = predictions.map(p => {
      const totalVotes = Object.values(p.counts || {}).reduce((a, b) => a + Number(b), 0);
      const optsHtml = p.options.map(o => {
        const count = Number(p.counts?.[o.value] || 0);
        const isCorrect = p.correctOption === o.value;
        const label = `${sanitizeHTML(o.label)} (${count})`;
        if (status === 'open') {
          return `<span class="pf-admin-opt-btn" style="cursor:default">${label}</span>`;
        }
        if (status === 'closed') {
          return `<button class="pf-admin-opt-btn" onclick="resolveAdminPrediction('${p.id}','${o.value.replace(/'/g, "&#39;")}', this)">${label} → mark correct</button>`;
        }
        return `<span class="pf-admin-opt-btn ${isCorrect ? 'pf-was-correct' : ''}">${label}${isCorrect ? ' ✓' : ''}</span>`;
      }).join('');

      const actionBtn = status === 'open'
        ? `<button class="btn b-gh b-sm" onclick="closeAdminPrediction('${p.id}')">🔒 Close voting</button>`
        : '';

      return `<div class="pf-admin-pred-card">
        <div class="pf-admin-pred-q">${sanitizeHTML(p.question)}</div>
        <div class="pf-admin-pred-meta">${sanitizeHTML(window.SHOWS[p.showKey]?.label || p.showKey || 'General')} · ${totalVotes} votes · ${p.pointsValue} pts${p.closesAt ? ' · closes ' + new Date(p.closesAt).toLocaleString() : ''}</div>
        <div class="pf-admin-pred-opts">${optsHtml}</div>
        ${actionBtn}
      </div>`;
    }).join('');
  } catch (err) {
    el.innerHTML = '<div style="color:var(--red);font-size:12px">Failed to load — ' + err.message + '</div>';
  }
}

async function closeAdminPrediction(id) {
  if (!confirm('Close voting on this prediction? No more picks will be accepted.')) return;
  try {
    const res = await fetch('/api/predictions-admin', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'close' }),
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Failed to close', 'warn'); return; }
    toast('✓ Voting closed');
    loadAdminPredictions('open');
  } catch (err) {
    toast('Failed — ' + err.message, 'warn');
  }
}

async function resolveAdminPrediction(id, correctOption, btnEl) {
  const label = btnEl?.textContent || correctOption;
  if (!confirm(`Mark "${label}" as the correct answer? This scores every matching entry and can't be undone.`)) return;
  try {
    const res = await fetch('/api/predictions-admin', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'resolve', correctOption }),
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Failed to resolve', 'warn'); return; }
    toast(`✓ Resolved — ${data.winners.length} of ${data.totalEntries} entries scored`);
    loadAdminPredictions('closed');
  } catch (err) {
    toast('Failed — ' + err.message, 'warn');
  }
}
