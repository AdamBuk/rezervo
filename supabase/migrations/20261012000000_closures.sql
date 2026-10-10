-- Rezervo: closures (holidays, days off). No bookings on these days.

create table public.closures (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- Inclusive range of calendar days in the business timezone
  starts_on date not null,
  ends_on date not null,
  -- Private note for the owner (not exposed to the public booking page)
  note text check (char_length(note) <= 100),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (ends_on - starts_on <= 366)
);

create index closures_business_ends_idx on public.closures (business_id, ends_on);

alter table public.closures enable row level security;

create policy "closures are public" on public.closures
  for select using (true);
create policy "owner manages closures" on public.closures
  for all to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));

-- Visitors see only the dates (the booking page shows them as closed), not the note.
grant select (id, business_id, starts_on, ends_on) on public.closures to anon;
grant select on public.closures to authenticated;
grant insert, update, delete on public.closures to authenticated;
grant all on public.closures to service_role;

-- create_booking(): same as before, plus rejects days covered by a closure.
-- Raises P0001 with one of: business_not_found, service_not_found, slot_in_past,
-- slot_too_far, outside_opening_hours, business_closed, slot_misaligned, slot_taken.
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

revoke execute on function public.create_booking(uuid, uuid, timestamptz, text, text, text) from public;
grant execute on function public.create_booking(uuid, uuid, timestamptz, text, text, text) to anon, authenticated, service_role;
