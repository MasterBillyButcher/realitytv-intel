/* ═══════════════════════════════════════════════════════════
   utils.js  —  Reality TV Intel 2026
   Sanitization · Validation · Debounce · Throttle
   Loaded first — zero dependencies.
═══════════════════════════════════════════════════════════ */

/* ─── ACCESSIBILITY: keyboard support for sidebar nav ──────
   .sb-item elements are plain <div onclick> — not reachable by
   Tab and not activatable by Enter/Space with a screen reader or
   keyboard-only navigation. Rather than editing every place app.js
   generates these (static HTML + rebuildSidebar + mobile nav), a
   MutationObserver tags any .sb-item that appears, and a single
   delegated keydown listener activates focused items on Enter/Space. */
function _makeSbItemAccessible(el) {
  if (el.hasAttribute('data-a11y-bound')) return;
  el.setAttribute('data-a11y-bound', '1');
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.sb-item').forEach(_makeSbItemAccessible);

  const observer = new MutationObserver(muts => {
    muts.forEach(m => m.addedNodes.forEach(node => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.classList?.contains('sb-item')) _makeSbItemAccessible(node);
      node.querySelectorAll?.('.sb-item').forEach(_makeSbItemAccessible);
    }));
  });
  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('sb-item')) {
      e.preventDefault();
      e.target.click();
    }
  });
});

/* ─── SANITIZE ──────────────────────────────────────────── */

/** Escape raw string for safe innerHTML insertion. */
function sanitizeHTML(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/** Sanitize rich-text HTML (used for contestant bio content) that is
 * EXPECTED to contain a small set of safe formatting tags — <p>, <ul>,
 * <li>, <strong>, <em> — generated at data-authoring time.
 *
 * This is deliberately NOT the same as sanitizeHTML() above, which
 * escapes every tag and would turn intentional formatting into visible
 * literal text like "&lt;strong&gt;". Bio content is admin-authored
 * (baked into data.js, which only the site owner pushes to GitHub),
 * so the realistic threat isn't a random visitor injecting a payload —
 * it's defense in depth in case data.js content is ever pasted in from
 * an untrusted source, or a future feature lets bios be edited more
 * directly. Either way: allowlist the tags we actually generate,
 * strip everything else (script, iframe, style, on* handlers,
 * javascript: URLs), rather than trusting the content wholesale.
 */
function sanitizeBioHTML(html) {
  if (!html) return '';
  const ALLOWED_TAGS = new Set(['P', 'UL', 'LI', 'STRONG', 'EM', 'BR']);

  const container = document.createElement('div');
  container.innerHTML = String(html);

  function clean(node) {
    // Walk a static snapshot since we mutate (remove) nodes as we go.
    Array.from(node.childNodes).forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) return; // plain text is always safe

      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove(); // comments, etc.
        return;
      }

      if (!ALLOWED_TAGS.has(child.tagName)) {
        // Not an allowed tag (script, iframe, img, a, div, span, style, ...).
        // Keep its text content (so legitimate text isn't silently lost)
        // but drop the tag itself and anything it could execute.
        const text = document.createTextNode(child.textContent || '');
        child.replaceWith(text);
        return;
      }

      // Allowed tag — strip EVERY attribute (removes onclick, style,
      // href="javascript:...", id, class, everything) since none of
      // our generated markup ever needs attributes on these tags.
      Array.from(child.attributes).forEach(attr => child.removeAttribute(attr.name));

      clean(child); // recurse into children
    });
  }

  clean(container);
  return container.innerHTML;
}

/** Sanitize a subset of fields on an object in one call. */
function sanitizeObject(obj, allowedFields) {
  const out = {};
  allowedFields.forEach(f => { out[f] = sanitizeHTML(obj[f] ?? ''); });
  return out;
}

/** Escape special regex characters. */
function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Strip characters unsafe in filenames. */
function sanitizeFilename(str) {
  return String(str || 'file').replace(/[^a-z0-9_\-]/gi, '_').replace(/_+/g, '_');
}

/* ─── VALIDATION ────────────────────────────────────────── */

const VALID_STATUSES = [
  'CONFIRMED', 'RUMOURED', 'APPROACHED', 'REPORTEDLY CONFIRMED', 'WITHDRAWN',
  'ELIMINATED', 'WILDCARD'
];
const VALID_GENDERS = ['M', 'F', 'NB', 'O', 'Unknown'];

/**
 * Validate a contestant data object.
 * Returns an array of human-readable errors (empty = valid).
 */
function validateContestant(data) {
  const errors = [];
  const name = (data.name || '').trim();

  if (!name)            errors.push('Name is required.');
  if (name.length > 120) errors.push('Name must be 120 characters or fewer.');

  if (data.gender && !VALID_GENDERS.includes(data.gender))
    errors.push('Gender must be M, F, NB, O, or Unknown.');

  if (data.status && !VALID_STATUSES.some(s => data.status.toUpperCase().includes(s.split(' ')[0])))
    errors.push('Status must be CONFIRMED, RUMOURED, APPROACHED, REPORTEDLY CONFIRMED, or WITHDRAWN.');

  if (data.ig && data.ig !== 'N/V') {
    const handle = String(data.ig).replace(/^@/, '').trim();
    if (!/^[\w.]{1,30}$/.test(handle))
      errors.push('Instagram handle looks invalid (letters, numbers, dots, underscores, max 30 chars).');
  }

  if (data.photo && data.photo.trim()) {
    const p = data.photo.trim();
    if (!/^(https?:\/\/|data:image\/)/.test(p))
      errors.push('Photo must be an http/https URL or a data: URI.');
  }

  ['follBefore', 'follLast', 'follCur'].forEach(f => {
    if (data[f] && data[f] !== 'N/V' && !isValidFollowerCount(data[f]))
      errors.push(`${f}: "${data[f]}" is not a valid count (e.g. 1.2M, 450K, N/V).`);
  });

  return errors;
}

/**
 * Validate a show data object.
 * Returns an array of error strings.
 */
function validateShow(data) {
  const errors = [];
  if (!String(data.label || '').trim())  errors.push('Show name is required.');
  if (!String(data.key   || '').trim())  errors.push('Show key is required.');
  else if (!/^[a-z0-9]+$/i.test(data.key)) errors.push('Show key must be letters and numbers only.');
  if (data.color && !/^#[0-9a-f]{3,6}$/i.test(data.color))
    errors.push('Accent colour must be a valid hex like #E53E6A.');
  return errors;
}

/** @returns {boolean} */
function isValidFollowerCount(value) {
  if (!value || value === 'N/V') return true;
  return /^[\d.,]+[KMBkmb]?$/.test(String(value).trim().replace(/\s/g, ''));
}

/** @returns {boolean} */
function isValidDate(value) {
  if (!value) return true;
  return !isNaN(Date.parse(value));
}

/* ─── DEBOUNCE / THROTTLE ───────────────────────────────── */

/**
 * Returns a debounced version of func (fires after `wait` ms silence).
 */
function debounce(func, wait) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Returns a throttled version of func (fires at most once per `limit` ms).
 */
function throttle(func, limit) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      func.apply(this, args);
    }
  };
}
