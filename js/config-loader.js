(function () {
  if (window.LAKESIDE_CONFIG?.supabaseUrl) {
    console.log('[Lakeside] Config loaded from local config.js');
    return;
  }
  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/config', false);
    xhr.send(null);
    if (xhr.status === 200) {
      var cfg = JSON.parse(xhr.responseText);
      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
        throw new Error('Env vars missing on Vercel');
      }
      window.LAKESIDE_CONFIG = cfg;
      console.log('[Lakeside] Config loaded from /api/config');
    } else {
      throw new Error('/api/config returned ' + xhr.status);
    }
  } catch (err) {
    console.error('[Lakeside] Config failed:', err.message);
    window.LAKESIDE_CONFIG = {};
  }
})();
