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
- **Administrace** – kalendář den/týden se souhrnem (počet rezervací, očekávaná tržba, nejbližší zákazník) a čarou aktuálního času, detail rezervace, zrušení a přesun termínu.
- **Pohodlí pro zákazníka** – automatický skok na nejbližší volný den, po rezervaci přidání do Google/Apple/Outlook kalendáře (.ics).
- **Ochrana proti spamu** – honeypot a limit 5 rezervací za 10 minut z jedné IP adresy (sdílený Postgres rate limiter).
- **Veřejné REST API** pro externí aplikace (např. AI asistenta) – služby, volné termíny, vytvoření a zrušení rezervace; API klíč si majitel spravuje v administraci. Viz [Veřejné REST API](#veřejné-rest-api).

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
| Veřejné API | Klíče se ověřují podle SHA-256 hashe; pro zobrazení v administraci jsou navíc uložené šifrovaně (AES-256-GCM, tajemství jen na serveru). Rotace je atomická (`rotate_api_key()`), rate limiting běží v Postgresu (`api_rate_limit_hit()`), takže platí napříč serverless instancemi. Handlery v [`src/lib/api/handlers.ts`](src/lib/api/handlers.ts) nemají přímou závislost na Supabase a jsou plně pokryté testy. |
| Připomínky | `/api/cron/reminders` – rezervace se nejdřív „zabere“ nastavením `reminder_sent_at`, takže dva souběžné běhy nepošlou připomínku dvakrát. |

```
src/
  app/
    page.tsx                 úvodní stránka
    (auth)/                  přihlášení, registrace, server actions
    auth/callback/           potvrzení e-mailu ze Supabase
    dashboard/setup/         onboarding nového podniku
    dashboard/(app)/         kalendář, služby, otevírací doba, nastavení, API klíč
    [slug]/                  veřejná rezervační stránka + booking action
    api/slots/               volné časy pro službu a den
    api/cron/reminders/      denní připomínky
    api/v1/                  veřejné REST API (služby, sloty, rezervace)
  lib/
    slots.ts, time.ts        výpočet slotů a práce s časovými pásmy
    notifications.ts         e-mailové notifikace
    email/                   Resend klient a šablony
    supabase/                klienti (server, public, admin, proxy)
    api/                     API klíče (generování, šifrování), validace, handlery, napojení na Supabase
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
2. **Supabase projekt** – vytvořte nový projekt a v **SQL Editoru** spusťte postupně všechny soubory ze
   [`supabase/migrations/`](supabase/migrations/) v pořadí podle názvu
   (`20261008000000_initial_schema.sql`, pak `20261010000000_public_api.sql`),
   případně `npx supabase link` + `npx supabase db push`.
3. **Proměnné prostředí** – zkopírujte `.env.example` do `.env.local` a doplňte:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` – *Project Settings → API Keys* (secret key je nutný pro e-maily, připomínky, seed a veřejné API)
   - `RESEND_API_KEY`, `EMAIL_FROM` – volitelné; bez nich se e-maily jen vypisují do terminálu
   - `CRON_SECRET` – libovolný dlouhý náhodný řetězec
   - `API_KEY_ENCRYPTION_SECRET` – náhodný řetězec (min. 32 znaků), kterým se šifrují uložené API klíče; vygenerujete ho příkazem `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Hodnotu později neměňte – jinak stávající klíč nepůjde v administraci zobrazit (fungovat ale bude dál).
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
npm test          # unit testy (sloty, časová pásma, e-mailové šablony, veřejné API)
npm run test:db   # SQL migrace + pravidla rezervací, RLS, API klíče a rate limit v in-memory Postgresu
npm run lint
```

Připomínky lze vyzkoušet ručně:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders
```

## Veřejné REST API

API pro externí aplikace (AI asistent, vlastní web, integrace). Každý požadavek se vztahuje k podniku, kterému patří použitý API klíč.

### API klíč

1. V administraci otevřete **API** (`/dashboard/api`) a klikněte na **Vygenerovat API klíč**.
2. Klíč (`rzv_live_…`) se zobrazí hned po vygenerování a kdykoli později přes **Zobrazit klíč** (s tlačítkem Kopírovat). V administraci vidíte i datum vytvoření a posledního použití.
3. **Vygenerovat nový klíč** okamžitě zneplatní ten starý (podnik má vždy nejvýš jeden aktivní klíč). **Zneplatnit klíč** odebere přístup bez náhrady – použijte, pokud klíč unikl.

Klíč posílejte v hlavičce každého požadavku:

```
Authorization: Bearer rzv_live_…
```

Klíč je tajný – patří na server (backend AI asistenta), ne do kódu v prohlížeči nebo mobilní aplikaci. API proto neposílá CORS hlavičky.

### Základní informace

| | |
| --- | --- |
| Základní URL | `https://<vaše-doména>/api/v1` (lokálně `http://localhost:3000/api/v1`) |
| Formát | JSON (UTF-8); požadavky s tělem vyžadují `Content-Type: application/json`, max. 10 kB |
| Čas | Vstupy i výstupy v ISO 8601. `starts_at` musí obsahovat časovou zónu (`Z` nebo `+02:00`). Odpovědi vrací UTC a navíc `local_time` / `local_date` v časovém pásmu podniku. |
| Úspěch | `{ "data": … }` (u seznamu služeb navíc `meta`) |
| Chyba | `{ "error": { "code": "…", "message": "…", "details": … } }` – `code` je stabilní, `message` je lidsky čitelný popis (anglicky) |

### Rate limiting

| Limit | Hodnota |
| --- | --- |
| Všechny požadavky | 120 / minutu na klíč |
| Vytvoření a zrušení rezervace | navíc 20 / minutu na klíč |

Každá ověřená odpověď obsahuje hlavičky `RateLimit-Limit`, `RateLimit-Remaining` a `RateLimit-Reset` (sekundy do obnovení). Po překročení API vrací `429 rate_limited` s hlavičkou `Retry-After`.

### Endpointy

#### `GET /services` – seznam služeb

```bash
curl https://<doména>/api/v1/services -H "Authorization: Bearer $REZERVO_API_KEY"
```

```json
{
  "data": [
    { "id": "5b0c6f8e-…", "name": "Pánský střih", "description": "Střih nůžkami i strojkem", "duration_minutes": 30, "price_czk": 450 }
  ],
  "meta": { "business": { "name": "Kadeřnictví U Nůžek", "slug": "u-nuzek", "timezone": "Europe/Prague" } }
}
```

Vrací jen aktivní služby v pořadí jako na rezervační stránce.

#### `GET /slots?service_id=<uuid>&date=YYYY-MM-DD` – volné termíny

```bash
curl "https://<doména>/api/v1/slots?service_id=5b0c6f8e-…&date=2026-10-14" -H "Authorization: Bearer $REZERVO_API_KEY"
```

```json
{
  "data": {
    "date": "2026-10-14",
    "timezone": "Europe/Prague",
    "closed": false,
    "service": { "id": "5b0c6f8e-…", "name": "Pánský střih", "duration_minutes": 30 },
    "slots": [
      { "starts_at": "2026-10-14T07:00:00.000Z", "ends_at": "2026-10-14T07:30:00.000Z", "local_time": "09:00" }
    ]
  }
}
```

`date` je kalendářní den v časovém pásmu podniku. Rezervovat lze od dneška do 60 dnů dopředu (jinak `422 date_out_of_range` s `details.min_date` / `details.max_date`). Zavřený den vrací `closed: true` a prázdné `slots`. Termíny začínající dřív než za 30 minut se nenabízejí.

#### `POST /bookings` – vytvoření rezervace

```bash
curl -X POST https://<doména>/api/v1/bookings \
  -H "Authorization: Bearer $REZERVO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "5b0c6f8e-…",
    "starts_at": "2026-10-14T09:00:00+02:00",
    "customer": { "name": "Jana Nováková", "email": "jana@example.cz", "phone": "+420 777 123 456" }
  }'
```

Odpověď `201 Created` (+ hlavička `Location`):

```json
{
  "data": {
    "id": "9d4f…",
    "status": "confirmed",
    "starts_at": "2026-10-14T07:00:00.000Z",
    "ends_at": "2026-10-14T07:30:00.000Z",
    "local_date": "2026-10-14",
    "local_time": "09:00",
    "timezone": "Europe/Prague",
    "service": { "id": "5b0c6f8e-…", "name": "Pánský střih", "duration_minutes": 30, "price_czk": 450 },
    "customer": { "name": "Jana Nováková", "email": "jana@example.cz", "phone": "+420 777 123 456" },
    "created_at": "2026-10-10T09:12:00.000Z"
  }
}
```

`starts_at` použijte přesně z odpovědi `/slots`. Zákazník i majitel dostanou stejné e-maily jako u rezervace z webu. Validace: `customer.name` 2–100 znaků, platný `customer.email`, `customer.phone` 6–30 znaků (číslice, mezery, `()`, `-`, volitelně `+` na začátku). Dvojí rezervaci téhož času brání databáze i při souběžných požadavcích – druhý dostane `409 slot_taken`.

#### `POST /bookings/{id}/cancel` – zrušení rezervace

```bash
curl -X POST https://<doména>/api/v1/bookings/9d4f…/cancel -H "Authorization: Bearer $REZERVO_API_KEY"
```

Vrací `200` a rezervaci se `"status": "cancelled"`; zákazník dostane e-mail o zrušení a termín se uvolní. Zrušit lze jen potvrzenou rezervaci, která ještě nezačala.

### Chybové kódy

| HTTP | `code` | Kdy |
| --- | --- | --- |
| 400 | `validation_error` | Neplatné parametry nebo tělo; `details` obsahuje seznam `{ field, message }` |
| 400 | `invalid_json` | Tělo není platný JSON |
| 401 | `missing_api_key` | Chybí hlavička `Authorization` |
| 401 | `invalid_authorization_header` | Hlavička není ve tvaru `Bearer <klíč>` |
| 401 | `invalid_api_key` | Neznámý nebo zneplatněný klíč |
| 404 | `service_not_found` | Služba neexistuje, není aktivní nebo patří jinému podniku |
| 404 | `booking_not_found` | Rezervace neexistuje nebo patří jinému podniku |
| 404 | `not_found` | Neznámý endpoint |
| 405 | – | Nepodporovaná HTTP metoda |
| 409 | `slot_taken` | Termín je už obsazený – načtěte znovu `/slots` |
| 409 | `booking_already_cancelled` | Rezervace už je zrušená |
| 409 | `booking_in_past` | Rezervace už začala nebo proběhla |
| 413 | `payload_too_large` | Tělo je větší než 10 kB |
| 415 | `unsupported_media_type` | Chybí `Content-Type: application/json` |
| 422 | `slot_in_past` | Termín je v minulosti |
| 422 | `slot_too_soon` | Termín začíná dřív než za 30 minut |
| 422 | `date_out_of_range` | Datum je mimo rezervační okno (dnes až +60 dní) |
| 422 | `outside_opening_hours` | Služba se nevejde do otevírací doby |
| 422 | `slot_misaligned` | Čas neodpovídá nabízeným slotům (krok podniku) |
| 429 | `rate_limited` | Překročený limit, viz `Retry-After` |
| 500 | `internal_error` | Chyba na straně serveru (detaily jen v logu) |

### Doporučený postup pro AI asistenta

1. `GET /services` → nabídnout službu a zjistit `timezone` podniku.
2. `GET /slots` pro zvolený den → nabídnout časy (`local_time`).
3. `POST /bookings` se `starts_at` vybraného slotu. Při `409 slot_taken` načíst sloty znovu a nabídnout jiný čas.
4. Uložit si `data.id` – je potřeba pro `POST /bookings/{id}/cancel`.

## Nasazení na Vercel

1. Pushněte repozitář na GitHub a v Vercelu zvolte **Add New → Project → Import**.
2. V *Settings → Environment Variables* nastavte stejné proměnné jako v `.env.local` (včetně `API_KEY_ENCRYPTION_SECRET`)
   (`NEXT_PUBLIC_SITE_URL` nastavte na produkční URL, např. `https://rezervo.vercel.app`).
3. Po nasazení v Supabase (*Authentication → URL Configuration*) změňte Site URL na produkční adresu a přidejte `https://<vaše-doména>/auth/callback` do Redirect URLs.
4. Cron pro připomínky je definovaný ve [`vercel.json`](vercel.json) (denně v 15:00 UTC = 17:00 SELČ). Vercel posílá `CRON_SECRET` automaticky.
5. Pro e-maily na skutečné adresy ověřte v Resendu vlastní doménu a nastavte `EMAIL_FROM` (testovací `onboarding@resend.dev` doručuje jen na e-mail vašeho Resend účtu).

## Omezení MVP a možná rozšíření

- Jeden „zdroj“ na podnik (jedno křeslo/jeden terapeut) – rezervace se nesmí překrývat v rámci celého podniku. Rozšíření: zaměstnanci a jejich vlastní kalendáře.
- Jeden časový interval otevírací doby na den (bez polední pauzy) a bez svátků/dovolených.
- Zákazník nemůže rezervaci zrušit sám odkazem z e-mailu (zatím jen majitel).
