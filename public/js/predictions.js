/* ═══════════════════════════════════════════════════════════
   predictions.js — Reality TV Intel 2026
   Frontend for predictions.html: login state, voting, history,
   leaderboard. Countdown timers are synced to the SERVER's clock
   (via the `serverTime` field every relevant API response includes),
   never the browser's own clock — see api/_store.js submitEntry() for
   why that matters: the actual deadline enforcement is server-side
   and immune to a wrong local clock either way, but a countdown
   computed purely from the browser's clock could still *display*
   something misleading if that clock is wrong. Syncing removes even
   that cosmetic gap.
═══════════════════════════════════════════════════════════ */

let currentUser = null;
let serverTimeOffsetMs = 0; // corrected "now" = Date.now() + serverTimeOffsetMs
let openPredictions = [];
let countdownTimer = null;

function correctedNow() { return Date.now() + serverTimeOffsetMs; }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

function toast(msg, type) {
  const el = document.getElementById('pv-toast');
  el.textContent = msg;
  el.className = 'pv-toast show' + (type ? ' ' + type : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3200);
}

function toggleUserMenu() {
  document.getElementById('user-menu').classList.toggle('open');
}
document.addEventListener('click', e => {
  const menu = document.getElementById('user-menu');
  const chip = document.getElementById('user-chip');
  if (menu && !chip.contains(e.target)) menu.classList.remove('open');
});

async function logout() {
  await fetch('/api/auth/session', { method: 'DELETE', credentials: 'include' });
  location.reload();
}

/* ─── AUTH / PROFILE ─────────────────────────────────────── */
async function loadSession(attempt = 1) {
  try {
    const res = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-cache' });
    const data = await res.json();
    if (data.loggedIn) {
      currentUser = data.user;
      document.getElementById('login-btn').style.display = 'none';
      const chip = document.getElementById('user-chip');
      chip.style.display = 'flex';
      document.getElementById('user-avatar').src = currentUser.avatarUrl || '';
      document.getElementById('user-name').textContent = currentUser._degraded ? 'Loading…' : (currentUser.displayName || currentUser.login);
      await loadProfile();
    }
  } catch (err) {
    // Transient network hiccup — retry once before giving up. A
    // logged-in person should never see a "log in" prompt just
    // because one request blipped.
    if (attempt < 2) { setTimeout(() => loadSession(attempt + 1), 1200); return; }
    console.warn('[predictions] Session check failed after retry:', err.message);
  }
}

async function loadProfile(attempt = 1) {
  try {
    const res = await fetch('/api/profile', { credentials: 'include', cache: 'no-cache' });
    if (res.status === 503) {
      const data = await res.json().catch(() => ({}));
      if (data.retryable && attempt < 3) { setTimeout(() => loadProfile(attempt + 1), 1500); return; }
    }
    if (!res.ok) return;
    const data = await res.json();
    syncServerTime(data.serverTime);

    document.getElementById('profile-section').style.display = 'flex';
    document.getElementById('loggedout-prompt').style.display = 'none';
    document.getElementById('history-section').style.display = 'flex';

    document.getElementById('profile-avatar').src = data.user.avatarUrl || '';
    document.getElementById('profile-name').textContent = data.user.displayName || data.user.login;
    document.getElementById('profile-handle').textContent = '@' + data.user.login;
    if (data.user.joinedAt) {
      const joined = new Date(data.user.joinedAt);
      document.getElementById('profile-joined').textContent = 'Joined ' + joined.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    document.getElementById('profile-rank').textContent = data.stats.rank ? '#' + data.stats.rank : '—';
    document.getElementById('stat-points').textContent = data.stats.totalPoints;
    document.getElementById('stat-events').textContent = data.stats.totalEntries;
    document.getElementById('stat-correct').textContent = data.stats.correctCount;
    document.getElementById('stat-winrate').textContent = data.stats.winRate + '%';

    renderHistory(data.history);
  } catch (err) {
    console.warn('[predictions] Profile load failed:', err.message);
  }
}

function renderHistory(history) {
  const el = document.getElementById('history-list');
  if (!history.length) {
    el.innerHTML = '<div class="pv-empty">No predictions yet — pick something above to get started.</div>';
    return;
  }
  el.innerHTML = history.map(h => {
    let icon = '⏳', ptsClass = 'pv-pending', ptsText = 'Pending';
    if (h.status === 'resolved') {
      icon = h.wasCorrect ? '✓' : '✕';
      ptsClass = h.wasCorrect ? 'pv-win' : 'pv-loss';
      ptsText = h.wasCorrect ? '+' + h.pointsEarned : '0';
    }
    return `<div class="pv-history-row">
      <div class="pv-history-icon">${icon}</div>
      <div class="pv-history-body">
        <div class="pv-history-q">${escapeHtml(h.question)}</div>
        <div class="pv-history-meta">You picked <strong>${escapeHtml(h.pick)}</strong>${h.status === 'resolved' ? ' · answer: ' + escapeHtml(h.correctOption) : ' · awaiting result'}</div>
      </div>
      <div class="pv-history-pts ${ptsClass}">${ptsText}</div>
    </div>`;
  }).join('');
}

/* ─── SERVER TIME SYNC ───────────────────────────────────── */
function syncServerTime(serverTimeIso) {
  if (!serverTimeIso) return;
  serverTimeOffsetMs = new Date(serverTimeIso).getTime() - Date.now();
}

/* ─── OPEN PREDICTIONS ───────────────────────────────────── */
async function loadPredictions() {
  try {
    const res = await fetch('/api/predictions?status=open', { credentials: 'include', cache: 'no-cache' });
    const data = await res.json();
    syncServerTime(data.serverTime);
    openPredictions = data.predictions || [];
    renderPredictions();
    startCountdowns();
  } catch (err) {
    document.getElementById('open-predictions').innerHTML = '<div class="pv-empty">Couldn\'t load predictions — try refreshing.</div>';
    console.warn('[predictions] Load failed:', err.message);
  }
}

function renderPredictions() {
  const el = document.getElementById('open-predictions');
  if (!openPredictions.length) {
    el.innerHTML = '<div class="pv-empty">No open predictions right now — check back soon.</div>';
    return;
  }
  el.innerHTML = openPredictions.map(renderPredictionCard).join('');
}

// Delegated click handler for voting — options are re-rendered often
// (every poll, every vote), so binding once on the stable container
// avoids having to rebind listeners after every render.
document.getElementById('open-predictions')?.addEventListener('click', e => {
  const opt = e.target.closest('.pv-option, .pv-option-photo');
  if (!opt || opt.classList.contains('pv-disabled')) return;
  const { prediction, choice } = opt.dataset;
  if (prediction && choice !== undefined) submitVote(prediction, choice);
});

function renderPredictionCard(p) {
  const totalVotes = Object.values(p.counts || {}).reduce((a, b) => a + Number(b), 0);
  const isPhotoMode = p.displayMode === 'photo';

  const optionsHtml = p.options.map(opt => {
    const count = Number(p.counts?.[opt.value] || 0);
    const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
    const isPicked = p.myPick === opt.value;
    const classes = [isPhotoMode ? 'pv-option-photo' : 'pv-option'];
    if (isPicked) classes.push('pv-picked');
    if (!currentUser || p.myPick) classes.push('pv-disabled');

    if (isPhotoMode) {
      return `<div class="${classes.join(' ')}" data-prediction="${p.id}" data-choice="${escapeHtml(opt.value)}">
        <div class="pv-option-photo-img" style="background-image:url('${(opt.photo || '').replace(/'/g, "%27")}')"></div>
        <div class="pv-option-photo-name">${escapeHtml(opt.label)}${isPicked ? ' ✓' : ''}</div>
        <div class="pv-option-photo-pct">${pct}%</div>
      </div>`;
    }
    return `<div class="${classes.join(' ')}" data-prediction="${p.id}" data-choice="${escapeHtml(opt.value)}">
      <div class="pv-option-bar" style="width:${pct}%"></div>
      <span class="pv-option-label">${escapeHtml(opt.label)}${isPicked ? ' (your pick)' : ''}</span>
      <span class="pv-option-pct">${pct}% · ${count}</span>
    </div>`;
  }).join('');

  const hint = !currentUser
    ? 'Log in with Twitch to make a pick'
    : (p.myPick ? "You've already picked — check back after this resolves" : 'Tap an option to lock in your pick');

  return `<div class="pv-pred-card" data-card="${p.id}">
    <div class="pv-pred-top">
      <div>
        ${p.showKey ? `<div class="pv-pred-show">${escapeHtml(p.showKey)}</div>` : ''}
        <div class="pv-pred-q">${escapeHtml(p.question)}</div>
      </div>
      <div class="pv-countdown" data-closes="${p.closesAt || ''}">${p.closesAt ? '—' : 'Open'}</div>
    </div>
    <div class="${isPhotoMode ? 'pv-options-photo' : 'pv-options'}">${optionsHtml}</div>
    <div class="pv-pred-hint">${hint}</div>
  </div>`;
}

async function submitVote(predictionId, choice) {
  if (!currentUser) { toast('Log in with Twitch first', 'warn'); return; }
  const pred = openPredictions.find(p => p.id === predictionId);
  if (pred?.myPick) return; // already picked, nothing to do

  try {
    const res = await fetch('/api/predictions-entry', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ predictionId, choice }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast(data.reason || data.error || 'Could not submit your pick', 'warn');
      return;
    }
    if (pred) pred.myPick = choice;
    toast('✓ Pick locked in!');
    renderPredictions();
  } catch (err) {
    toast('Something went wrong — try again', 'warn');
    console.error('[predictions] Vote failed:', err);
  }
}

/* ─── COUNTDOWNS (server-time-synced) ────────────────────── */
function startCountdowns() {
  clearInterval(countdownTimer);
  updateCountdowns();
  countdownTimer = setInterval(updateCountdowns, 1000);
}
function updateCountdowns() {
  document.querySelectorAll('.pv-countdown[data-closes]').forEach(el => {
    const closesAt = el.dataset.closes;
    if (!closesAt) { el.textContent = 'Open'; return; }
    const remaining = new Date(closesAt).getTime() - correctedNow();
    if (remaining <= 0) {
      el.textContent = 'Closed'; el.classList.add('pv-closed'); el.classList.remove('pv-urgent');
      return;
    }
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    el.textContent = h > 0 ? `${h}h ${m}m` : (m > 0 ? `${m}m ${s}s` : `${s}s`);
    el.classList.toggle('pv-urgent', remaining < 5 * 60000); // under 5 minutes
  });
}

/* ─── LEADERBOARD ─────────────────────────────────────────── */
async function loadLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard?limit=25', { credentials: 'include', cache: 'no-cache' });
    const data = await res.json();
    renderLeaderboard(data.leaderboard || []);
  } catch (err) {
    document.getElementById('leaderboard-list').innerHTML = '<div class="pv-empty">Couldn\'t load the leaderboard.</div>';
    console.warn('[predictions] Leaderboard load failed:', err.message);
  }
}
function renderLeaderboard(rows) {
  const el = document.getElementById('leaderboard-list');
  if (!rows.length) {
    el.innerHTML = '<div class="pv-empty">No one\'s on the board yet — be the first to make a correct pick.</div>';
    return;
  }
  el.innerHTML = rows.map(r => `
    <div class="pv-lb-row ${currentUser && r.userId === currentUser.id ? 'pv-lb-me' : ''}">
      <div class="pv-lb-rank">${r.rank}</div>
      ${r.avatarUrl ? `<img class="pv-lb-avatar" src="${r.avatarUrl}" alt="">` : '<div class="pv-lb-avatar"></div>'}
      <div class="pv-lb-name">${escapeHtml(r.displayName)}</div>
      <div class="pv-lb-score">${r.score}</div>
    </div>
  `).join('');
}

/* ─── BOOT ────────────────────────────────────────────────── */
(async function boot() {
  const params = new URLSearchParams(location.search);
  if (params.get('login') === 'success') { toast('✓ Logged in with Twitch'); history.replaceState(null, '', location.pathname); }
  if (params.get('login') === 'cancelled') { toast('Login cancelled', 'warn'); history.replaceState(null, '', location.pathname); }

  await loadSession(); // must resolve first so predictions render with myPick correctly attributed
  await Promise.all([loadPredictions(), loadLeaderboard()]);
})();
