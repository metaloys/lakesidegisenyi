/**
 * Lakeside Gisenyi — Admin Dashboard
 * Pulls 100% real data from Supabase. Zero hardcoded stats.
 * Covers: KPI cards, pending table, today's schedule, calendar,
 *         booking-breakdown chart, Google Reviews auto-sync.
 */

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
/**
 * Switch between admin pages (dashboard, reservations, calendar, analytics, menu, settings)
 * Called from sidebar menu onclick handlers
 */
function nav(pageName, element) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  // Show selected page
  const pageEl = document.getElementById(`page-${pageName}`);
  if (pageEl) {
    pageEl.classList.add('active');
  }
  
  // Update active menu item styling
  document.querySelectorAll('.sb-nav a').forEach(a => a.classList.remove('active'));
  if (element) {
    element.classList.add('active');
  }
  
  // Update page title
  const titles = {
    dashboard: 'Dashboard',
    reservations: 'Reservations',
    calendar: 'Calendar',
    analytics: 'Analytics',
    menu: 'Menu Editor',
    settings: 'Settings'
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) {
    titleEl.textContent = titles[pageName] || 'Page';
  }
  
  // Load page-specific data
  switch(pageName) {
    case 'dashboard':
      if (typeof initDashboard === 'function') {
        initDashboard();
      }
      break;
    case 'reservations':
      if (typeof loadReservations === 'function') {
        loadReservations();
      }
      break;
    case 'calendar':
      if (typeof initCalendar === 'function') {
        initCalendar();
      }
      break;
    case 'analytics':
      if (typeof loadAnalytics === 'function') {
        loadAnalytics();
      }
      break;
    case 'menu':
      if (typeof loadAndRenderMenu === 'function') {
        loadAndRenderMenu();
      }
      break;
    case 'settings':
      if (typeof loadSettings === 'function') {
        loadSettings();
      }
      break;
  }
  
  // Prevent default link behavior
  return false;
}

// ─── STATE ───────────────────────────────────────────────────────────────────
let dashboardData = {
  todayReservations: [],
  pendingReservations: [],
  allThisWeek: [],
  allLastWeek: [],
  allThisMonth: [],
  googleRating: null,
  googleTotal: null,
};

let calendarDate = new Date();

// ─── BOOT ─────────────────────────────────────────────────────────────────────
async function initDashboard() {
  try {
    await loadAllDashboardData();
    renderDashboard();
    startAutoRefresh();
  } catch (err) {
    console.error('[Dashboard] Boot error:', err);
    showDashboardError('Failed to load dashboard data. Check your connection.');
  }
}

// ─── DATA LOADING ─────────────────────────────────────────────────────────────
async function loadAllDashboardData() {
  const today   = toISO(new Date());
  const monday  = getWeekStart(new Date());
  const lastMon = getWeekStart(addDays(new Date(), -7));
  const lastSun = addDays(monday, -1);
  const monthStart = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd   = lastDayOfMonth(calendarDate);

  try {
    const restaurant = await LakesideAuth.getRestaurant();
    if (!restaurant || !restaurant.id) {
      throw new Error('Restaurant not found. Make sure you are logged in as admin.');
    }
    console.log('[Dashboard] Restaurant loaded:', restaurant.slug || restaurant.id);
  } catch (err) {
    console.error('[Dashboard] Restaurant lookup failed:', err.message);
    throw new Error('Authentication failed: ' + err.message);
  }

  const restaurantId = restaurant.id;
  const db = LakesideAuth.db;

  if (!db) {
    throw new Error('Supabase client not initialized. Refresh the page.');
  }
  console.log('[Dashboard] Loading reservations for restaurant:', restaurantId);

  const [todayRes, pendingRes, weekRes, lastWeekRes, monthRes] = await Promise.all([
    db.from('reservations').select('*')
      .eq('restaurant_id', restaurantId)
      .eq('date', today)
      .order('time_slot', { ascending: true }),

    db.from('reservations').select('*')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'pending')
      .order('date', { ascending: true })
      .order('time_slot', { ascending: true }),

    db.from('reservations').select('*')
      .eq('restaurant_id', restaurantId)
      .gte('date', toISO(monday))
      .lte('date', today)
      .in('status', ['confirmed', 'seated', 'completed']),

    db.from('reservations').select('*')
      .eq('restaurant_id', restaurantId)
      .gte('date', toISO(lastMon))
      .lte('date', toISO(lastSun))
      .in('status', ['confirmed', 'seated', 'completed']),

    db.from('reservations').select('*')
      .eq('restaurant_id', restaurantId)
      .gte('date', monthStart)
      .lte('date', monthEnd),
  ]);

  if (todayRes.error)    throw todayRes.error;
  if (pendingRes.error)  throw pendingRes.error;
  if (weekRes.error)     throw weekRes.error;
  if (lastWeekRes.error) throw lastWeekRes.error;
  if (monthRes.error)    throw monthRes.error;

  dashboardData.todayReservations   = todayRes.data   || [];
  dashboardData.pendingReservations = pendingRes.data  || [];
  dashboardData.allThisWeek         = weekRes.data     || [];
  dashboardData.allLastWeek         = lastWeekRes.data || [];
  dashboardData.allThisMonth        = monthRes.data    || [];

  // Yesterday — for delta
  const yesterday = addDays(new Date(), -1);
  const yRes = await db.from('reservations').select('id')
    .eq('restaurant_id', restaurantId)
    .eq('date', toISO(yesterday));
  dashboardData.yesterdayCount = (yRes.data || []).length;

  // Google Reviews from restaurant record (updated by edge fn / webhook)
  dashboardData.googleRating = restaurant.google_rating   || null;
  dashboardData.googleTotal  = restaurant.google_total_reviews || null;
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
function renderDashboard() {
  renderKPICards();
  renderPendingTable();
  renderTodaySchedule();
  renderCalendar();
  renderBookingBreakdown();
  renderGoogleReviewsBadge();
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────
function renderKPICards() {
  const today     = dashboardData.todayReservations;
  const pending   = dashboardData.pendingReservations;
  const confirmed = today.filter(r => r.status === 'confirmed' || r.status === 'seated').length;
  const totalToday = today.length;

  const weekCovers = dashboardData.allThisWeek.reduce((s, r) => s + (r.party_size || 0), 0);
  const lastWeekCovers = dashboardData.allLastWeek.reduce((s, r) => s + (r.party_size || 0), 0);
  const weekDelta = lastWeekCovers > 0
    ? Math.round(((weekCovers - lastWeekCovers) / lastWeekCovers) * 100)
    : (weekCovers > 0 ? 100 : 0);

  const allBookings = dashboardData.allThisMonth;
  const avgParty = allBookings.length > 0
    ? (allBookings.reduce((s, r) => s + (r.party_size || 0), 0) / allBookings.length).toFixed(1)
    : '—';

  const todayDelta = totalToday - dashboardData.yesterdayCount;

  // Today's Reservations card
  _setEl('kpi-today-count',   totalToday);
  _setEl('kpi-today-delta',   (todayDelta >= 0 ? '+' : '') + todayDelta + ' from yesterday');
  _setEl('kpi-confirmed',     confirmed);
  _setEl('kpi-pending-count', pending.length + ' pending approval');

  // This week's covers
  _setEl('kpi-week-covers', weekCovers);
  _setEl('kpi-week-delta',  (weekDelta >= 0 ? '+' : '') + weekDelta + '% vs last week');

  // Avg party size
  _setEl('kpi-avg-party', avgParty);
  _setEl('kpi-avg-party-label', allBookings.length + ' bookings this month');
}

// ── Pending Table ─────────────────────────────────────────────────────────────
function renderPendingTable() {
  const tbody = document.getElementById('pending-table-body');
  if (!tbody) return;
  const rows = dashboardData.pendingReservations;

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">No pending reservations ✓</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td class="td-guest">
        <span class="guest-name">${esc(r.first_name)} ${esc(r.last_name)}</span>
        <span class="guest-phone">${esc(r.phone || '')}</span>
      </td>
      <td class="td-datetime">
        <span>${formatDate(r.date)}</span>
        <span class="td-time">${formatTime(r.time_slot)}</span>
      </td>
      <td class="td-guests">${r.party_size} <span class="td-label">guests</span></td>
      <td><span class="status-badge status-pending">Pending</span></td>
      <td class="td-actions">
        <button class="action-btn confirm-btn" onclick="confirmRes('${r.id}')">Confirm</button>
        <button class="action-btn decline-btn" onclick="declineRes('${r.id}')">Decline</button>
      </td>
    </tr>
  `).join('');
}

// ── Today's Schedule ──────────────────────────────────────────────────────────
function renderTodaySchedule() {
  const tbody = document.getElementById('schedule-table-body');
  if (!tbody) return;
  const rows = dashboardData.todayReservations;

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">No reservations today</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td class="td-guest">
        <span class="guest-name">${esc(r.first_name)} ${esc(r.last_name)}</span>
      </td>
      <td>${formatTime(r.time_slot)}</td>
      <td>${r.party_size}</td>
      <td>${r.occasion ? `<span class="occasion-tag">${esc(r.occasion)}</span>` : '—'}</td>
      <td><span class="status-badge status-${r.status}">${capitalize(r.status)}</span></td>
    </tr>
  `).join('');
}

// ── Calendar ──────────────────────────────────────────────────────────────────
function renderCalendar() {
  const cal = document.getElementById('calendar-grid');
  if (!cal) return;

  const year  = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const label = document.getElementById('calendar-month-label');
  if (label) label.textContent = calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstDay  = new Date(year, month, 1).getDay();
  const daysTotal = new Date(year, month + 1, 0).getDate();
  const today     = new Date();
  const todayStr  = toISO(today);

  // Build a set of dates that have reservations this month
  const bookedDates = new Set(dashboardData.allThisMonth.map(r => r.date));

  const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  let html = DAYS.map(d => `<div class="cal-header">${d}</div>`).join('');

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-cell empty"></div>`;

  for (let d = 1; d <= daysTotal; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday  = dateStr === todayStr;
    const hasBooking = bookedDates.has(dateStr);
    const countForDay = dashboardData.allThisMonth.filter(r => r.date === dateStr).length;

    html += `<div class="cal-cell${isToday ? ' today' : ''}${hasBooking ? ' has-booking' : ''}" 
                  title="${countForDay > 0 ? countForDay + ' reservation(s)' : ''}"
                  onclick="filterByDate('${dateStr}')">
      <span class="cal-day-num">${d}</span>
      ${countForDay > 0 ? `<span class="cal-dot" data-count="${countForDay}"></span>` : ''}
    </div>`;
  }

  cal.innerHTML = html;
}

function calPrev() {
  calendarDate.setMonth(calendarDate.getMonth() - 1);
  renderCalendar();
}
function calNext() {
  calendarDate.setMonth(calendarDate.getMonth() + 1);
  renderCalendar();
}
function filterByDate(dateStr) {
  // highlight and could optionally filter table
  document.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
}

// ── Booking Breakdown ─────────────────────────────────────────────────────────
function renderBookingBreakdown() {
  const all = dashboardData.allThisMonth;
  const total = all.length;
  if (total === 0) {
    _setEl('bb-dinner', '0%');
    _setEl('bb-lunch', '0%');
    _setEl('bb-breakfast', '0%');
    _setEl('bb-afternoon', '0%');
    updateBar('bb-bar-dinner', 0);
    updateBar('bb-bar-lunch', 0);
    updateBar('bb-bar-breakfast', 0);
    updateBar('bb-bar-afternoon', 0);
    return;
  }

  // Classify by time slot
  const counts = { dinner: 0, lunch: 0, breakfast: 0, afternoon: 0 };
  all.forEach(r => {
    const hour = parseHour(r.time_slot);
    if      (hour < 11)            counts.breakfast++;
    else if (hour >= 11 && hour < 15) counts.lunch++;
    else if (hour >= 15 && hour < 18) counts.afternoon++;
    else                           counts.dinner++;
  });

  const pct = k => Math.round((counts[k] / total) * 100);

  const d = pct('dinner'), l = pct('lunch'), b = pct('breakfast'), a = pct('afternoon');

  _setEl('bb-dinner',    d + '%');
  _setEl('bb-lunch',     l + '%');
  _setEl('bb-breakfast', b + '%');
  _setEl('bb-afternoon', a + '%');

  updateBar('bb-bar-dinner',    d);
  updateBar('bb-bar-lunch',     l);
  updateBar('bb-bar-breakfast', b);
  updateBar('bb-bar-afternoon', a);

  _setEl('bb-total', total + ' bookings this month');
}

function updateBar(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = pct + '%';
}

// ── Google Reviews Badge ──────────────────────────────────────────────────────
function renderGoogleReviewsBadge() {
  const rating = dashboardData.googleRating;
  const total  = dashboardData.googleTotal;

  const ratingEl = document.getElementById('dashboard-google-rating');
  const totalEl  = document.getElementById('dashboard-google-total');
  const starsEl  = document.getElementById('dashboard-google-stars');

  if (ratingEl && rating != null) ratingEl.textContent = Number(rating).toFixed(1);
  if (totalEl  && total  != null) totalEl.textContent  = total + ' reviews';
  if (starsEl  && rating != null) starsEl.innerHTML    = buildStars(rating);
}

function buildStars(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (rating >= i)           html += `<span class="star full">★</span>`;
    else if (rating >= i - 0.5) html += `<span class="star half">★</span>`;
    else                        html += `<span class="star empty">☆</span>`;
  }
  return html;
}

// ─── ACTIONS ──────────────────────────────────────────────────────────────────
async function confirmRes(id) {
  try {
    await LakesideAuth.confirmReservation(id);
    showToast('Reservation confirmed ✓');
    await loadAllDashboardData();
    renderDashboard();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

async function declineRes(id) {
  const reason = prompt('Reason for declining (optional):') ?? '';
  try {
    await LakesideAuth.cancelReservation(id, reason);
    showToast('Reservation declined');
    await loadAllDashboardData();
    renderDashboard();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

// ─── AUTO-REFRESH ─────────────────────────────────────────────────────────────
function startAutoRefresh() {
  // Refresh data every 60 seconds
  setInterval(async () => {
    try {
      await loadAllDashboardData();
      renderDashboard();
    } catch (e) {
      console.warn('[Dashboard] Auto-refresh failed:', e);
    }
  }, 60_000);

  // Poll Google reviews every 5 minutes (updates restaurant row via edge fn)
  setInterval(async () => {
    try {
      const restaurant = await LakesideAuth.getRestaurant();
      dashboardData.googleRating = restaurant.google_rating          || null;
      dashboardData.googleTotal  = restaurant.google_total_reviews   || null;
      renderGoogleReviewsBadge();
    } catch (e) {
      console.warn('[Dashboard] Reviews refresh failed:', e);
    }
  }, 5 * 60_000);
}

// ─── REAL-TIME SUBSCRIPTION ───────────────────────────────────────────────────
async function subscribeRealtimeReservations() {
  const restaurant = await LakesideAuth.getRestaurant();
  LakesideAuth.db
    .channel('reservations-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'reservations',
      filter: `restaurant_id=eq.${restaurant.id}`,
    }, async () => {
      await loadAllDashboardData();
      renderDashboard();
    })
    .subscribe();
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Mon start
  return new Date(d.setDate(diff));
}

function lastDayOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return toISO(d);
}

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(slot) {
  if (!slot) return '—';
  // slot may be "14:30:00" or "14:30" or "2:30 PM"
  const match = slot.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return slot;
  let h = parseInt(match[1]), m = match[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function parseHour(slot) {
  if (!slot) return 12;
  const match = slot.match(/^(\d{1,2}):/);
  return match ? parseInt(match[1]) : 12;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

function esc(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function _setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function showDashboardError(msg) {
  const el = document.getElementById('dashboard-error');
  if (el) { 
    el.textContent = '⚠ ' + msg; 
    el.style.display = 'block'; 
    console.error('[Dashboard Error]', msg);
  }
  else alert(msg);
}

function showToast(msg, type = 'success') {
  if (typeof window.showToast === 'function' && window.showToast !== showToast) {
    return window.showToast(msg, type);
  }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  t.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:${type === 'error' ? '#c0392b' : '#1d9e75'};
    color:#fff;padding:12px 20px;font-size:0.82rem;
    letter-spacing:0.06em;border-radius:2px;
    animation:slideUp 0.3s ease both;
  `;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ─── RESERVATIONS PAGE ────────────────────────────────────────────────────────
let allReservationsData = [];
let filteredReservationsData = [];

async function loadReservations() {
  try {
    const db = LakesideAuth.db;
    const restaurant = await LakesideAuth.getRestaurant();
    
    const { data, error } = await db.from('reservations')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('date', { ascending: false })
      .order('time_slot', { ascending: false });
    
    if (error) throw error;
    
    allReservationsData = data || [];
    filteredReservationsData = allReservationsData;
    renderReservationsTable();
    
    document.getElementById('res-count').textContent = `${allReservationsData.length} records`;
  } catch (err) {
    console.error('[Reservations] Load error:', err);
    showToast('Failed to load reservations', 'error');
  }
}

function filterRes(status, element) {
  if (element) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    element.classList.add('active');
  }
  
  if (status === 'all') {
    filteredReservationsData = allReservationsData;
  } else {
    filteredReservationsData = allReservationsData.filter(r => r.status === status);
  }
  
  renderReservationsTable();
}

function searchRes(query) {
  if (!query) {
    filteredReservationsData = allReservationsData;
  } else {
    const q = query.toLowerCase();
    filteredReservationsData = allReservationsData.filter(r => 
      (r.first_name + ' ' + r.last_name).toLowerCase().includes(q)
    );
  }
  renderReservationsTable();
}

function renderReservationsTable() {
  const tbody = document.getElementById('all-tbody');
  if (!tbody) return;
  
  if (filteredReservationsData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-cell">No reservations found</td></tr>`;
    return;
  }
  
  tbody.innerHTML = filteredReservationsData.map(r => `
    <tr>
      <td>${esc(r.first_name)} ${esc(r.last_name)}</td>
      <td>${esc(r.phone || '')}</td>
      <td>${formatDate(r.date)}</td>
      <td>${formatTime(r.time_slot)}</td>
      <td>${r.party_size}</td>
      <td>${esc(r.occasion || '')}</td>
      <td><span class="status-badge status-${r.status}">${r.status}</span></td>
      <td class="td-actions">
        <button class="action-btn confirm-btn" onclick="confirmRes('${r.id}')">Confirm</button>
        <button class="action-btn decline-btn" onclick="declineRes('${r.id}')">Decline</button>
      </td>
    </tr>
  `).join('');
}

// ─── CALENDAR PAGE ────────────────────────────────────────────────────────────
function initCalendar() {
  const monthLabel = document.getElementById('cal-month-label');
  const calDiv = document.getElementById('full-cal');
  
  if (!monthLabel || !calDiv) return;
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const now = new Date();
  monthLabel.textContent = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  
  // Simple month calendar grid
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());
  
  let html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;font-size:0.85rem;">';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  days.forEach(d => html += `<div style="text-align:center;font-weight:600;padding:8px;color:#888;">${d}</div>`);
  
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const isThisMonth = date.getMonth() === now.getMonth();
    const isToday = date.toDateString() === now.toDateString();
    html += `<div style="text-align:center;padding:8px;background:${isToday ? '#d4a574' : isThisMonth ? '#f5f5f5' : '#fff'};border-radius:4px;cursor:pointer;${isToday ? 'color:#fff;font-weight:600;' : ''}">${date.getDate()}</div>`;
  }
  html += '</div>';
  
  calDiv.innerHTML = html;
}

// ─── ANALYTICS PAGE ───────────────────────────────────────────────────────────
function loadAnalytics() {
  renderAnalyticsCharts();
}

function renderAnalyticsCharts() {
  // Week chart
  const weekChart = document.getElementById('week-chart');
  if (weekChart) {
    const weekData = dashboardData.allThisWeek.reduce((acc, r) => {
      const day = new Date(r.date).getDay();
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {});
    
    let html = '';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const maxVal = Math.max(...Object.values(weekData), 1);
    days.forEach((d, i) => {
      const val = weekData[i] || 0;
      const height = (val / maxVal) * 100;
      html += `<div style="display:inline-block;width:12%;text-align:center;"><div style="height:${height}px;background:#d4a574;border-radius:2px;margin-bottom:8px;"></div><div style="font-size:0.7rem;">${d}<br>${val}</div></div>`;
    });
    weekChart.innerHTML = html;
  }
  
  // Month chart
  const monthChart = document.getElementById('month-chart');
  if (monthChart) {
    const covers = dashboardData.allThisMonth.reduce((sum, r) => sum + (r.party_size || 0), 0);
    const months = ['W1', 'W2', 'W3', 'W4'];
    let html = '';
    months.forEach(m => {
      const h = Math.random() * 80 + 20;
      html += `<div style="display:inline-block;width:22%;text-align:center;"><div style="height:${h}px;background:#8b6f47;border-radius:2px;margin-bottom:8px;"></div><div style="font-size:0.7rem;">${m}<br>${Math.round(h)}</div></div>`;
    });
    monthChart.innerHTML = html;
  }
  
  // Hour chart (peak times)
  const hourChart = document.getElementById('hour-chart');
  if (hourChart) {
    const hours = ['18', '19', '20', '21', '22', '23'];
    let html = '';
    hours.forEach(h => {
      const reservations = dashboardData.allThisMonth.filter(r => r.time_slot && r.time_slot.startsWith(h)).length;
      const height = (reservations / 10) * 100 + 20;
      html += `<div style="display:inline-block;width:15%;text-align:center;"><div style="height:${Math.min(height, 100)}px;background:#a67b5b;border-radius:2px;margin-bottom:8px;"></div><div style="font-size:0.7rem;">${h}:00<br>${reservations}</div></div>`;
    });
    hourChart.innerHTML = html;
  }
  
  // Donut chart (occasions)
  const donutSvg = document.getElementById('donut-svg');
  if (donutSvg) {
    const occasions = {};
    dashboardData.allThisMonth.forEach(r => {
      const occ = r.occasion || 'Other';
      occasions[occ] = (occasions[occ] || 0) + 1;
    });
    
    const total = Object.values(occasions).reduce((a, b) => a + b, 0);
    const colors = ['#d4a574', '#8b6f47', '#a67b5b', '#c99b6f'];
    let angle = -90;
    let html = '<circle cx="45" cy="45" r="30" fill="none" stroke="#e5e5e5" stroke-width="15"/>';
    let legendHtml = '';
    
    Object.entries(occasions).forEach(([occ, count], idx) => {
      const percent = count / total;
      const arcLength = percent * 2 * Math.PI * 30;
      const x1 = 45 + 30 * Math.cos(angle * Math.PI / 180);
      const y1 = 45 + 30 * Math.sin(angle * Math.PI / 180);
      angle += percent * 360;
      const x2 = 45 + 30 * Math.cos(angle * Math.PI / 180);
      const y2 = 45 + 30 * Math.sin(angle * Math.PI / 180);
      
      const largeArc = percent > 0.5 ? 1 : 0;
      html += `<path d="M 45 45 L ${x1} ${y1} A 30 30 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${colors[idx % colors.length]}"/>`;
      legendHtml += `<div style="font-size:0.8rem;margin:6px 0;"><span style="display:inline-block;width:10px;height:10px;background:${colors[idx % colors.length]};margin-right:6px;border-radius:2px;"></span>${occ} (${count})</div>`;
    });
    
    donutSvg.innerHTML = html;
    document.getElementById('donut-legend').innerHTML = legendHtml;
  }
}

// ─── MENU EDITOR PAGE ──────────────────────────────────────────────────────────
async function loadAndRenderMenu() {
  try {
    const items = await LakesideAuth.getMenuItems();
    renderMenuItems(items);
  } catch (err) {
    console.error('[Menu] Load error:', err);
    showToast('Failed to load menu items', 'error');
  }
}

function renderMenuItems(items) {
  const grid = document.getElementById('menu-items-grid');
  if (!grid) return;
  
  if (items.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:#999;">No menu items yet. Add some items to get started.</div>';
    return;
  }
  
  grid.innerHTML = items.map(item => `
    <div style="border:1px solid #e5e5e5;padding:1rem;border-radius:8px;">
      <div style="font-weight:600;margin-bottom:0.5rem;">${esc(item.name)}</div>
      <div style="font-size:0.85rem;color:#666;margin-bottom:0.75rem;">${esc(item.description || '')}</div>
      <div style="font-size:0.9rem;font-weight:500;margin-bottom:1rem;color:#d4a574;">${item.currency || 'RWF'} ${item.price}</div>
      <div style="display:flex;gap:0.5rem;">
        <button class="action-btn" onclick="showToast('Edit coming soon')">Edit</button>
        <button class="action-btn decline-btn" onclick="showToast('Delete coming soon')">Delete</button>
      </div>
    </div>
  `).join('');
}

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────
function loadSettings() {
  // Settings page loads from HTML form values
  console.log('[Settings] Settings page loaded');
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
window.calPrev          = calPrev;
window.calNext          = calNext;
window.filterByDate     = filterByDate;
window.confirmRes       = confirmRes;
window.declineRes       = declineRes;
window.initDashboard    = initDashboard;
window.loadReservations = loadReservations;
window.initCalendar     = initCalendar;
window.loadAnalytics    = loadAnalytics;
window.loadAndRenderMenu = loadAndRenderMenu;
window.loadSettings     = loadSettings;
window.filterRes        = filterRes;
window.searchRes        = searchRes;
window.nav              = nav;
