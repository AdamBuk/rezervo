-- Rezervo: days off for individual staff members (holiday, sick leave). A closure with
-- staff_id = null closes the whole business as before; with a staff_id only that person
-- is unavailable and the others can still be booked.

alter table public.closures add column staff_id uuid references public.staff (id) on delete cascade;

create index closures_staff_ends_idx on public.closures (staff_id, ends_on) where staff_id is not null;

-- A staff member's closure must belong to their business.
create or replace function public.closures_staff_same_business()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.staff_id is not null
     and not exists (select 1 from public.staff where id = new.staff_id and business_id = new.business_id) then
    raise exception 'staff_not_found';
  end if;
  return new;
end;
$$;

create trigger closures_staff_same_business
  before insert or update of staff_id, business_id on public.closures
  for each row execute function public.closures_staff_same_business();

-- Visitors see who is away and when (not the note), so the booking page skips those days.
grant select (staff_id) on public.closures to anon;

-- create_booking(): business closures as before; staff on leave are skipped like staff off shift
-- (outside_staff_hours when nobody suitable is available).
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
      and c.staff_id is null
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
      and not exists (
        select 1 from public.closures c
        where c.staff_id = st.id and v_local_start::date between c.starts_on and c.ends_on
      )
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
      and not exists (
        select 1 from public.closures c
        where c.staff_id = st.id and v_local_start::date between c.starts_on and c.ends_on
      )
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
