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
