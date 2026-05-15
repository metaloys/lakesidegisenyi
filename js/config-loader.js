/**
 * Config Loader — Fetches config from Vercel API in production, uses local config in development
 * This runs before all other scripts that depend on window.LAKESIDE_CONFIG
 */

(async function initConfig() {
  // If config already loaded locally (development), don't override
  if (window.LAKESIDE_CONFIG?.supabaseUrl) {
    return;
  }

  try {
    // Try to fetch config from Vercel API (production only)
    const response = await fetch('/api/config');
    if (response.ok) {
      const config = await response.json();
      window.LAKESIDE_CONFIG = config;
      console.log('✓ Config loaded from Vercel API');
    }
  } catch (error) {
    console.warn('Could not load config from API. Make sure /api/config is deployed:', error);
  }
})();
