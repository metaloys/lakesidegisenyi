/**
 * Set new password after Supabase reset email link.
 */
function showPanel(id) {
  ['reset-wait', 'reset-form', 'reset-invalid'].forEach((pid) => {
    const el = document.getElementById(pid);
    if (el) el.hidden = pid !== id;
  });
}

function showResetError(msg) {
  const el = document.getElementById('reset-err');
  el.textContent = msg;
  el.style.display = 'block';
  document.getElementById('reset-ok').style.display = 'none';
}

function showResetSuccess(msg) {
  const el = document.getElementById('reset-ok');
  el.textContent = msg;
  el.style.display = 'block';
  document.getElementById('reset-err').style.display = 'none';
}

async function submitNewPassword() {
  const auth = window.LakesideAuth;
  const p1 = document.getElementById('new-pass').value;
  const p2 = document.getElementById('new-pass2').value;
  const btn = document.getElementById('reset-btn');

  if (!auth) {
    showResetError('Supabase is not configured.');
    return;
  }
  if (p1.length < 8) {
    showResetError('Password must be at least 8 characters.');
    return;
  }
  if (p1 !== p2) {
    showResetError('Passwords do not match.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Updating…';

  try {
    await auth.updatePassword(p1);
    showResetSuccess('Password updated. Redirecting to sign in…');
    setTimeout(() => {
      window.location.href = 'admin.html';
    }, 2000);
  } catch (e) {
    showResetError(e.message || 'Could not update password.');
    btn.disabled = false;
    btn.textContent = 'Update password';
  }
}

async function initPasswordResetPage() {
  const auth = window.LakesideAuth;
  showPanel('reset-wait');

  if (!auth) {
    showPanel('reset-invalid');
    return;
  }

  const { data, error } = await auth.db.auth.getSession();

  if (error || !data.session) {
    showPanel('reset-invalid');
    return;
  }

  showPanel('reset-form');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPasswordResetPage);
} else {
  initPasswordResetPage();
}
