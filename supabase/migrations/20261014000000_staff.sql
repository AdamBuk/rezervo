-- Rezervo: staff members. Each booking belongs to one staff member and overlaps are
-- prevented per staff member, so a salon with three hairdressers can take three
-- bookings at the same time. Every business has at least one staff member; with
-- just one, the booking page looks exactly as before.

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index staff_business_id_idx on public.staff (business_id);

-- Which services a staff member performs.
create table public.staff_services (
  staff_id uuid not null references public.staff (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (staff_id, service_id)
);

create index staff_services_service_id_idx on public.staff_services (service_id);

-- Both sides must belong to the same business.
create or replace function public.staff_services_same_business()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select business_id from public.staff where id = new.staff_id)
     is distinct from (select business_id from public.services where id = new.service_id) then
    raise exception 'staff and service belong to different businesses';
  end if;
  return new;
end;
$$;

create trigger staff_services_same_business
  before insert or update on public.staff_services
  for each row execute function public.staff_services_same_business();

-- ---------------------------------------------------------------------------
-- Backfill: one staff member per existing business, doing all its services.
-- ---------------------------------------------------------------------------

insert into public.staff (business_id, name)
select b.id, b.name from public.businesses b;

insert into public.staff_services (staff_id, service_id)
select st.id, s.id
from public.staff st
join public.services s on s.business_id = st.business_id;

alter table public.bookings add column staff_id uuid references public.staff (id) on delete restrict;

update public.bookings bk
set staff_id = st.id
from public.staff st
where st.business_id = bk.business_id;

alter table public.bookings alter column staff_id set not null;

-- A booking's staff member must work for the same business.
create or replace function public.bookings_staff_same_business()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.staff where id = new.staff_id and business_id = new.business_id) then
    raise exception 'staff_not_found';
  end if;
  return new;
end;
$$;

create trigger bookings_staff_same_business
  before insert or update of staff_id, business_id on public.bookings
  for each row execute function public.bookings_staff_same_business();

-- Overlaps are now checked per staff member instead of per business.
alter table public.bookings drop constraint bookings_no_overlap;
alter table public.bookings add constraint bookings_no_overlap exclude using gist (
  staff_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
) where (status = 'confirmed');

create index bookings_staff_starts_idx on public.bookings (staff_id, starts_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.staff enable row level security;
alter table public.staff_services enable row level security;

create policy "staff are public" on public.staff
  for select using (true);
create policy "owner manages staff" on public.staff
  for all to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));

create policy "staff services are public" on public.staff_services
  for select using (true);
create policy "owner manages staff services" on public.staff_services
  for all to authenticated
  using (exists (
    select 1 from public.staff st join public.businesses b on b.id = st.business_id
    where st.id = staff_id and b.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.staff st join public.businesses b on b.id = st.business_id
    where st.id = staff_id and b.owner_id = (select auth.uid())
  ));

grant select on public.staff, public.staff_services to anon, authenticated;
grant insert, update, delete on public.staff, public.staff_services to authenticated;
grant all on public.staff, public.staff_services to service_role;

-- ---------------------------------------------------------------------------
-- Public functions
-- ---------------------------------------------------------------------------

-- Busy ranges per staff member, without any customer data. Replaces get_busy_intervals().
create or replace function public.get_staff_busy_intervals(
  p_business_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (staff_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.staff_id, b.starts_at, b.ends_at
  from public.bookings b
  where b.business_id = p_business_id
    and b.status = 'confirmed'
    and b.starts_at < p_to
    and b.ends_at > p_from
    and p_to - p_from <= interval '62 days'
  order by b.starts_at;
$$;

revoke execute on function public.get_staff_busy_intervals(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_staff_busy_intervals(uuid, timestamptz, timestamptz) to anon, authenticated, service_role;

drop function public.get_busy_intervals(uuid, timestamptz, timestamptz);

-- create_booking(): as before, plus a staff member. With p_staff_id null ("anyone"),
-- the first free staff member (by sort order) who performs the service is assigned.
-- Raises P0001 with one of: business_not_found, service_not_found, staff_not_found,
-- slot_in_past, slot_too_far, outside_opening_hours, business_closed, slot_misaligned, slot_taken.
drop function public.create_booking(uuid, uuid, timestamptz, text, text, text);

create or replace function public.create_booking(
  p_business_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_staff_id uuid default null
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
  v_staff_id uuid;
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

  if p_staff_id is not null and not exists (
    select 1
    from public.staff st
    join public.staff_services ss on ss.staff_id = st.id
    where st.id = p_staff_id and st.business_id = p_business_id and st.is_active and ss.service_id = p_service_id
  ) then
    raise exception 'staff_not_found';
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

  if exists (
    select 1 from public.closures c
    where c.business_id = p_business_id
      and v_local_start::date between c.starts_on and c.ends_on
  ) then
    raise exception 'business_closed';
  end if;

  if (extract(epoch from (v_local_start::time - v_hours.opens_at))::int
      % (v_business.slot_step_minutes * 60)) <> 0 then
    raise exception 'slot_misaligned';
  end if;

  -- Try the requested staff member, or each eligible one in order. The exclusion
  -- constraint decides atomically, so concurrent requests can't double-book anyone.
  for v_staff_id in
    select st.id
    from public.staff st
    join public.staff_services ss on ss.staff_id = st.id
    where st.business_id = p_business_id
      and st.is_active
      and ss.service_id = p_service_id
      and (p_staff_id is null or st.id = p_staff_id)
    order by st.sort_order, st.created_at, st.id
  loop
    begin
      insert into public.bookings (
        business_id, service_id, staff_id, customer_name, customer_email, customer_phone, starts_at, ends_at
      ) values (
        p_business_id, p_service_id, v_staff_id, trim(p_customer_name), lower(trim(p_customer_email)),
        trim(p_customer_phone), p_starts_at, v_ends_at
      )
      returning id into v_id;
      return v_id;
    exception
      when exclusion_violation then
        null; -- this staff member is busy, try the next one
    end;
  end loop;

  if p_staff_id is null and not exists (
    select 1
    from public.staff st
    join public.staff_services ss on ss.staff_id = st.id
    where st.business_id = p_business_id and st.is_active and ss.service_id = p_service_id
  ) then
    raise exception 'service_not_found';
  end if;

  raise exception 'slot_taken';
end;
$$;

revoke execute on function public.create_booking(uuid, uuid, timestamptz, text, text, text, uuid) from public;
grant execute on function public.create_booking(uuid, uuid, timestamptz, text, text, text, uuid) to anon, authenticated, service_role;
