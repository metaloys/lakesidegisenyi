-- ============================================================
--  LAKESIDE BAR & RESTAURANT — SUPABASE SCHEMA
--  Version: 1.0  |  Path A (Production) + Path B ready
--  Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── EXTENSIONS ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_net";       -- for HTTP webhooks (WhatsApp)


-- ============================================================
--  1. RESTAURANTS
--  One row per restaurant. Path A = 1 row (Lakeside).
--  Path B = multiple rows (multi-tenant SaaS).
-- ============================================================
create table public.restaurants (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  slug          text unique not null,              -- e.g. "lakeside-gisenyi"
  phone         text,
  whatsapp      text,
  email         text,
  address       text,
  city          text,
  country       text default 'Rwanda',
  opening_hours text default 'Daily · 6:00 AM – 11:00 PM',
  max_covers    integer default 40,               -- max guests per slot
  slot_duration integer default 90,               -- minutes per booking slot
  logo_url      text,
  timezone      text default 'Africa/Kigali',
  is_active     boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Seed Lakeside as the first restaurant
insert into public.restaurants (
  name, slug, phone, whatsapp, email,
  address, city, opening_hours, max_covers
) values (
  'Lakeside Bar Beach & Restaurant',
  'lakeside-gisenyi',
  '0791693096',
  '0791693096',
  'info@lakesidegisenyi.rw',
  'Ave de la Production, Gisenyi',
  'Gisenyi',
  'Daily · 6:00 AM – 11:00 PM',
  60
);


-- ============================================================
--  2. PROFILES
--  Extends Supabase Auth users with role + restaurant link.
--  Created automatically via trigger when user signs up.
-- ============================================================
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  restaurant_id   uuid references public.restaurants(id) on delete set null,
  full_name       text,
  role            text not null default 'owner'
                  check (role in ('owner', 'manager', 'staff', 'super_admin')),
  avatar_url      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
--  3. RESERVATIONS
--  Core table. Every booking from the public website lands here.
-- ============================================================
create table public.reservations (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,

  -- Guest details
  first_name      text not null,
  last_name       text not null,
  phone           text not null,
  email           text,

  -- Booking details
  date            date not null,
  time_slot       text not null,                  -- e.g. "07:00 PM – Dinner"
  party_size      integer not null check (party_size > 0 and party_size <= 100),
  occasion        text,                           -- Birthday, Anniversary, etc.
  special_requests text,

  -- Status lifecycle
  status          text not null default 'pending'
                  check (status in ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show')),
  confirmed_at    timestamptz,
  seated_at       timestamptz,
  completed_at    timestamptz,
  cancelled_at    timestamptz,
  cancellation_reason text,

  -- Internal
  source          text default 'website'          -- website | phone | walkin | admin
                  check (source in ('website', 'phone', 'walkin', 'admin')),
  internal_notes  text,
  notified        boolean default false,          -- WhatsApp notification sent?

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Indexes for common queries
create index idx_reservations_restaurant on public.reservations(restaurant_id);
create index idx_reservations_date on public.reservations(date);
create index idx_reservations_status on public.reservations(status);
create index idx_reservations_date_status on public.reservations(date, status);
create index idx_reservations_phone on public.reservations(phone);


-- ============================================================
--  4. RESERVATION STATUS LOG
--  Full audit trail of every status change. Who changed what, when.
-- ============================================================
create table public.reservation_status_log (
  id              uuid primary key default uuid_generate_v4(),
  reservation_id  uuid not null references public.reservations(id) on delete cascade,
  changed_by      uuid references auth.users(id) on delete set null,  -- null = system/guest
  from_status     text,
  to_status       text not null,
  note            text,
  created_at      timestamptz default now()
);

create index idx_status_log_reservation on public.reservation_status_log(reservation_id);

-- Auto-log every status change on reservations
create or replace function public.log_reservation_status_change()
returns trigger
language plpgsql security definer
as $$
begin
  if old.status is distinct from new.status then
    insert into public.reservation_status_log (reservation_id, from_status, to_status)
    values (new.id, old.status, new.status);
  end if;
  return new;
end;
$$;

create trigger on_reservation_status_change
  after update on public.reservations
  for each row execute procedure public.log_reservation_status_change();


-- ============================================================
--  5. AUTO-UPDATE updated_at
--  Keeps updated_at fresh on every row change.
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_reservations_updated_at
  before update on public.reservations
  for each row execute procedure public.set_updated_at();

create trigger set_restaurants_updated_at
  before update on public.restaurants
  for each row execute procedure public.set_updated_at();

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();


-- ============================================================
--  6. MENU CATEGORIES & ITEMS
--  Powers the menu display on the public site.
--  Path B: each restaurant has its own menu.
-- ============================================================
create table public.menu_categories (
  id            uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name          text not null,                    -- "Food", "Drinks", "Breakfast"
  sort_order    integer default 0,
  is_active     boolean default true,
  created_at    timestamptz default now()
);

create table public.menu_items (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  category_id     uuid references public.menu_categories(id) on delete set null,
  name            text not null,
  description     text,
  price           numeric(10,2) not null check (price >= 0),
  currency        text default 'RWF',
  image_url       text,
  is_available    boolean default true,
  is_featured     boolean default false,
  dietary_tags    text[],                         -- ['vegetarian','gluten-free']
  sort_order      integer default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index idx_menu_items_restaurant on public.menu_items(restaurant_id);
create index idx_menu_items_category on public.menu_items(category_id);

create trigger set_menu_items_updated_at
  before update on public.menu_items
  for each row execute procedure public.set_updated_at();

-- Seed Lakeside menu categories
with rest as (select id from public.restaurants where slug = 'lakeside-gisenyi')
insert into public.menu_categories (restaurant_id, name, sort_order)
select rest.id, cat.name, cat.sort_order from rest,
(values ('Food', 1), ('Drinks & Bar', 2), ('Breakfast', 3)) as cat(name, sort_order);

-- Seed Lakeside menu items
with rest as (select id from public.restaurants where slug = 'lakeside-gisenyi'),
     food_cat as (select mc.id from public.menu_categories mc
                  join public.restaurants r on r.id = mc.restaurant_id
                  where r.slug = 'lakeside-gisenyi' and mc.name = 'Food'),
     drink_cat as (select mc.id from public.menu_categories mc
                   join public.restaurants r on r.id = mc.restaurant_id
                   where r.slug = 'lakeside-gisenyi' and mc.name = 'Drinks & Bar'),
     bfast_cat as (select mc.id from public.menu_categories mc
                   join public.restaurants r on r.id = mc.restaurant_id
                   where r.slug = 'lakeside-gisenyi' and mc.name = 'Breakfast')
insert into public.menu_items (restaurant_id, category_id, name, description, price, is_featured)
select * from (
  -- Food
  select rest.id, food_cat.id, 'Tilapia du Lac',       'Fresh Lake Kivu tilapia, lemon herb butter, seasonal vegetables', 8500, true  from rest, food_cat union all
  select rest.id, food_cat.id, 'Brochettes Royales',   'Premium beef skewers, chimichurri, roasted cassava chips',        7000, true  from rest, food_cat union all
  select rest.id, food_cat.id, 'Prawn Beach Platter',  'Grilled lake prawns, garlic butter, avocado salsa, lime',         11000, true from rest, food_cat union all
  select rest.id, food_cat.id, 'Isombe & Goat',        'Traditional cassava leaves, slow-braised goat, plantain',         6500, false from rest, food_cat union all
  select rest.id, food_cat.id, 'Beach Burger',         '200g beef patty, caramelised onions, local cheese, brioche',      5500, false from rest, food_cat union all
  select rest.id, food_cat.id, 'Vegetarian Mezze',     'Roasted seasonal vegetables, hummus, flatbread, salad',           5000, false from rest, food_cat union all
  -- Drinks
  select rest.id, drink_cat.id, 'Lake Kivu Sunset',   'Passion fruit, rum, ginger beer, fresh mint, chilli rim',         4500, true  from rest, drink_cat union all
  select rest.id, drink_cat.id, 'Amarula Lakeside',   'Amarula, espresso, cream, dark chocolate shavings',               4000, false from rest, drink_cat union all
  select rest.id, drink_cat.id, 'Primus Draught',     'Rwanda''s finest lager, ice cold, frosted glass',                 1500, false from rest, drink_cat union all
  select rest.id, drink_cat.id, 'House Wine',         'Curated South African & French selection, glass pour',            3500, false from rest, drink_cat union all
  select rest.id, drink_cat.id, 'Fresh Mango Crush',  'Blended mango, lime, honey, sparkling water, mint',               2500, false from rest, drink_cat union all
  select rest.id, drink_cat.id, 'Rwandan Coffee',     'Single origin specialty roast — flat white, latte or filter',     2000, false from rest, drink_cat union all
  -- Breakfast
  select rest.id, bfast_cat.id, 'Full Beach Breakfast','Eggs your way, bacon, toast, fruit, fresh juice, coffee',        7500, true  from rest, bfast_cat union all
  select rest.id, bfast_cat.id, 'Avocado Toast',      'Sourdough, smashed avocado, poached egg, chilli flakes',          4500, false from rest, bfast_cat union all
  select rest.id, bfast_cat.id, 'Tropical Fruit Bowl','Seasonal Rwandan fruits, yoghurt, granola, honey drizzle',        3500, false from rest, bfast_cat union all
  select rest.id, bfast_cat.id, 'Omelette du Lac',    'Three-egg omelette, smoked tilapia, herbs, grilled tomato',       5000, false from rest, bfast_cat
) as items;


-- ============================================================
--  7. NOTIFICATIONS LOG
--  Tracks every WhatsApp / SMS / email alert sent.
-- ============================================================
create table public.notifications_log (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid references public.restaurants(id) on delete cascade,
  reservation_id  uuid references public.reservations(id) on delete cascade,
  channel         text not null check (channel in ('whatsapp', 'sms', 'email')),
  recipient       text not null,                  -- phone or email
  message         text,
  status          text default 'sent'
                  check (status in ('sent', 'delivered', 'failed')),
  provider_ref    text,                           -- Twilio message SID, etc.
  sent_at         timestamptz default now()
);

create index idx_notif_reservation on public.notifications_log(reservation_id);


-- ============================================================
--  8. ROW LEVEL SECURITY (RLS)
--  Protects data at the database level.
--  Public can INSERT reservations (booking form).
--  Only authenticated staff can SELECT/UPDATE/DELETE.
-- ============================================================

-- RESTAURANTS
alter table public.restaurants enable row level security;

create policy "Public can read active restaurants"
  on public.restaurants for select
  using (is_active = true);

create policy "Owner can update their restaurant"
  on public.restaurants for update
  using (
    id in (
      select restaurant_id from public.profiles
      where id = auth.uid()
    )
  );

-- PROFILES
alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- RESERVATIONS
alter table public.reservations enable row level security;

create policy "Public can create reservations"
  on public.reservations for insert
  with check (true);                              -- anyone can book

create policy "Staff can read their restaurant reservations"
  on public.reservations for select
  using (
    restaurant_id in (
      select restaurant_id from public.profiles
      where id = auth.uid()
    )
  );

create policy "Staff can update their restaurant reservations"
  on public.reservations for update
  using (
    restaurant_id in (
      select restaurant_id from public.profiles
      where id = auth.uid()
    )
  );

-- RESERVATION STATUS LOG
alter table public.reservation_status_log enable row level security;

create policy "Staff can read status logs for their restaurant"
  on public.reservation_status_log for select
  using (
    reservation_id in (
      select id from public.reservations
      where restaurant_id in (
        select restaurant_id from public.profiles
        where id = auth.uid()
      )
    )
  );

-- MENU CATEGORIES
alter table public.menu_categories enable row level security;

create policy "Public can read active menu categories"
  on public.menu_categories for select
  using (is_active = true);

create policy "Staff can manage their menu categories"
  on public.menu_categories for all
  using (
    restaurant_id in (
      select restaurant_id from public.profiles
      where id = auth.uid()
    )
  );

-- MENU ITEMS
alter table public.menu_items enable row level security;

create policy "Public can read available menu items"
  on public.menu_items for select
  using (is_available = true);

create policy "Staff can manage their menu items"
  on public.menu_items for all
  using (
    restaurant_id in (
      select restaurant_id from public.profiles
      where id = auth.uid()
    )
  );

-- NOTIFICATIONS LOG
alter table public.notifications_log enable row level security;

create policy "Staff can read their notification logs"
  on public.notifications_log for select
  using (
    restaurant_id in (
      select restaurant_id from public.profiles
      where id = auth.uid()
    )
  );


-- ============================================================
--  9. USEFUL VIEWS
--  Pre-built queries the dashboard will use constantly.
-- ============================================================

-- Today's reservations with full guest info
create or replace view public.v_todays_reservations as
select
  r.id,
  r.first_name || ' ' || r.last_name as guest_name,
  r.phone,
  r.email,
  r.date,
  r.time_slot,
  r.party_size,
  r.occasion,
  r.special_requests,
  r.status,
  r.source,
  r.internal_notes,
  r.created_at,
  rest.name as restaurant_name,
  rest.slug as restaurant_slug
from public.reservations r
join public.restaurants rest on rest.id = r.restaurant_id
where r.date = current_date
order by r.time_slot, r.created_at;

-- Reservation stats summary per restaurant
create or replace view public.v_reservation_stats as
select
  restaurant_id,
  count(*) filter (where date = current_date)                          as today_total,
  count(*) filter (where date = current_date and status = 'confirmed') as today_confirmed,
  count(*) filter (where date = current_date and status = 'pending')   as today_pending,
  count(*) filter (where date = current_date and status = 'seated')    as today_seated,
  count(*) filter (where date >= date_trunc('week', current_date))     as week_total,
  count(*) filter (where date >= date_trunc('month', current_date))    as month_total,
  round(avg(party_size) filter (where date >= date_trunc('month', current_date)), 1) as avg_party_size,
  sum(party_size) filter (where date >= date_trunc('month', current_date)) as month_covers
from public.reservations
group by restaurant_id;

-- Pending reservations that need action
create or replace view public.v_pending_reservations as
select
  r.id,
  r.first_name || ' ' || r.last_name as guest_name,
  r.phone,
  r.date,
  r.time_slot,
  r.party_size,
  r.occasion,
  r.special_requests,
  r.created_at,
  extract(epoch from (now() - r.created_at)) / 3600 as hours_waiting
from public.reservations r
where r.status = 'pending'
order by r.created_at asc;


-- ============================================================
--  10. HELPER FUNCTIONS
--  Called from the dashboard or API routes.
-- ============================================================

-- Get reservations for a specific date range
create or replace function public.get_reservations_by_range(
  p_restaurant_id uuid,
  p_from date,
  p_to date
)
returns table (
  id uuid, guest_name text, phone text, date date,
  time_slot text, party_size integer, occasion text, status text, created_at timestamptz
)
language sql stable security definer
as $$
  select
    r.id,
    r.first_name || ' ' || r.last_name,
    r.phone,
    r.date,
    r.time_slot,
    r.party_size,
    r.occasion,
    r.status,
    r.created_at
  from public.reservations r
  where r.restaurant_id = p_restaurant_id
    and r.date between p_from and p_to
  order by r.date, r.time_slot;
$$;

-- Update reservation status (used by dashboard actions)
create or replace function public.update_reservation_status(
  p_reservation_id uuid,
  p_new_status text,
  p_note text default null
)
returns public.reservations
language plpgsql security definer
as $$
declare
  v_reservation public.reservations;
begin
  update public.reservations
  set
    status = p_new_status,
    confirmed_at  = case when p_new_status = 'confirmed'  then now() else confirmed_at  end,
    seated_at     = case when p_new_status = 'seated'     then now() else seated_at     end,
    completed_at  = case when p_new_status = 'completed'  then now() else completed_at  end,
    cancelled_at  = case when p_new_status = 'cancelled'  then now() else cancelled_at  end,
    cancellation_reason = coalesce(p_note, cancellation_reason)
  where id = p_reservation_id
  returning * into v_reservation;

  return v_reservation;
end;
$$;


-- ============================================================
--  DONE.
--  Next steps:
--  1. Run this SQL in Supabase → SQL Editor
--  2. Go to Authentication → Settings → enable Email provider
--  3. Create your first user in Authentication → Users
--  4. Run the profile link SQL below to connect the user to Lakeside:
--
--     update public.profiles
--     set restaurant_id = (select id from public.restaurants where slug = 'lakeside-gisenyi'),
--         full_name = 'Lakeside Owner',
--         role = 'owner'
--     where id = '<your-auth-user-id>';
--
--  5. Copy your Supabase URL and anon key from:
--     Project Settings → API → Project URL & anon public key
-- ============================================================
