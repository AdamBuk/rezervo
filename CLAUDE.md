# Rezervační systém pro malé podniky (portfolio MVP)

Rezervační systém pro malé podniky (kadeřnictví, fyzio, masáže).

## Technologie
- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase (PostgreSQL + přihlašování)
- E-maily přes Resend
- Nasazení na Vercel
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
- **Endpointy** (`src/app/api/v1/`): `GET /services`, `GET /slots?service_id&date`, `POST /bookings`, `POST /bookings/{id}/cancel`; neznámé cesty vrací JSON 404.
- **Architektura**: logika v `src/lib/api/handlers.ts` bez závislosti na Next/Supabase (DI přes `ApiDeps`), produkční zapojení v `src/lib/api/supabase-deps.ts` (secret key, `after()` pro e-maily). Validace v `src/lib/api/validation.ts`, odpovědi `{ data }` / `{ error: { code, message, details } }`.
- **Rate limiting**: v Postgresu (`api_rate_limits` + `api_rate_limit_hit`), 120 req/min na klíč, zápisy navíc 20/min. Při výpadku limiteru fail-open.
- **Pravidla rezervace přes API** = jako na webu: min. 30 min předem (`MIN_NOTICE_MINUTES`), max. 60 dní (`BOOKING_HORIZON_DAYS`), zbytek hlídá `create_booking()`.
- **Testy**: `src/lib/api/*.test.ts` (všechny endpointy s in-memory store), DB pravidla klíčů a limitů v `supabase/tests/schema.test.mjs`.
- Při změně API aktualizovat README i tuto sekci.
