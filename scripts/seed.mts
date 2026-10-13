// Seeds the demo business "Kadeřnictví U Nůžek" with services, opening hours
// and realistic bookings for the coming two weeks.
//
//   npm run seed          (reads .env.local; needs SUPABASE_SECRET_KEY)
//
// Safe to run repeatedly: the demo business is recreated from scratch.
// Also issues a public API key; set DEMO_API_KEY (rzv_live_…) to keep the same key across runs.

import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@rezervo.test";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "demo-heslo-123";
const SLUG = "u-nuzek";
const TZ = "Europe/Prague";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY (did you create .env.local?)");
  process.exit(1);
}

const encryptionSecret = process.env.API_KEY_ENCRYPTION_SECRET;
if (!encryptionSecret || encryptionSecret.length < 32) {
  console.error("Missing API_KEY_ENCRYPTION_SECRET (min. 32 chars) – needed to issue the demo API key");
  process.exit(1);
}
const API_KEY_PATTERN = /^rzv_live_[A-Za-z0-9_-]{43}$/;
if (process.env.DEMO_API_KEY && !API_KEY_PATTERN.test(process.env.DEMO_API_KEY)) {
  console.error("DEMO_API_KEY must look like rzv_live_<43 base64url chars>");
  process.exit(1);
}

const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

const SERVICES = [
  { name: "Dámský střih", description: "Mytí, střih a foukaná", duration_minutes: 60, price_czk: 650 },
  { name: "Pánský střih", description: "Střih nůžkami i strojkem", duration_minutes: 30, price_czk: 390 },
  { name: "Dětský střih", description: "Pro děti do 12 let", duration_minutes: 30, price_czk: 250 },
  { name: "Barvení", description: "Celobarva včetně střihu a foukané", duration_minutes: 120, price_czk: 1450 },
  { name: "Melír", description: "Fóliový melír, střih a foukaná", duration_minutes: 150, price_czk: 1890 },
  { name: "Společenský účes", description: "Svatby, plesy, focení", duration_minutes: 90, price_czk: 990 },
];

// Team: who does which services (by name). Each has their own calendar.
// `hours` = own shifts by ISO weekday (within opening hours); without it the opening hours apply.
const STAFF: { name: string; services: string[]; hours?: Record<number, [string, string]> }[] = [
  { name: "Jana", services: SERVICES.map((s) => s.name) },
  {
    name: "Petra",
    services: ["Dámský střih", "Barvení", "Melír", "Společenský účes"],
    hours: { 1: ["09:00", "18:00"], 2: ["09:00", "18:00"], 3: ["10:00", "19:00"], 4: ["09:00", "18:00"] },
  },
  {
    name: "Tomáš",
    services: ["Pánský střih", "Dětský střih", "Dámský střih"],
    hours: { 3: ["12:00", "19:00"], 4: ["12:00", "18:00"], 5: ["12:00", "16:00"], 6: ["09:00", "13:00"] },
  },
];

// ISO weekday → [opens, closes]
const HOURS: Record<number, [string, string]> = {
  1: ["09:00", "18:00"],
  2: ["09:00", "18:00"],
  3: ["10:00", "19:00"],
  4: ["09:00", "18:00"],
  5: ["08:00", "16:00"],
  6: ["09:00", "13:00"],
};

const CUSTOMERS = [
  ["Jana Nováková", "+420 777 123 456"],
  ["Petr Svoboda", "+420 603 222 111"],
  ["Lucie Dvořáková", "+420 724 555 010"],
  ["Tomáš Černý", "+420 731 404 202"],
  ["Kateřina Procházková", "+420 608 900 321"],
  ["Martin Kučera", "+420 775 300 600"],
  ["Eva Veselá", "+420 736 818 818"],
  ["Jakub Horák", "+420 721 145 987"],
  ["Tereza Němcová", "+420 739 456 123"],
  ["Ondřej Marek", "+420 602 789 456"],
  ["Barbora Pokorná", "+420 776 112 233"],
  ["Lukáš Pospíšil", "+420 604 556 677"],
];

// --- tiny timezone helpers (kept local so the script runs with plain `node`) ---

function offsetMs(date: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function pragueToUtc(date: string, minutes: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, 0, minutes);
  let ts = naive - offsetMs(new Date(naive));
  ts = naive - offsetMs(new Date(ts));
  return new Date(ts);
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function isoWeekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

// Deterministic pseudo-random generator so every run produces a similar schedule.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);

function emailFor(name: string) {
  const ascii = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return `${ascii.replace(/\s+/g, ".")}@example.com`;
}

async function getOrCreateDemoUser(): Promise<string> {
  const { data: created, error } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (created?.user) return created.user.id;

  // Already exists – find it and reset the password so the README credentials work.
  for (let page = 1; page < 50; page++) {
    const { data, error: listError } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (listError) throw listError;
    const user = data.users.find((u) => u.email === DEMO_EMAIL);
    if (user) {
      await supabase.auth.admin.updateUserById(user.id, { password: DEMO_PASSWORD });
      return user.id;
    }
    if (data.users.length < 100) break;
  }
  throw error ?? new Error("Could not create demo user");
}

// Mirrors src/lib/api/keys.ts and key-crypto.ts (kept local so the script runs with plain `node`).
function encryptApiKey(plaintext: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(secret, "utf8").digest(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

async function createApiKey(businessId: string, secret: string): Promise<string> {
  const key = process.env.DEMO_API_KEY ?? `rzv_live_${randomBytes(32).toString("base64url")}`;
  const { error } = await supabase.from("api_keys").insert({
    business_id: businessId,
    key_hash: createHash("sha256").update(key, "utf8").digest("hex"),
    key_prefix: key.slice(0, "rzv_live_".length + 4),
    key_ciphertext: encryptApiKey(key, secret),
  });
  if (error) throw error;
  return key;
}

async function main() {
  const ownerId = await getOrCreateDemoUser();
  console.log(`Demo user: ${DEMO_EMAIL} (${ownerId})`);

  // Recreate the business (cascades to services, hours and bookings).
  await supabase.from("businesses").delete().eq("slug", SLUG);
  await supabase.from("businesses").delete().eq("owner_id", ownerId);

  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .insert({
      owner_id: ownerId,
      name: "Kadeřnictví U Nůžek",
      slug: SLUG,
      description:
        "Rodinné kadeřnictví v centru Prahy. Střihy, barvení a společenské účesy – bez čekání, s kávou a dobrou náladou.",
      address: "Dlouhá 12, 110 00 Praha 1",
      phone: "+420 602 111 222",
      notification_email: DEMO_EMAIL,
      timezone: TZ,
      slot_step_minutes: 15,
    })
    .select("id")
    .single();
  if (bizError) throw bizError;

  const { data: services, error: svcError } = await supabase
    .from("services")
    .insert(SERVICES.map((s, i) => ({ ...s, business_id: business.id, sort_order: i })))
    .select("id, name, duration_minutes");
  if (svcError) throw svcError;

  const { error: hoursError } = await supabase.from("opening_hours").insert(
    Object.entries(HOURS).map(([weekday, [opens_at, closes_at]]) => ({
      business_id: business.id,
      weekday: Number(weekday),
      opens_at,
      closes_at,
    })),
  );
  if (hoursError) throw hoursError;

  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .insert(STAFF.map((m, i) => ({ business_id: business.id, name: m.name, sort_order: i, uses_business_hours: !m.hours })))
    .select("id, name");
  if (staffError) throw staffError;

  const staffServices = STAFF.flatMap((m) => {
    const staffId = staff.find((x) => x.name === m.name)!.id;
    return services.filter((s) => m.services.includes(s.name)).map((s) => ({ staff_id: staffId, service_id: s.id }));
  });
  const { error: linkError } = await supabase.from("staff_services").insert(staffServices);
  if (linkError) throw linkError;

  const shifts = STAFF.flatMap((m) =>
    Object.entries(m.hours ?? {}).map(([weekday, [opens_at, closes_at]]) => ({
      staff_id: staff.find((x) => x.name === m.name)!.id,
      weekday: Number(weekday),
      opens_at,
      closes_at,
    })),
  );
  const { error: shiftError } = await supabase.from("staff_hours").insert(shifts);
  if (shiftError) throw shiftError;

  // Bookings: from 3 days ago to 14 days ahead, filling ~55 % of each staff member's day.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const bookings = [];
  for (let offset = -3; offset <= 14; offset++) {
    const date = addDays(today, offset);
    const hours = HOURS[isoWeekday(date)];
    if (!hours) continue;

    for (const member of staff) {
      const own = services.filter((s) => staffServices.some((l) => l.staff_id === member.id && l.service_id === s.id));
      const custom = STAFF.find((m) => m.name === member.name)!.hours;
      const shift = custom ? custom[isoWeekday(date)] : hours;
      if (!shift) continue; // day off
      let cursor = toMin(shift[0]);
      const close = toMin(shift[1]);
      while (cursor < close) {
        // Leave gaps so the booking page shows free slots.
        if (rand() < 0.45) {
          cursor += 30;
          continue;
        }
        const service = own[Math.floor(rand() * own.length)];
        if (cursor + service.duration_minutes > close) break;

        const [name, phone] = CUSTOMERS[Math.floor(rand() * CUSTOMERS.length)];
        const start = pragueToUtc(date, cursor);
        bookings.push({
          business_id: business.id,
          service_id: service.id,
          staff_id: member.id,
          customer_name: name,
          customer_email: emailFor(name),
          customer_phone: phone,
          starts_at: start.toISOString(),
          ends_at: new Date(start.getTime() + service.duration_minutes * 60_000).toISOString(),
          status: rand() < 0.06 ? "cancelled" : "confirmed",
          // Don't trigger reminder e-mails to fake customers.
          reminder_sent_at: new Date().toISOString(),
        });
        cursor += service.duration_minutes;
      }
    }
  }

  const { error: bookingError } = await supabase.from("bookings").insert(bookings);
  if (bookingError) throw bookingError;

  const apiKey = await createApiKey(business.id, encryptionSecret!);

  console.log(`Created business /${SLUG} with ${services.length} services, ${staff.length} staff and ${bookings.length} bookings.`);
  console.log(`Log in at /login with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`API key: ${apiKey}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
