/**
 * Consolidated Supabase client for public site and admin dashboard.
 * Replaces both lakeside-supabase.js and old supabase-client.js.
 * Requires: Supabase CDN + js/config.js loaded first.
 */
(function () {
  const cfg = window.LAKESIDE_CONFIG;
  if (!cfg?.supabaseUrl || !cfg?.supabaseAnonKey) {
    console.error('[Lakeside] Missing supabaseUrl / supabaseAnonKey in js/config.js');
    return;
  }
  if (typeof supabase === 'undefined') {
    console.error('[Lakeside] Load @supabase/supabase-js before supabase-client.js');
    return;
  }

  const db = supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const RESTAURANT_SLUG = 'lakeside-gisenyi';
  const STAFF_ROLES = ['owner', 'manager', 'staff', 'super_admin'];

  // ============================================================
  //  RESTAURANT
  // ============================================================
  
  async function getRestaurant() {
    const { data, error } = await db
      .from('restaurants')
      .select('*')
      .eq('slug', RESTAURANT_SLUG)
      .single();
    if (error) throw error;
    return data;
  }

  // ============================================================
  //  RESERVATIONS — Public Website (Booking Form)
  // ============================================================

  async function submitReservation(formData) {
    // Call serverless function instead of direct Supabase insert
    // This uses the service role key on the server (more secure)
    const response = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create reservation');
    }

    return await response.json();
  }

  // ============================================================
  //  RESERVATIONS — Admin Dashboard
  // ============================================================

  async function getReservations(filters = {}) {
    const restaurant = await getRestaurant();
    let query = db
      .from('reservations')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('date', { ascending: true })
      .order('time_slot', { ascending: true });

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    if (filters.date) {
      query = query.eq('date', filters.date);
    }
    if (filters.from) {
      query = query.gte('date', filters.from);
    }
    if (filters.to) {
      query = query.lte('date', filters.to);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async function getTodaysReservations() {
    const { data, error } = await db
      .from('v_todays_reservations')
      .select('*');
    if (error) throw error;
    return data;
  }

  async function getPendingReservations() {
    const { data, error } = await db
      .from('v_pending_reservations')
      .select('*');
    if (error) throw error;
    return data;
  }

  async function getReservationStats() {
    const restaurant = await getRestaurant();
    const { data, error } = await db
      .from('v_reservation_stats')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .single();
    if (error) throw error;
    return data;
  }

  async function _updateStatus(reservationId, status, reason = '') {
    const { data, error } = await db
      .from('reservations')
      .update({ status, cancellation_reason: reason })
      .eq('id', reservationId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function confirmReservation(reservationId) {
    return _updateStatus(reservationId, 'confirmed');
  }

  async function cancelReservation(reservationId, reason = '') {
    return _updateStatus(reservationId, 'cancelled', reason);
  }

  async function seatReservation(reservationId) {
    return _updateStatus(reservationId, 'seated');
  }

  async function completeReservation(reservationId) {
    return _updateStatus(reservationId, 'completed');
  }

  async function markNoShow(reservationId) {
    return _updateStatus(reservationId, 'no_show');
  }

  async function addInternalNote(reservationId, note) {
    const { data, error } = await db
      .from('reservations')
      .update({ internal_notes: note })
      .eq('id', reservationId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function searchReservations(query) {
    const restaurant = await getRestaurant();
    const term = query.trim().toLowerCase();
    const { data, error } = await db
      .from('reservations')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,phone.ilike.%${term}%`);
    if (error) throw error;
    return data;
  }

  // ============================================================
  //  MENU ITEMS
  // ============================================================

  async function getMenuItems() {
    const restaurant = await getRestaurant();
    const { data, error } = await db
      .from('menu_items')
      .select('id, name, description, price, currency, category_id, image_url, is_available, is_featured, menu_categories(name)')
      .eq('restaurant_id', restaurant.id)
      .eq('is_available', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // ============================================================
  //  AUTH
  // ============================================================

  async function signIn(email, password) {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await db.auth.signOut();
    if (error) throw error;
  }

  async function getSession() {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function getProfile(userId) {
    const { data, error } = await db
      .from('profiles')
      .select('id, full_name, role, restaurant_id, restaurants(name, slug)')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  }

  function isStaffProfile(profile) {
    return profile && STAFF_ROLES.includes(profile.role);
  }

  async function requestPasswordReset(email) {
    const redirectTo = new URL('admin-reset.html', window.location.href).href;
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }

  async function updatePassword(newPassword) {
    const { data, error } = await db.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  }

  // ============================================================
  //  EXPORTS — Global and LakesideAuth object
  // ============================================================

  // Export as global functions for public site (booking.js)
  window.getRestaurant = getRestaurant;
  window.submitReservation = submitReservation;
  window.getReservations = getReservations;
  window.getTodaysReservations = getTodaysReservations;
  window.getPendingReservations = getPendingReservations;
  window.getReservationStats = getReservationStats;
  window.confirmReservation = confirmReservation;
  window.cancelReservation = cancelReservation;
  window.seatReservation = seatReservation;
  window.completeReservation = completeReservation;
  window.markNoShow = markNoShow;
  window.addInternalNote = addInternalNote;
  window.searchReservations = searchReservations;
  window.getMenuItems = getMenuItems;

  // Export as LakesideAuth object for admin dashboard
  window.LakesideAuth = {
    db,
    RESTAURANT_SLUG,
    STAFF_ROLES,

    // Restaurant
    getRestaurant,

    // Reservations
    submitReservation,
    getReservations,
    getTodaysReservations,
    getPendingReservations,
    getReservationStats,
    confirmReservation,
    cancelReservation,
    seatReservation,
    completeReservation,
    markNoShow,
    addInternalNote,
    searchReservations,

    // Menu
    getMenuItems,

    // Auth
    signIn,
    signOut,
    getSession,
    getProfile,
    isStaffProfile,
    requestPasswordReset,
    updatePassword,
  };
})();

