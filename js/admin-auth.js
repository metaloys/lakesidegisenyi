/**
 * Admin login via Supabase Auth (auth.users + public.profiles).
 * Create users in Supabase Dashboard → Authentication → Users,
 * then link profiles (see lakeside_schema.sql footer).
 */
const STAFF_ROLES = ['owner', 'manager', 'staff', 'super_admin'];

function setLoginLoading(loading) {
  const btn = document.querySelector('.login-btn');
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Signing in…' : 'Sign In →';
}

function showLoginError(message) {
  const err = document.getElementById('login-err');
  if (!err) return;
  err.textContent = message;
  err.style.display = 'block';
  setTimeout(() => {
    err.style.display = 'none';
  }, 5000);
}

function applyProfileToSidebar(profile) {
  const name = profile?.full_name || profile?.restaurants?.name || 'Staff';
  const nameEl = document.querySelector('.sb-user-name');
  const roleEl = document.querySelector('.sb-user-role');
  const avatarEl = document.querySelector('.sb-avatar');
  if (nameEl) nameEl.textContent = name;
  if (roleEl) roleEl.textContent = (profile?.role || 'staff').replace('_', ' ');
  if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
}

function showAdminApp(profile) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.add('show');
  applyProfileToSidebar(profile);
  window.__lakesideProfile = profile;
  if (typeof initApp === 'function') initApp();
}

async function doLogin() {
  const auth = window.LakesideAuth;
  const email = document.getElementById('l-user').value.trim();
  const password = document.getElementById('l-pass').value;
  const err = document.getElementById('login-err');

  if (!auth) {
    showLoginError('Supabase is not configured. Add js/config.js with your project keys.');
    return;
  }
  if (!email || !password) {
    showLoginError('Enter your email and password.');
    return;
  }

  err.style.display = 'none';
  setLoginLoading(true);

  try {
    const { user } = await auth.signIn(email, password);
    const profile = await auth.getProfile(user.id);

    if (!auth.isStaffProfile(profile)) {
      await auth.signOut();
      throw new Error('This account is not authorized for the admin dashboard.');
    }

    if (!profile.restaurant_id) {
      console.warn(
        '[Lakeside] Profile has no restaurant_id. Link it in Supabase (see lakeside_schema.sql).'
      );
    }

    showAdminApp(profile);
  } catch (e) {
    const msg =
      e.message === 'Invalid login credentials'
        ? 'Invalid email or password.'
        : e.message || 'Sign in failed. Please try again.';
    showLoginError(msg);
  } finally {
    setLoginLoading(false);
  }
}

async function doLogout() {
  try {
    await window.LakesideAuth?.signOut();
  } catch (e) {
    console.error(e);
  }
  window.__lakesideProfile = null;
  document.getElementById('app').classList.remove('show');
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('l-user').value = '';
  document.getElementById('l-pass').value = '';
}

function showForgotPassword() {
  const email = document.getElementById('l-user')?.value.trim();
  document.getElementById('login-form-panel').hidden = true;
  document.getElementById('forgot-form-panel').hidden = false;
  const forgot = document.getElementById('forgot-email');
  if (forgot && email) forgot.value = email;
  document.getElementById('forgot-err').style.display = 'none';
  document.getElementById('forgot-ok').style.display = 'none';
}

function showSignIn() {
  document.getElementById('forgot-form-panel').hidden = true;
  document.getElementById('login-form-panel').hidden = false;
}

function showForgotError(message) {
  const el = document.getElementById('forgot-err');
  el.textContent = message;
  el.style.display = 'block';
  document.getElementById('forgot-ok').style.display = 'none';
}

function showForgotSuccess(message) {
  const el = document.getElementById('forgot-ok');
  el.textContent = message;
  el.style.display = 'block';
  document.getElementById('forgot-err').style.display = 'none';
}

async function requestPasswordReset() {
  const auth = window.LakesideAuth;
  const email = document.getElementById('forgot-email').value.trim();
  const btn = document.getElementById('forgot-btn');

  if (!auth) {
    showForgotError('Supabase is not configured.');
    return;
  }
  if (!email) {
    showForgotError('Enter your email address.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending…';

  try {
    await auth.requestPasswordReset(email);
    showForgotSuccess('Check your email for a reset link. It may take a minute.');
  } catch (e) {
    showForgotError(e.message || 'Could not send reset email.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send reset link';
  }
}

async function restoreAdminSession() {
  if (window.location.hash.includes('type=recovery')) {
    window.location.replace('admin-reset.html' + window.location.hash);
    return;
  }

  const auth = window.LakesideAuth;
  if (!auth) return;

  try {
    const session = await auth.getSession();
    if (!session?.user) return;

    const profile = await auth.getProfile(session.user.id);
    if (!auth.isStaffProfile(profile)) {
      await auth.signOut();
      return;
    }

    showAdminApp(profile);
  } catch (e) {
    console.error('[Lakeside] Session restore failed:', e);
    await auth.signOut().catch(() => {});
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', restoreAdminSession);
} else {
  restoreAdminSession();
}
