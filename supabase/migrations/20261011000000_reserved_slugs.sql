-- Rezervo: reserve slugs used by new top-level routes (password reset, customer booking links).
-- Keep in sync with RESERVED_SLUGS in src/lib/constants.ts.

alter table public.businesses drop constraint businesses_slug_check;
alter table public.businesses add constraint businesses_slug_check check (
  char_length(slug) between 3 and 60
  and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  and slug not in (
    'login', 'register', 'logout', 'dashboard', 'auth', 'api', 'admin', 'about',
    'forgot-password', 'reset-password', 'rezervace'
  )
);
