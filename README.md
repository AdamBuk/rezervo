# Rezervo – online rezervace pro malé podniky

Rezervační systém pro kadeřnictví, fyzioterapie, masáže a podobné malé podniky. Majitel si nastaví služby a otevírací dobu, zákazníci si sami rezervují volný termín na veřejné stránce podniku a obě strany dostanou e-mail.

> Portfolio projekt · Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase · Resend · Vercel

![Úvodní stránka](docs/screenshots/landing.jpg)

| Veřejná rezervační stránka | Výběr termínu a údaje zákazníka |
| --- | --- |
| ![Výběr služby](docs/screenshots/booking-services.jpg) | ![Výběr termínu](docs/screenshots/booking-slots.jpg) |

![Týdenní kalendář majitele](docs/screenshots/calendar-week.jpg)

<sub>Screenshoty jsou ze skutečných komponent aplikace s ukázkovými daty.</sub>

## Funkce

- **Registrace a přihlášení majitele** (Supabase Auth, e-mail + heslo, potvrzení e-mailu).
- **Nastavení podniku** – název, adresa stránky (`/u-nuzek`), kontakty, služby (délka, cena), otevírací doba pro každý den v týdnu, krok nabízených časů.
- **Veřejná rezervační stránka** `/[slug]` – výběr služby → dne → volného času → kontaktní údaje.
- **Žádné dvojité rezervace** – hlídá to přímo PostgreSQL (`EXCLUDE` constraint nad časovým rozsahem), takže to platí i pro dva zákazníky, kteří kliknou ve stejnou chvíli.
- **E-maily** – potvrzení zákazníkovi, upozornění majiteli, připomínka den předem (Vercel Cron), oznámení o zrušení/přesunu.
- **Administrace** – kalendář den/týden, detail rezervace, zrušení a přesun termínu.

## Architektura a zajímavá místa

| Oblast | Řešení |
| --- | --- |
| Integrita dat | `bookings_no_overlap` – `EXCLUDE USING gist (business_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE status = 'confirmed'`. Navazující termíny (10:00–11:00 a 11:00–12:00) jsou povolené. |
| Vytvoření rezervace | `create_booking()` – `SECURITY DEFINER` funkce, která ověří službu, otevírací dobu, zarovnání času a vloží záznam. Anonymní uživatel nemá k tabulce `bookings` žádný přímý přístup. |
| Obsazenost | `get_busy_intervals()` vrací jen časové intervaly, žádná osobní data zákazníků. |
| Row Level Security | Majitel vidí a mění jen svůj podnik a jeho rezervace; anonym vidí jen veřejné sloupce podniku (bez e-mailu majitele). |
| Časová pásma | Vše se ukládá v UTC, sloty se počítají v časovém pásmu podniku (`Europe/Prague`) přes `Intl` – funguje i na serveru v UTC a přes přechody letního času. |
| Výpočet slotů | Čistá funkce `computeAvailableSlots()` v [`src/lib/slots.ts`](src/lib/slots.ts), pokrytá unit testy. |
| E-maily | Odesílají se přes `after()` až po odpovědi, takže pomalé SMTP nezdrží zákazníka. Bez `RESEND_API_KEY` se jen vypisují do konzole. |
| Připomínky | `/api/cron/reminders` – rezervace se nejdřív „zabere“ nastavením `reminder_sent_at`, takže dva souběžné běhy nepošlou připomínku dvakrát. |

```
src/
  app/
    page.tsx                 úvodní stránka
    (auth)/                  přihlášení, registrace, server actions
    auth/callback/           potvrzení e-mailu ze Supabase
    dashboard/setup/         onboarding nového podniku
    dashboard/(app)/         kalendář, služby, otevírací doba, nastavení
    [slug]/                  veřejná rezervační stránka + booking action
    api/slots/               volné časy pro službu a den
    api/cron/reminders/      denní připomínky
  lib/
    slots.ts, time.ts        výpočet slotů a práce s časovými pásmy
    notifications.ts         e-mailové notifikace
    email/                   Resend klient a šablony
    supabase/                klienti (server, public, admin, proxy)
  proxy.ts                   obnova session, ochrana /dashboard
supabase/migrations/         SQL schéma, RLS, funkce
supabase/tests/              test schématu v PGlite (in-memory Postgres)
scripts/seed.mts             demo data „Kadeřnictví U Nůžek“
```

## Spuštění lokálně

Požadavky: Node.js 20+ a účet na [supabase.com](https://supabase.com) (free tier stačí).

1. **Závislosti**
   ```bash
   npm install
   ```
2. **Supabase projekt** – vytvořte nový projekt a v **SQL Editoru** spusťte celý soubor
   [`supabase/migrations/20261008000000_initial_schema.sql`](supabase/migrations/20261008000000_initial_schema.sql)
   (případně `npx supabase link` + `npx supabase db push`).
3. **Proměnné prostředí** – zkopírujte `.env.example` do `.env.local` a doplňte:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` – *Project Settings → API Keys*
   - `RESEND_API_KEY`, `EMAIL_FROM` – volitelné; bez nich se e-maily jen vypisují do terminálu
   - `CRON_SECRET` – libovolný dlouhý náhodný řetězec
4. **Auth nastavení v Supabase** – *Authentication → URL Configuration*: Site URL `http://localhost:3000`, do Redirect URLs přidejte `http://localhost:3000/auth/callback`.
   (Pro rychlé testování lze v *Authentication → Providers → Email* vypnout „Confirm email“.)
5. **Demo data** (volitelné)
   ```bash
   npm run seed
   ```
   Vytvoří podnik **Kadeřnictví U Nůžek** na `/u-nuzek` a účet `demo@rezervo.test` / `demo-heslo-123`.
6. **Spuštění**
   ```bash
   npm run dev
   ```
   Otevřete http://localhost:3000.

### Testy

```bash
npm test          # unit testy (sloty, časová pásma, e-mailové šablony)
npm run test:db   # SQL migrace + pravidla rezervací a RLS v in-memory Postgresu
npm run lint
```

Připomínky lze vyzkoušet ručně:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders
```

## Nasazení na Vercel

1. Pushněte repozitář na GitHub a v Vercelu zvolte **Add New → Project → Import**.
2. V *Settings → Environment Variables* nastavte stejné proměnné jako v `.env.local`
   (`NEXT_PUBLIC_SITE_URL` nastavte na produkční URL, např. `https://rezervo.vercel.app`).
3. Po nasazení v Supabase (*Authentication → URL Configuration*) změňte Site URL na produkční adresu a přidejte `https://<vaše-doména>/auth/callback` do Redirect URLs.
4. Cron pro připomínky je definovaný ve [`vercel.json`](vercel.json) (denně v 15:00 UTC = 17:00 SELČ). Vercel posílá `CRON_SECRET` automaticky.
5. Pro e-maily na skutečné adresy ověřte v Resendu vlastní doménu a nastavte `EMAIL_FROM` (testovací `onboarding@resend.dev` doručuje jen na e-mail vašeho Resend účtu).

## Omezení MVP a možná rozšíření

- Jeden „zdroj“ na podnik (jedno křeslo/jeden terapeut) – rezervace se nesmí překrývat v rámci celého podniku. Rozšíření: zaměstnanci a jejich vlastní kalendáře.
- Jeden časový interval otevírací doby na den (bez polední pauzy) a bez svátků/dovolených.
- Zákazník nemůže rezervaci zrušit sám odkazem z e-mailu (zatím jen majitel).
- Bez rate-limitingu rezervačního formuláře (jen honeypot).
