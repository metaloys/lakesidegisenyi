# Lakeside — project layout

Split by **role** so the public site never ships admin code or demo passwords, and secrets live in gitignored config files.

```
project/
├── index.html              Public landing (structure only)
├── admin.html              Admin dashboard (structure only)
├── login.html              Optional standalone login
│
├── css/
│   ├── style.css           Landing styles
│   └── admin.css           Admin styles
│
├── js/
│   ├── config.example.js   Template → copy to config.js (public API keys)
│   ├── config.js           GITIGNORED — Supabase anon, EmailJS, WhatsApp
│   ├── landing.js          Menu tabs, scroll reveal
│   ├── reviews.js          Reviews carousel
│   ├── booking.js          Reservation form → Supabase
│   │
│   ├── supabase-client.js  Supabase client + auth helpers (uses config.js)
│   ├── admin-auth.js       Login / logout via Supabase Auth + profiles table
│   ├── admin-ui.js         Toast notifications
│   ├── admin-dashboard.js  Reservations, calendar, analytics, menu
│   └── admin-photos.js     Gallery upload UI
│
├── lakeside-supabase.js    Shared Supabase helpers (future admin wiring)
├── lakeside_schema.sql
├── notify-whatsapp-edge-fn.ts
├── INTEGRATION_GUIDE.md
│
├── assets/                 Images (optional)
└── Trash/                  Old monolithic HTML (lakeside_*_v2.html)
```

## First-time setup

1. Copy `js/config.example.js` → `js/config.js` and fill in Supabase + EmailJS + WhatsApp.
2. In Supabase: **Authentication → Users** → create the owner (email + password).
3. Link their profile to Lakeside (SQL in `lakeside_schema.sql` footer).
4. Open `admin.html` to sign in with that email and password.

## Security notes

| Topic | Guidance |
|--------|----------|
| Monolithic HTML | Avoid one file with CSS + JS + admin passwords. Use this layout. |
| `config.js` | Never commit. Anon key is public by design; protect data with **Supabase RLS**. |
| Admin passwords | Stored in **Supabase Auth** (`auth.users`), not in JS files. |
| Public vs admin | `index.html` must not load `admin-*.js`. `admin.html` must not load `booking.js`. |
| Service role key | Never put in frontend — server/Edge Functions only. |

## Troubleshooting

| Issue | Check |
|--------|--------|
| Booking does nothing | `config.js` exists; `booking.js` loads after Supabase CDN; browser console errors |
| Reviews empty | `reviews.js` loaded; `#reviewsTrack` in `index.html` |
| Admin login fails | User exists in Supabase Auth; `profiles.role` is owner/manager/staff; `config.js` keys are correct |
| Wrong encoding () | Save HTML/JS as UTF-8 |
