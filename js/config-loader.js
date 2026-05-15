/**
 * js/config-loader.js
 * Loads config before ANY other Lakeside script runs.
 *
 * Production: fetches from /api/config (Vercel env vars)
 * Local dev:  js/config.js already set window.LAKESIDE_CONFIG, so this is a no-op
 *
 * Uses synchronous XHR intentionally — guarantees window.LAKESIDE_CONFIG is set
 * before the next <script> tag executes. Tiny same-origin request, <5ms impact.
 */
(function () {
  // ── LOCAL DEV: config.js already set it, nothing to do ──
  if (window.LAKESIDE_CONFIG?.supabaseUrl) {
    console.log('[Lakeside] Config loaded from local config.js');
    return;
  }

  // ── PRODUCTION: fetch from /api/config synchronously ──
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/config', false); // false = synchronous
    xhr.send(null);

    if (xhr.status === 200) {
      const cfg = JSON.parse(xhr.responseText);

      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
        throw new Error('Config missing Supabase keys. Check Vercel environment variables.');
      }

      window.LAKESIDE_CONFIG = cfg;
      console.log('[Lakeside] ✓ Config loaded from /api/config');

    } else {
      throw new Error(`/api/config returned HTTP ${xhr.status}`);
    }

  } catch (err) {
    console.error('[Lakeside] Failed to load config:', err.message);

    const errEl = document.getElementById('login-err');
    if (errEl) {
      errEl.textContent = 'Site configuration error — contact the administrator.';
      errEl.style.display = 'block';
    }

    window.LAKESIDE_CONFIG = window.LAKESIDE_CONFIG || {};
  }
})();
