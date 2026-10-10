-- Rezervo: API keys and rate limiting for the public REST API (/api/v1).
-- Run after 20261008000000_initial_schema.sql.

-- ---------------------------------------------------------------------------
-- API keys
-- ---------------------------------------------------------------------------

-- Keys are verified by their SHA-256 hash. So the owner can look the key up in
-- the dashboard later, it's also stored encrypted (AES-256-GCM) with a secret
-- that only the app server knows (API_KEY_ENCRYPTION_SECRET).
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  -- First characters of the key, so the owner can recognise it in the dashboard.
  key_prefix text not null check (char_length(key_prefix) between 8 and 20),
  key_ciphertext text not null check (char_length(key_ciphertext) <= 500),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- At most one active key per business.
create unique index api_keys_one_active_per_business on public.api_keys (business_id) where revoked_at is null;

alter table public.api_keys enable row level security;

create policy "owner reads api keys" on public.api_keys
  for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy "owner creates api keys" on public.api_keys
  for insert to authenticated
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy "owner revokes api keys" on public.api_keys
  for update to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));

-- Owners never read the hash back and can only change revoked_at.
grant select (id, business_id, key_prefix, key_ciphertext, created_at, last_used_at, revoked_at) on public.api_keys to authenticated;
grant insert (business_id, key_hash, key_prefix, key_ciphertext) on public.api_keys to authenticated;
grant update (revoked_at) on public.api_keys to authenticated;
-- The API itself verifies keys with the secret key (service_role).
grant all on public.api_keys to service_role;

-- Revokes the owner's active key and stores a new one in a single transaction.
-- Runs with the caller's privileges, so RLS still applies.
create or replace function public.rotate_api_key(p_key_hash text, p_key_prefix text, p_key_ciphertext text)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_id uuid;
begin
  select id into v_business_id from public.businesses where owner_id = (select auth.uid());
  if not found then
    raise exception 'business_not_found';
  end if;

  update public.api_keys set revoked_at = now()
  where business_id = v_business_id and revoked_at is null;

  insert into public.api_keys (business_id, key_hash, key_prefix, key_ciphertext)
  values (v_business_id, p_key_hash, p_key_prefix, p_key_ciphertext)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.rotate_api_key(text, text, text) from public;
grant execute on function public.rotate_api_key(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window, shared by all serverless instances)
-- ---------------------------------------------------------------------------

create table public.api_rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (bucket, window_start)
);

-- No policies: only service_role (which bypasses RLS) touches this table.
alter table public.api_rate_limits enable row level security;
grant all on public.api_rate_limits to service_role;

-- Counts one request in the current window of `p_bucket`.
create or replace function public.api_rate_limit_hit(p_bucket text, p_limit int, p_window_seconds int)
returns table (allowed boolean, remaining int, reset_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_hits int;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid_rate_limit';
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.api_rate_limits as r (bucket, window_start, hits)
  values (p_bucket, v_window_start, 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- Occasional cleanup of finished windows keeps the table small without a cron job.
  if random() < 0.01 then
    delete from public.api_rate_limits where window_start < now() - interval '1 day';
  end if;

  return query select
    v_hits <= p_limit,
    greatest(p_limit - v_hits, 0),
    v_window_start + make_interval(secs => p_window_seconds);
end;
$$;

revoke execute on function public.api_rate_limit_hit(text, int, int) from public;
grant execute on function public.api_rate_limit_hit(text, int, int) to service_role;
