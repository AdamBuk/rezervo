-- Rezervo: working hours per staff member. By default a staff member works whenever
-- the business is open; with uses_business_hours = false they work only on the days
-- and times in staff_hours (a missing weekday = day off), always within opening hours.

alter table public.staff add column uses_business_hours boolean not null default true;

create table public.staff_hours (
  staff_id uuid not null references public.staff (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7), -- ISO 8601: 1 = Monday
  opens_at time not null,
  closes_at time not null,
  primary key (staff_id, weekday),
  check (closes_at > opens_at)
);

alter table public.staff_hours enable row level security;

create policy "staff hours are public" on public.staff_hours
  for select using (true);
create policy "owner manages staff hours" on public.staff_hours
  for all to authenticated
  using (exists (
    select 1 from public.staff st join public.businesses b on b.id = st.business_id
    where st.id = staff_id and b.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.staff st join public.businesses b on b.id = st.business_id
    where st.id = staff_id and b.owner_id = (select auth.uid())
  ));

grant select on public.staff_hours to anon, authenticated;
grant insert, update, delete on public.staff_hours to authenticated;
grant all on public.staff_hours to service_role;

-- create_booking(): as before, plus staff working hours. New error: outside_staff_hours
-- (nobody eligible – or the requested staff member – works at that time).
-- Raises P0001 with one of: business_not_found, service_not_found, staff_not_found,
-- slot_in_past, slot_too_far, outside_opening_hours, business_closed, slot_misaligned,
-- outside_staff_hours, slot_taken.
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
  v_weekday smallint;
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

  -- Staff with their own schedule only take bookings that fit into it (within opening hours).
  v_weekday := extract(isodow from v_local_start)::smallint;
  if not exists (
    select 1
    from public.staff st
    join public.staff_services ss on ss.staff_id = st.id
    where st.business_id = p_business_id
      and st.is_active
      and ss.service_id = p_service_id
      and (p_staff_id is null or st.id = p_staff_id)
      and (st.uses_business_hours or exists (
        select 1 from public.staff_hours sh
        where sh.staff_id = st.id and sh.weekday = v_weekday
          and v_local_start::time >= sh.opens_at and v_local_end::time <= sh.closes_at
      ))
  ) then
    if p_staff_id is null and not exists (
      select 1
      from public.staff st
      join public.staff_services ss on ss.staff_id = st.id
      where st.business_id = p_business_id and st.is_active and ss.service_id = p_service_id
    ) then
      raise exception 'service_not_found';
    end if;
    raise exception 'outside_staff_hours';
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
      and (st.uses_business_hours or exists (
        select 1 from public.staff_hours sh
        where sh.staff_id = st.id and sh.weekday = v_weekday
          and v_local_start::time >= sh.opens_at and v_local_end::time <= sh.closes_at
      ))
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

  raise exception 'slot_taken';
end;
$$;
