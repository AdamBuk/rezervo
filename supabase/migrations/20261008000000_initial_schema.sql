-- Rezervo: initial schema
-- Run in Supabase SQL editor or via `supabase db push`.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  slug text not null unique
    check (
      char_length(slug) between 3 and 60
      and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      and slug not in ('login', 'register', 'logout', 'dashboard', 'auth', 'api', 'admin', 'about')
    ),
  description text check (char_length(description) <= 500),
  address text check (char_length(address) <= 200),
  phone text check (char_length(phone) <= 30),
  -- Where owner notifications are sent (defaults to the account e-mail in the app)
  notification_email text not null check (notification_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  timezone text not null default 'Europe/Prague',
  -- Granularity of offered start times, e.g. 15 => 9:00, 9:15, 9:30 ...
  slot_step_minutes int not null default 15 check (slot_step_minutes in (5, 10, 15, 20, 30, 60)),
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text check (char_length(description) <= 300),
  duration_minutes int not null check (duration_minutes between 5 and 480),
  price_czk int not null check (price_czk between 0 and 1000000),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index services_business_id_idx on public.services (business_id);

-- One opening interval per weekday; a missing row means closed.
create table public.opening_hours (
  business_id uuid not null references public.businesses (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7), -- ISO 8601: 1 = Monday, 7 = Sunday
  opens_at time not null,
  closes_at time not null,
  primary key (business_id, weekday),
  check (closes_at > opens_at)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  customer_email text not null check (customer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  customer_phone text not null check (char_length(customer_phone) between 6 and 30),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- The core guarantee: two confirmed bookings of one business can never overlap.
  -- Half-open ranges '[)' allow back-to-back bookings (10:00-11:00 and 11:00-12:00).
  constraint bookings_no_overlap exclude using gist (
    business_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'confirmed')
);

create index bookings_business_starts_idx on public.bookings (business_id, starts_at);
create index bookings_reminder_idx on public.bookings (starts_at) where status = 'confirmed' and reminder_sent_at is null;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.businesses enable row level security;
alter table public.services enable row level security;
alter table public.opening_hours enable row level security;
alter table public.bookings enable row level security;

-- Businesses, services and opening hours are public (needed by the booking page).
create policy "businesses are public" on public.businesses
  for select using (true);
create policy "owner inserts own business" on public.businesses
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner updates own business" on public.businesses
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner deletes own business" on public.businesses
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "services are public" on public.services
  for select using (true);
create policy "owner manages services" on public.services
  for all to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));

create policy "opening hours are public" on public.opening_hours
  for select using (true);
create policy "owner manages opening hours" on public.opening_hours
  for all to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));

-- Bookings contain personal data: only the owner can read/modify them.
-- Customers create bookings exclusively through public.create_booking().
create policy "owner reads bookings" on public.bookings
  for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy "owner updates bookings" on public.bookings
  for update to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));

-- Explicit grants (newer Supabase projects no longer expose tables to the Data API by default)
grant select on public.services, public.opening_hours to anon, authenticated;
grant select on public.businesses to authenticated;
-- Anonymous visitors only get the public profile columns (not owner_id / notification_email).
grant select (id, name, slug, description, address, phone, timezone, slot_step_minutes)
  on public.businesses to anon;
grant insert, update, delete on public.businesses, public.services, public.opening_hours to authenticated;
grant select, update on public.bookings to authenticated;
-- Server-side jobs (e-mails, reminders, seeding) use the secret key = service_role.
grant all on public.businesses, public.services, public.opening_hours, public.bookings to service_role;

-- ---------------------------------------------------------------------------
-- Public functions
-- ---------------------------------------------------------------------------

-- Busy time ranges for the public booking page, without any customer data.
create or replace function public.get_busy_intervals(
  p_business_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.starts_at, b.ends_at
  from public.bookings b
  where b.business_id = p_business_id
    and b.status = 'confirmed'
    and b.starts_at < p_to
    and b.ends_at > p_from
    and p_to - p_from <= interval '62 days'
  order by b.starts_at;
$$;

-- Creates a booking after validating service, opening hours and slot alignment.
-- Overlaps are rejected by the bookings_no_overlap exclusion constraint, which
-- makes concurrent requests for the same slot safe.
-- Raises P0001 with one of: business_not_found, service_not_found, slot_in_past,
-- slot_too_far, outside_opening_hours, slot_misaligned, slot_taken.
create or replace function public.create_booking(
  p_business_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_business public.businesses%rowtype;
  v_service public.services%rowtype;
  v_hours public.opening_hours%rowtype;
  v_ends_at timestamptz;
  v_local_start timestamp;
  v_local_end timestamp;
  v_id uuid;
begin
  select * into v_business from public.businesses where id = p_business_id;
  if not found then
    raise exception 'business_not_found';
  end if;

  select * into v_service
  from public.services
  where id = p_service_id and business_id = p_business_id and is_active;
  if not found then
    raise exception 'service_not_found';
  end if;

  if p_starts_at < now() then
    raise exception 'slot_in_past';
  end if;
  if p_starts_at > now() + interval '90 days' then
    raise exception 'slot_too_far';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_service.duration_minutes);
  v_local_start := p_starts_at at time zone v_business.timezone;
  v_local_end := v_ends_at at time zone v_business.timezone;

  select * into v_hours
  from public.opening_hours
  where business_id = p_business_id
    and weekday = extract(isodow from v_local_start)::smallint;

  if not found
    or v_local_start::date <> v_local_end::date
    or v_local_start::time < v_hours.opens_at
    or v_local_end::time > v_hours.closes_at then
    raise exception 'outside_opening_hours';
  end if;

  if (extract(epoch from (v_local_start::time - v_hours.opens_at))::int
      % (v_business.slot_step_minutes * 60)) <> 0 then
    raise exception 'slot_misaligned';
  end if;

  begin
    insert into public.bookings (
      business_id, service_id, customer_name, customer_email, customer_phone, starts_at, ends_at
    ) values (
      p_business_id, p_service_id, trim(p_customer_name), lower(trim(p_customer_email)),
      trim(p_customer_phone), p_starts_at, v_ends_at
    )
    returning id into v_id;
  exception
    when exclusion_violation then
      raise exception 'slot_taken';
  end;

  return v_id;
end;
$$;

revoke execute on function public.get_busy_intervals(uuid, timestamptz, timestamptz) from public;
revoke execute on function public.create_booking(uuid, uuid, timestamptz, text, text, text) from public;
grant execute on function public.get_busy_intervals(uuid, timestamptz, timestamptz) to anon, authenticated, service_role;
grant execute on function public.create_booking(uuid, uuid, timestamptz, text, text, text) to anon, authenticated, service_role;
