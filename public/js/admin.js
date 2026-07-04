/* ═══════════════════════════════════════════════════════════
   admin.js  —  Reality TV Intel 2026
   Server-verified admin auth.

   SECURITY MODEL CHANGE from the previous version:
   Previously, ADMIN_HASH lived in this file (a SHA-256 hash of the
   password), and any visitor could open devtools and call
   activateAdmin() directly — completely bypassing the password check,
   because the check itself never touched a server. The hash being
   visible in page source was actually the SMALLER problem; the real
   one was that the check was advisory only, not enforced anywhere.

   Now: the password is verified server-side (api/verify-admin.js)
   against process.env.ADMIN_PASSWORD, which never ships to the
   browser. On success, the server sets an httpOnly session cookie —
   JS on this page can't read or forge it, but the browser sends it
   automatically on future requests. admin-active is only ever added
   to <body> after the server confirms a valid session, both on login
   and on page load.
═══════════════════════════════════════════════════════════ */

/* ── Session check (server-verified) ─────────────────────── */
async function checkAdminSession() {
  try {
    const res = await fetch('/api/verify-admin', { method: 'GET', credentials: 'same-origin' });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.authenticated;
  } catch {
    return false; // network/API issue — fail closed, never assume admin
  }
}

/* ── Activate / deactivate admin UI ──────────────────────── */
function activateAdmin() {
  document.body.classList.add('admin-active');
  const btn = document.getElementById('admin-toggle-btn');
  if (btn) {
    btn.innerHTML = '🔓 Admin';
    btn.onclick   = deactivateAdmin;
    btn.title     = 'Click to log out of admin';
    btn.style.color       = 'var(--gld)';
    btn.style.borderColor = 'rgba(245,166,35,.4)';
  }
  const sw = document.getElementById('save-workflow');
  if (sw) sw.style.display = 'flex';
  toast('🔓 Admin mode active', 'warn');

  if (typeof rebuildSidebar     === 'function') rebuildSidebar();
  if (typeof renderOverview     === 'function') renderOverview();
  if (typeof updateStats        === 'function') updateStats();
  if (typeof renderRankings     === 'function') renderRankings();
  if (typeof renderGrowthAll    === 'function') renderGrowthAll();
  if (typeof _populateRankFilters === 'function') _populateRankFilters();
  if (typeof renderAll          === 'function') renderAll();
}

async function deactivateAdmin() {
  if (!confirm('Log out of admin mode?')) return;

  try {
    await fetch('/api/verify-admin', { method: 'DELETE', credentials: 'same-origin' });
  } catch {
    // Even if the network call fails, still clear client-side UI below —
    // worst case the cookie lingers until its own expiry (max 8h) rather
    // than the user being stuck unable to leave admin mode visually.
  }

  document.body.classList.remove('admin-active');
  editMode = false;
  const eb = document.getElementById('editBtn');
  if (eb) { eb.textContent = '✎ Edit: OFF'; eb.style.color = ''; eb.style.borderColor = ''; }
  document.body.classList.remove('edit-on');
  const btn = document.getElementById('admin-toggle-btn');
  if (btn) {
    btn.innerHTML = '🔒 Admin';
    btn.onclick   = openAdminLogin;
    btn.style.color       = '';
    btn.style.borderColor = '';
  }
  const sw = document.getElementById('save-workflow');
  if (sw) sw.style.display = 'none';
  toast('🔒 Logged out of admin mode');

  if (typeof rebuildSidebar     === 'function') rebuildSidebar();
  if (typeof renderOverview     === 'function') renderOverview();
  if (typeof updateStats        === 'function') updateStats();
  if (typeof renderRankings     === 'function') renderRankings();
  if (typeof renderGrowthAll    === 'function') renderGrowthAll();
  if (typeof _populateRankFilters === 'function') _populateRankFilters();
  if (typeof renderAll          === 'function') renderAll();
}

/* ── Login modal ──────────────────────────────────────────── */
async function openAdminLogin() {
  if (await checkAdminSession()) { activateAdmin(); return; }
  document.getElementById('admin-modal').classList.add('open');
  document.getElementById('admin-pw-input').value = '';
  document.getElementById('admin-login-err').textContent = '';
  setTimeout(() => document.getElementById('admin-pw-input').focus(), 80);
}

function closeAdminLogin() {
  document.getElementById('admin-modal').classList.remove('open');
}

async function submitAdminLogin() {
  const pw  = document.getElementById('admin-pw-input').value;
  const err = document.getElementById('admin-login-err');
  const btn = document.getElementById('admin-login-btn');

  if (!pw) { err.textContent = 'Password required.'; return; }

  btn.disabled    = true;
  btn.textContent = 'Checking…';
  err.textContent = '';

  try {
    const res  = await fetch('/api/verify-admin', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.ok) {
      closeAdminLogin();
      activateAdmin();
    } else {
      err.textContent = data.error || 'Incorrect password.';
      document.getElementById('admin-pw-input').value = '';
      document.getElementById('admin-pw-input').focus();
    }
  } catch (e) {
    err.textContent = 'Auth error: ' + e.message;
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Unlock Admin Mode';
  }
}

/* ── Enter key on password field, and session check on load ── */
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('admin-pw-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') submitAdminLogin();
  });

  if (await checkAdminSession()) {
    activateAdmin();
  }
});
