/** Public landing UI: scroll reveal, menu tabs, live menu from Supabase. */
(function () {

  // ── SCROLL REVEAL ──────────────────────────────────────────
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('visible');
      });
    },
    { threshold: 0.1 }
  );
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

  // ── MENU TAB SWITCHER ──────────────────────────────────────
  window.switchTab = function (name, btn) {
    document.querySelectorAll('.menu-panel').forEach((p) => p.classList.remove('active'));
    document.querySelectorAll('.menu-tab').forEach((t) => t.classList.remove('active'));
    const panel = document.getElementById('tab-' + name);
    if (panel) panel.classList.add('active');
    btn.classList.add('active');
  };

  // ── LIVE MENU FROM SUPABASE ────────────────────────────────
  async function loadMenu() {
    const tabsEl   = document.getElementById('menu-tabs');
    const panelsEl = document.getElementById('menu-panels');
    if (!tabsEl || !panelsEl) return;

    // Wait for Supabase client to be ready (config-loader is sync so this is immediate)
    if (typeof getMenuItems !== 'function') {
      tabsEl.innerHTML = '<div style="font-size:0.78rem;color:var(--text-muted);padding:0.8rem 0;">Menu unavailable.</div>';
      return;
    }

    try {
      // getMenuItems() returns all available items with category name joined
      const items = await getMenuItems();

      if (!items || items.length === 0) {
        tabsEl.innerHTML = '<div style="font-size:0.78rem;color:var(--text-muted);padding:0.8rem 0;">Menu coming soon.</div>';
        return;
      }

      // ── Group items by category ──
      const categoryMap = {};   // { categoryName: [item, ...] }
      const categoryOrder = []; // preserve order of first appearance

      items.forEach(item => {
        const cat = item.menu_categories?.name || 'Other';
        if (!categoryMap[cat]) {
          categoryMap[cat] = [];
          categoryOrder.push(cat);
        }
        categoryMap[cat].push(item);
      });

      // ── Build tab buttons ──
      tabsEl.innerHTML = categoryOrder.map((cat, i) => {
        const slug = cat.toLowerCase().replace(/[^a-z0-9]/g, '-');
        return `<button class="menu-tab${i === 0 ? ' active' : ''}"
          onclick="switchTab('${slug}', this)">${cat}</button>`;
      }).join('');
      tabsEl.classList.add('reveal');

      // ── Build panels ──
      panelsEl.innerHTML = categoryOrder.map((cat, i) => {
        const slug  = cat.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const catItems = categoryMap[cat];

        const itemsHTML = catItems.map(item => `
          <div class="menu-item">
            <div>
              <span class="menu-name">${escapeHtml(item.name)}</span>
              ${item.description
                ? `<span class="menu-desc">${escapeHtml(item.description)}</span>`
                : ''}
            </div>
            <span class="menu-price">${item.currency || 'RWF'} ${Number(item.price).toLocaleString()}</span>
          </div>`).join('');

        return `<div id="tab-${slug}"
          class="menu-panel menu-grid reveal${i === 0 ? ' active' : ''}">
          ${itemsHTML}
        </div>`;
      }).join('');

      // Observe new elements for scroll reveal
      panelsEl.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    } catch (err) {
      console.error('[Lakeside] Menu load failed:', err.message);
      tabsEl.innerHTML = '<div style="font-size:0.78rem;color:var(--text-muted);padding:0.8rem 0;">Could not load menu. Please refresh.</div>';
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Run after DOM and Supabase client are ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadMenu);
  } else {
    loadMenu();
  }

})();

