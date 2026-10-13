# Rezervační systém pro malé podniky (portfolio MVP)

Rezervační systém pro malé podniky (kadeřnictví, fyzio, masáže).

## Technologie
- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase (PostgreSQL + přihlašování)
- E-maily přes Resend
- Nasazení na Cloudflare Workers
- **UI v češtině, kód a komentáře anglicky.**

## MVP funkce
1. Majitel podniku se zaregistruje a nastaví podnik: název, služby (název, délka v minutách, cena) a otevírací dobu pro každý den v týdnu.
2. Veřejná rezervační stránka podniku (`/[slug-podniku]`): zákazník vybere službu, den a volný časový slot, vyplní jméno, e-mail a telefon a odešle rezervaci. Obsazené termíny se nesmí dát zarezervovat dvakrát.
3. Potvrzovací e-mail zákazníkovi i majiteli, připomínka zákazníkovi den předem.
4. Administrace pro majitele: kalendář rezervací (den/týden), možnost rezervaci zrušit nebo přesunout.

## Fáze
1. Kostra projektu, Tailwind, základní layout a úvodní stránka
2. Supabase, databázové schéma a přihlašování majitele
3. Nastavení podniku, služeb a otevírací doby
4. Veřejná rezervační stránka a výpočet volných slotů
5. Administrace s kalendářem
6. E-maily
7. Demo data (fiktivní "Kadeřnictví U Nůžek"), README se screenshoty, nasazení

## Pravidla
- Fáze provádět postupně, po každé fázi udělat commit.
- Na konci shrnutí: co bylo uděláno, jak aplikaci spustit, co je potřeba nastavit ručně (účty, klíče).

## Stav a poznámky pro vývoj
- Všech 7 fází MVP je hotových (viz git log). Aplikace se jmenuje **Rezervo**.
- Next.js 16: `middleware` je nyní `src/proxy.ts`; `params`/`searchParams` jsou Promise. `cacheComponents` je záměrně vypnuté.
- DB schéma: `supabase/migrations/`. Překryvy rezervací hlídá exclusion constraint `bookings_no_overlap`; zákazníci vytváří rezervace jen přes RPC `create_booking`.
- Po změně schématu aktualizovat ručně psané typy v `src/lib/database.types.ts`.
- Příkazy: `npm run dev`, `npm test` (vitest), `npm run test:db` (PGlite), `npm run lint`, `npm run seed` (demo data, potřebuje `.env.local`).

## Veřejné REST API (hotovo)
Veřejné API pro externí aplikace (připravovaný AI asistent). Dokumentace pro uživatele API je v README (sekce „Veřejné REST API“).
- **API klíč**: každý podnik má nejvýš jeden aktivní klíč (`rzv_live_…`), spravuje ho v administraci `/dashboard/api` – zobrazení, vygenerování nového (starý se zneplatní), zneplatnění. Ověření hlavičkou `Authorization: Bearer <klíč>`.
- **Uložení klíče**: tabulka `api_keys` – `key_hash` (SHA-256, slouží k ověření), `key_prefix`, `key_ciphertext` (AES-256-GCM, aby šel klíč v administraci zobrazit; tajemství v env `API_KEY_ENCRYPTION_SECRET`, neměnit). Majitel nevidí `key_hash` a smí měnit jen `revoked_at`; rotace přes RPC `rotate_api_key` (atomicky).
- **Endpointy** (`src/app/api/v1/`): `GET /services`, `GET /slots?service_id&date`, `POST /bookings`, `GET /bookings/{id}`, `POST /bookings/{id}/cancel`; neznámé cesty vrací JSON 404.
- **Architektura**: logika v `src/lib/api/handlers.ts` bez závislosti na Next/Supabase (DI přes `ApiDeps`), produkční zapojení v `src/lib/api/supabase-deps.ts` (secret key, `after()` pro e-maily). Validace v `src/lib/api/validation.ts`, odpovědi `{ data }` / `{ error: { code, message, details } }`.
- **Rate limiting**: v Postgresu (`api_rate_limits` + `api_rate_limit_hit`), 120 req/min na klíč, zápisy navíc 20/min. Při výpadku limiteru fail-open.
- **Pravidla rezervace přes API** = jako na webu: min. 30 min předem (`MIN_NOTICE_MINUTES`), max. 60 dní (`BOOKING_HORIZON_DAYS`), zbytek hlídá `create_booking()`.
- **Testy**: `src/lib/api/*.test.ts` (všechny endpointy s in-memory store), DB pravidla klíčů a limitů v `supabase/tests/schema.test.mjs`.
- Při změně API aktualizovat README i tuto sekci.

## Další funkce (hotovo)
- **Zrušení zákazníkem**: `/rezervace/[id]/[token]` – token = HMAC(id) (`src/lib/booking-link.ts`, secret `BOOKING_LINK_SECRET` → fallback `API_KEY_ENCRYPTION_SECRET`). Odkaz je v potvrzení, připomínce i na obrazovce po rezervaci. Zrušit lze ≥ `CUSTOMER_CANCEL_NOTICE_HOURS` (2 h) předem; majitel dostane e-mail.
- **Dovolená**: tabulka `closures` (migrace `…_closures.sql`), `create_booking()` hlásí `business_closed`. Respektuje web (`isClosedOn` v `src/lib/slots.ts`), API (`closed_reason`) i přesun v kalendáři. Správa na `/dashboard/hours`.
- **Zapomenuté heslo**: `/forgot-password` → e-mail → `/auth/callback?next=/reset-password` → `/reset-password`.
- **Sdílené validace**: `src/lib/validation.ts` (UUID, jméno, telefon) – používat ve formulářích, API i akcích. Bezpečné přesměrování: `safeRedirectPath()`.
- **Rate limiting**: `isRateLimitedByIp()` (`src/lib/rate-limit.ts`) – bez známé IP se limit přeskočí. Rezervace 8/10 min, zrušení 10/10 min, reset hesla 5/15 min.
- **Tmavý režim**: třída `.dark` na `<html>` (inline skript `THEME_INIT_SCRIPT` v `src/lib/theme.ts` před vykreslením, přepínač `ThemeToggle` – světlý/tmavý/systém, `localStorage.theme`). V `globals.css` se v `.dark` přemapují škály stone/sand/brand/red/amber, takže běžné třídy fungují bez `dark:`. Nepoužívat `bg-white`/`border-white` → `bg-surface`/`border-edge`; plné výplně pod bílým textem → `bg-accent`/`accent-strong`/`accent-deep`, destruktivní tlačítko `btn-destructive` (škála brand je v tmavém režimu zesvětlená pro text).
- **Design systém (inspirace Fresha/Calendly)**: Inter + Inter Tight (nadpisy, utilita `headline`). Bílé pozadí, neutrální šedé (škála `stone` přemapovaná), primární tlačítko černá pilulka `btn-primary` (`bg-ink`), značková fialová (`brand`, plné výplně `bg-accent`/`btn-brand`) pro výběr a zvýraznění, pastelové tinty `sky/blush/sage/butter-100` (rezervace v kalendáři mají barvu podle služby). Náhledy produktu na úvodní stránce jsou v markupu (`src/components/marketing/product-mockups.tsx`) a musí odpovídat skutečné aplikaci (týdenní kalendář). Fotky z Unsplash v `src/lib/photos.ts` přes `next/image` (`images.remotePatterns`).
- **UI pravidla**: vstupy 16 px na dotykových zařízeních (`pointer-coarse`), destruktivní akce přes `ConfirmSubmit`, animace s `--ease-out`/`--ease-drawer` a `motion-reduce` fallbackem (fade).
- Nové top-level routy přidat do `RESERVED_SLUGS` i do `businesses_slug_check` (migrace).

## Tým / více pracovníků (hotovo)
- Tabulky `staff` + `staff_services` (migrace `…_staff.sql`), `bookings.staff_id NOT NULL`; `bookings_no_overlap` je per `staff_id`. Každý podnik má ≥ 1 pracovníka (vytváří se při založení podniku; nová služba se přiřadí všem aktivním).
- `create_booking(…, p_staff_id default null)` – null = „Kdokoli“ (první volný v pořadí `sort_order, created_at, id`). Obsazenost: `get_staff_busy_intervals()`; volné časy: `computeStaffSlots()` / `groupBusyByStaff()` v `src/lib/slots.ts`.
- UI: `/dashboard/staff` (Tým), výběr pracovníka na rezervační stránce jen při ≥ 2 pracovnících dané služby, kalendář – denní pohled sloupce po pracovnících, filtr `?staff=`, překryvy přes `layoutLanes()` (`src/lib/calendar-layout.ts`). E-maily uvádějí pracovníka jen u týmu.
- API: `GET /staff`, `staff_id` v `/slots` i `POST /bookings`, `staff` v rezervaci, `staff_ids` u služeb a slotů.
- Plánováno: pracovní doba pro každého pracovníka zvlášť (teď platí otevírací doba podniku), tarify (Zdarma / Pro 249 Kč), Stripe.

## Nasazení (Cloudflare Workers)
- Produkce: https://rezervo.bukac-adam.workers.dev, repo github.com/AdamBuk/rezervo. Deploy `npm run deploy` (OpenNext build → `scripts/cf-strip-env.mjs` → wrangler), náhled `npm run preview`.
- `NEXT_PUBLIC_*` se vkládají při buildu – produkční `NEXT_PUBLIC_SITE_URL` je v `.env.production.local` (gitignored). Serverová tajemství jen přes `wrangler secret put`.
- Crony: `triggers.crons` ve `wrangler.jsonc` → `custom-worker.ts` (`CRON_ROUTES`, musí sedět) volá `/api/cron/reminders` (denně) a `/api/cron/demo-reset` (hodinově).
- Sdílený demo účet (`src/lib/demo.ts`): v akcích blokovat změny hesla, slugu, e-mailu pro upozornění a API klíče (`isDemoOwner`); demo-reset je vrací.
- Bezpečnostní hlavičky (CSP aj.) v `next.config.ts` – nové externí zdroje (skripty, obrázky, fetch) přidat do CSP.
- `patches/` (patch-package): OpenNext 1.20.11 neinlinuje `preview-props.json` z Next 16.4 – po upgradu OpenNext ověřit, zda je patch ještě potřeba.
- Klientská IP pro rate limiting: `cf-connecting-ip` má přednost.
