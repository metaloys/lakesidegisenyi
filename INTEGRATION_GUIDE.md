# Lakeside — Integration Guide
## How to wire `lakeside-supabase.js` into both HTML files

---

## Step 1 — Add your Supabase credentials

Open `lakeside-supabase.js` and replace lines 9–10:

```js
const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co'
const SUPABASE_ANON = 'YOUR_ANON_PUBLIC_KEY'
```

Find both values at:
**Supabase Dashboard → Project Settings → API → Project URL & anon public key**

---

## Step 2 — Add scripts to public website HTML

In `lakeside_bar_restaurant_landing.html`, just before `</body>`:

```html
<!-- Supabase SDK -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<!-- Lakeside client -->
<script src="lakeside-supabase.js"></script>
<!-- Booking form wiring -->
<script src="lakeside-booking.js"></script>
```

---

## Step 3 — Wire the booking form

Create `lakeside-booking.js`:

```js
document.getElementById('resForm').addEventListener('submit', async (e) => {
  e.preventDefault()

  const btn = document.querySelector('.form-submit')
  btn.textContent = 'Sending…'
  btn.disabled = true

  try {
    await submitReservation({
      firstName:       document.querySelector('input[placeholder="Jean"]').value,
      lastName:        document.querySelector('input[placeholder="Uwimana"]').value,
      phone:           document.querySelector('input[type="tel"]').value,
      email:           document.querySelector('input[type="email"]').value,
      date:            document.querySelector('input[type="date"]').value,
      timeSlot:        document.querySelector('select[required]:nth-of-type(1)').value,
      partySize:       document.querySelector('select[required]:nth-of-type(2)').value.split(' ')[0],
      occasion:        document.querySelectorAll('select')[2].value,
      specialRequests: document.querySelector('textarea').value,
    })

    document.getElementById('successMsg').style.display = 'block'
    btn.textContent = 'Request Sent ✓'
    e.target.reset()

  } catch (err) {
    btn.textContent = 'Error — Try Again'
    btn.disabled = false
    alert('Something went wrong: ' + err.message)
  }
})
```

---

## Step 4 — Wire the admin dashboard login

In `lakeside_admin_dashboard.html`, replace the `doLogin()` function:

```js
async function doLogin() {
  const email    = document.getElementById('l-user').value.trim()
  const password = document.getElementById('l-pass').value.trim()
  const err      = document.getElementById('login-err')

  try {
    await signIn(email, password)
    document.getElementById('login-screen').style.display = 'none'
    document.getElementById('app').classList.add('show')
    await initApp()
  } catch (e) {
    err.textContent = e.message
    err.style.display = 'block'
    setTimeout(() => err.style.display = 'none', 4000)
  }
}

async function doLogout() {
  await signOut()
  document.getElementById('app').classList.remove('show')
  document.getElementById('login-screen').style.display = 'flex'
}
```

---

## Step 5 — Wire the dashboard data

Replace the `initApp()` function in the admin dashboard:

```js
async function initApp() {
  // Date
  const d = new Date()
  document.getElementById('today-date').textContent =
    d.toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric' }).toUpperCase()

  // Load real data
  const [stats, pending, today] = await Promise.all([
    safe(() => getReservationStats()),
    safe(() => getPendingReservations(), []),
    safe(() => getTodaysReservations(), []),
  ])

  // Update stat cards
  if (stats) {
    document.querySelector('.stat-card:nth-child(1) .stat-value').textContent = stats.today_total   || 0
    document.querySelector('.stat-card:nth-child(2) .stat-value').textContent = stats.today_confirmed || 0
    document.querySelector('.stat-card:nth-child(3) .stat-value').textContent = stats.week_total    || 0
    document.querySelector('.stat-card:nth-child(4) .stat-value').textContent = stats.avg_party_size || '—'
    document.getElementById('sb-pending').textContent = stats.today_pending || 0
  }

  renderPendingFromData(pending)
  renderTodayFromData(today)
  renderMiniCal()

  // Subscribe to live updates
  subscribeToReservations(
    (newRes) => {
      showToast(`New booking: ${newRes.first_name} ${newRes.last_name}`)
      initApp() // refresh all data
    },
    (updated) => {
      initApp()
    }
  )
}
```

---

## Step 6 — Wire confirm/cancel/seat buttons to real DB

Replace the action functions:

```js
async function confirmRes(id) {
  try {
    await confirmReservation(id)
    showToast('Reservation confirmed ✓')
    initApp()
  } catch (e) { showToast('Error: ' + e.message) }
}

async function cancelRes(id) {
  const reason = prompt('Reason for cancellation (optional):') || ''
  try {
    await cancelReservation(id, reason)
    showToast('Reservation cancelled')
    initApp()
  } catch (e) { showToast('Error: ' + e.message) }
}

async function seatRes(id) {
  try {
    await seatReservation(id)
    showToast('Guest seated ✓')
    initApp()
  } catch (e) { showToast('Error: ' + e.message) }
}
```

---

## Step 7 — Deploy WhatsApp Edge Function

```bash
# Install Supabase CLI if not already
npm install -g supabase

# Login and link your project
supabase login
supabase link --project-ref YOUR_PROJECT_ID

# Create the function folder
mkdir -p supabase/functions/notify-whatsapp

# Copy the edge function file there
cp notify-whatsapp-edge-fn.ts supabase/functions/notify-whatsapp/index.ts

# Deploy
supabase functions deploy notify-whatsapp

# Set secrets (from Twilio Console)
supabase secrets set TWILIO_SID=ACxxxxxxx
supabase secrets set TWILIO_TOKEN=your_auth_token
supabase secrets set TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
supabase secrets set OWNER_WHATSAPP=whatsapp:+250791693096
```

---

## Step 8 — Enable Realtime in Supabase

Supabase Dashboard → Database → Replication → enable `reservations` table

---

## Step 9 — Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# In your project folder
vercel

# Set environment variables in Vercel Dashboard → Project → Settings → Environment Variables:
# SUPABASE_URL = https://YOUR_PROJECT_ID.supabase.co
# SUPABASE_ANON = your_anon_key
```

---

## File structure when done

```
lakeside/
├── lakeside_bar_restaurant_landing.html   ← public website
├── lakeside_admin_dashboard.html          ← admin dashboard
├── lakeside-supabase.js                   ← shared DB client
├── lakeside-booking.js                    ← form wiring
├── supabase/
│   └── functions/
│       └── notify-whatsapp/
│           └── index.ts                   ← WhatsApp edge function
```

---

## What's live after all 9 steps

- ✅ Public booking form saves to Supabase
- ✅ Owner gets WhatsApp alert instantly
- ✅ Admin logs in with real Supabase Auth
- ✅ Dashboard shows live reservations from DB
- ✅ Confirm / Cancel / Seat updates real DB
- ✅ New bookings appear in dashboard in real-time (no refresh)
- ✅ Menu loads dynamically from DB
- ✅ Analytics pull from real booking history
