import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Runs the SQL migrations in an in-memory Postgres (PGlite) with a minimal
// Supabase stub (auth schema, anon/authenticated roles) and checks booking
// rules and Row Level Security.  Usage: npm run test:db

const dir = join(import.meta.dirname, "..", "migrations");
const migrations = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().map((f) => join(dir, f));
const db = new PGlite({ extensions: { btree_gist } });

// Minimal Supabase environment stub
await db.exec(`
  create schema extensions;
  create schema auth;
  create role anon; create role authenticated; create role service_role bypassrls;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated, service_role;
  set search_path = public, extensions;
`);
// Existing data must survive the staff migration: seed a legacy business right before it.
const legacyOwner = "44444444-4444-4444-4444-444444444444";
for (const m of migrations) {
  if (m.endsWith("_staff.sql")) {
    await db.exec(`
      insert into auth.users values ('${legacyOwner}', 'legacy@x.cz');
      insert into businesses (id, owner_id, name, slug, notification_email)
        values ('55555555-5555-5555-5555-555555555555', '${legacyOwner}', 'Legacy', 'legacy-biz', 'legacy@x.cz');
      insert into services (id, business_id, name, duration_minutes, price_czk)
        values ('66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555555', 'Střih', 30, 300);
      insert into bookings (business_id, service_id, customer_name, customer_email, customer_phone, starts_at, ends_at)
        values ('55555555-5555-5555-5555-555555555555', '66666666-6666-6666-6666-666666666666', 'Eva', 'e@x.cz', '777777777',
                now() + interval '1 day', now() + interval '1 day 30 minutes');
    `);
  }
  await db.exec(readFileSync(m, "utf8"));
}
console.log("migrations ok");
{
  const { rows } = await db.query(`
    select st.name, (select count(*) from staff_services ss where ss.staff_id = st.id)::int as services,
           (select count(*) from bookings b where b.staff_id = st.id)::int as bookings
    from staff st where st.business_id = '55555555-5555-5555-5555-555555555555'`);
  const ok = rows.length === 1 && rows[0].services === 1 && rows[0].bookings === 1;
  console.log(ok ? "ok  " : "FAIL", "legacy data migrated to a default staff member", JSON.stringify(rows));
  if (!ok) process.exitCode = 1;
}

let failures = 0;
async function expect(label, fn, expected) {
  try {
    const r = await fn();
    if (expected instanceof RegExp) { console.log("FAIL (no error)", label); failures++; }
    else console.log("ok  ", label, JSON.stringify(r ?? "").slice(0, 120));
  } catch (e) {
    if (expected instanceof RegExp && expected.test(e.message)) console.log("ok  ", label, "->", e.message);
    else { console.log("FAIL", label, e.message); failures++; }
  }
}

const owner = "11111111-1111-1111-1111-111111111111";
const other = "22222222-2222-2222-2222-222222222222";
await db.exec(`insert into auth.users values ('${owner}','o@x.cz'),('${other}','p@x.cz')`);
const { rows: [biz] } = await db.query(
  `insert into businesses (owner_id,name,slug,notification_email) values ($1,'Test','test-biz','o@x.cz') returning id`, [owner]);
const { rows: [svc] } = await db.query(
  `insert into services (business_id,name,duration_minutes,price_czk) values ($1,'Střih',60,500) returning id`, [biz.id]);
// Open every day 09:00-17:00
await db.query(`insert into opening_hours select $1, d, '09:00', '17:00' from generate_series(1,7) d`, [biz.id]);
// One staff member doing the service (a second one is added in the staff section below)
const { rows: [jana] } = await db.query(
  `insert into staff (business_id,name,sort_order) values ($1,'Jana',0) returning id`, [biz.id]);
await db.query(`insert into staff_services values ($1,$2)`, [jana.id, svc.id]);

// A Prague-local 10:00 slot a few days ahead
const { rows: [{ d }] } = await db.query(
  `select ((now() at time zone 'Europe/Prague')::date + 3 + time '10:00') at time zone 'Europe/Prague' as d`);
const at = (offsetMin) => new Date(new Date(d).getTime() + offsetMin * 60000).toISOString();
const book = (start, sid = svc.id, staffId = null) => db.query(
  `select create_booking($1,$2,$3,'Jan Novák','Jan@Example.cz',' 777123456 ',$4) as id`, [biz.id, sid, start, staffId]);

await db.exec("set role anon");
await expect("anon books 10:00", () => book(at(0)).then(r => r.rows[0]));
await expect("anon double-books 10:00", () => book(at(0)), /slot_taken/);
await expect("anon overlapping 10:30", () => book(at(30)), /slot_taken/);
await expect("anon back-to-back 11:00", () => book(at(60)).then(r => r.rows[0]));
await expect("anon back-to-back 09:00", () => book(at(-60)).then(r => r.rows[0]));
await expect("misaligned 12:07", () => book(at(127)), /slot_misaligned/);
await expect("before opening 08:00", () => book(at(-120)), /outside_opening_hours/);
await expect("ends after close 16:30", () => book(at(390)), /outside_opening_hours/);
await expect("ends exactly at close 16:00", () => book(at(360)).then(r => r.rows[0]));
await expect("past slot", () => book("2020-01-01T10:00:00Z"), /slot_in_past/);
await expect("wrong service", () => book(at(240), "33333333-3333-3333-3333-333333333333"), /service_not_found/);
await expect("anon cannot read bookings", () => db.query("select * from bookings"), /permission denied/);
await expect("anon cannot insert bookings directly", () => db.query(
  `insert into bookings (business_id,service_id,customer_name,customer_email,customer_phone,starts_at,ends_at)
   values ($1,$2,'x','a@b.cz','777777777',now(),now()+interval '1h')`, [biz.id, svc.id]), /permission denied/);
await expect("anon busy intervals per staff", () => db.query(
  "select staff_id from get_staff_busy_intervals($1, now(), now() + interval '10 days')", [biz.id]).then(r => {
    if (!r.rows.length || r.rows.some((x) => x.staff_id !== jana.id)) throw new Error(JSON.stringify(r.rows));
    return r.rows.length;
  }));
await expect("anon reads services", () => db.query("select count(*) from services").then(r => r.rows[0]));
await expect("anon cannot insert service", () => db.query(
  "insert into services (business_id,name,duration_minutes,price_czk) values ($1,'x',30,1)", [biz.id]), /permission denied|row-level/);
await expect("anon reads public business columns", () => db.query("select id, name, slug, timezone, slot_step_minutes from businesses").then(r => r.rows.length));
await expect("anon cannot read notification_email", () => db.query("select notification_email from businesses"), /permission denied/);
await db.exec("reset role");

await db.exec(`set role authenticated; set request.jwt.claim.sub = '${other}'`);
await expect("other user sees 0 bookings", () => db.query("select count(*) from bookings").then(r => r.rows[0]));
await expect("other user cannot add service", () => db.query(
  "insert into services (business_id,name,duration_minutes,price_czk) values ($1,'x',30,1)", [biz.id]), /row-level/);
await expect("other user update biz affects 0", () => db.query("update businesses set name='Hack' where id=$1", [biz.id]).then(r => r.affectedRows));
await expect("reserved slug (new route)", () => db.query(
  `insert into businesses (owner_id,name,slug,notification_email) values ($1,'XY','reset-password','p@x.cz')`, [other]), /check constraint/);
await expect("reserved slug", () => db.query(
  `insert into businesses (owner_id,name,slug,notification_email) values ($1,'XY','dashboard','p@x.cz')`, [other]), /check constraint/);
await db.exec("reset role");

await db.exec(`set role authenticated; set request.jwt.claim.sub = '${owner}'`);
await expect("owner sees bookings", () => db.query("select count(*) from bookings").then(r => r.rows[0]));
await expect("owner moves 11:00 onto 10:00 -> conflict", () => db.query(
  `update bookings set starts_at=$1, ends_at=$2 where starts_at=$3`, [at(0), at(60), at(60)]), /bookings_no_overlap/);
await expect("owner cancels 10:00", () => db.query(`update bookings set status='cancelled' where starts_at=$1`, [at(0)]).then(r => r.affectedRows));
await db.exec("reset role");
await db.exec("set role anon");
await expect("rebook cancelled slot 10:00", () => book(at(0)).then(r => r.rows[0]));
await db.exec("reset role");

// --- Public API: keys and rate limiting ------------------------------------
const hash = (c) => c.repeat(64);
const rotate = (h) => db.query("select rotate_api_key($1, 'rzv_live_abcd', 'v1.iv.tag.ct') as id", [h]);

await db.exec(`set role authenticated; set request.jwt.claim.sub = '${owner}'`);
await expect("owner creates api key", () => rotate(hash("a")).then(r => r.rows.length));
await expect("owner rotates api key", () => rotate(hash("b")).then(r => r.rows.length));
await expect("one active key after rotation", () => db.query(
  "select count(*) filter (where revoked_at is null) as active, count(*) as total from api_keys").then(r => r.rows[0]));
await expect("owner cannot read key_hash", () => db.query("select key_hash from api_keys"), /permission denied/);
await expect("owner reads encrypted key", () => db.query("select key_ciphertext from api_keys where revoked_at is null").then(r => {
    if (r.rows[0]?.key_ciphertext !== 'v1.iv.tag.ct') throw new Error(JSON.stringify(r.rows));
    return r.rows.length;
  }));
await expect("owner cannot change key_hash", () => db.query("update api_keys set key_hash = $1", [hash("c")]), /permission denied/);
await expect("second active key rejected", () => db.query(
  "insert into api_keys (business_id, key_hash, key_prefix, key_ciphertext) values ($1, $2, 'rzv_live_x', 'v1.iv.tag.ct')", [biz.id, hash("d")]),
  /api_keys_one_active_per_business/);
await expect("invalid hash rejected", () => rotate("not-a-hash"), /api_keys_key_hash_check/);
await db.exec("reset role");

await db.exec(`set role authenticated; set request.jwt.claim.sub = '${other}'`);
await expect("other user sees 0 api keys", () => db.query("select count(*) from api_keys").then(r => r.rows[0]));
await expect("other user cannot rotate without business", () => rotate(hash("e")), /business_not_found/);
await expect("other user cannot add key to foreign business", () => db.query(
  "insert into api_keys (business_id, key_hash, key_prefix, key_ciphertext) values ($1, $2, 'rzv_live_x', 'v1.iv.tag.ct')", [biz.id, hash("f")]), /row-level/);
await expect("other user revoke affects 0", () => db.query(
  "update api_keys set revoked_at = now() where business_id = $1", [biz.id]).then(r => r.affectedRows));
await expect("authenticated cannot use rate limiter", () => db.query("select * from api_rate_limit_hit('x', 1, 60)"), /permission denied/);
await db.exec("reset role");

await db.exec("set role anon");
await expect("anon cannot read api keys", () => db.query("select id from api_keys"), /permission denied/);
await db.exec("reset role");

await db.exec("set role service_role");
await expect("service role finds active key", () => db.query(
  "select business_id from api_keys where key_hash = $1 and revoked_at is null", [hash("b")]).then(r => {
    if (r.rows.length !== 1) throw new Error(`expected 1 row, got ${r.rows.length}`);
    return r.rows.length;
  }));
const hit = () => db.query("select * from api_rate_limit_hit('test', 2, 3600)").then(r => r.rows[0]);
await expect("rate limit hit 1 allowed", async () => { const r = await hit(); if (!r.allowed || r.remaining !== 1) throw new Error(JSON.stringify(r)); return r; });
await expect("rate limit hit 2 allowed", async () => { const r = await hit(); if (!r.allowed || r.remaining !== 0) throw new Error(JSON.stringify(r)); return r; });
await expect("rate limit hit 3 denied", async () => { const r = await hit(); if (r.allowed) throw new Error(JSON.stringify(r)); return r; });
await expect("rate limit rejects bad config", () => db.query("select * from api_rate_limit_hit('x', 0, 60)"), /invalid_rate_limit/);
await db.exec("reset role");

// --- Closures (holidays) ---------------------------------------------------
const { rows: [{ day4 }] } = await db.query(`select ((now() at time zone 'Europe/Prague')::date + 4)::text as day4`);
const at4 = new Date(new Date(d).getTime() + 86400000).toISOString(); // 10:00 local, day + 4
await db.exec(`set role authenticated; set request.jwt.claim.sub = '${owner}'`);
await expect("owner adds closure", () => db.query(
  "insert into closures (business_id, starts_on, ends_on, note) values ($1, $2, $2, 'Dovolená') returning id", [biz.id, day4]).then(r => r.rows.length));
await expect("closure end before start rejected", () => db.query(
  "insert into closures (business_id, starts_on, ends_on) values ($1, $2::date, $2::date - 1)", [biz.id, day4]), /check constraint/);
await db.exec("reset role");

await db.exec(`set role authenticated; set request.jwt.claim.sub = '${other}'`);
await expect("other user cannot add closure", () => db.query(
  "insert into closures (business_id, starts_on, ends_on) values ($1, $2, $2)", [biz.id, day4]), /row-level/);
await db.exec("reset role");

await db.exec("set role anon");
await expect("anon reads closure dates", () => db.query("select starts_on, ends_on from closures").then(r => {
  if (r.rows.length !== 1) throw new Error(`expected 1, got ${r.rows.length}`);
  return r.rows.length;
}));
await expect("anon cannot read closure note", () => db.query("select note from closures"), /permission denied/);
await expect("booking on closed day rejected", () => book(at4), /business_closed/);
await db.exec("reset role");

// --- Staff ------------------------------------------------------------------
const slot = at(180); // 13:00 local, free so far
const { rows: [petr] } = await db.query(
  `insert into staff (business_id,name,sort_order) values ($1,'Petr',1) returning id`, [biz.id]);
const { rows: [svc2] } = await db.query(
  `insert into services (business_id,name,duration_minutes,price_czk) values ($1,'Vousy',30,200) returning id`, [biz.id]);
await db.query(`insert into staff_services values ($1,$2),($3,$4)`, [petr.id, svc.id, jana.id, svc2.id]);
const staffOf = (id) => db.query("select staff_id from bookings where id = $1", [id]).then(r => r.rows[0].staff_id);

await db.exec("set role anon");
const first = await book(slot).then(r => r.rows[0].id);
const second = await book(slot).then(r => r.rows[0].id);
await expect("anyone: third booking at same slot taken", () => book(slot), /slot_taken/);
await expect("specific busy staff -> slot_taken", () => book(at(240), svc.id, jana.id).then(() => book(at(240), svc.id, jana.id)), /slot_taken/);
await expect("specific free staff books", () => book(at(240), svc.id, petr.id).then(r => r.rows[0]));
await expect("staff not doing service", () => book(at(300), svc2.id, petr.id), /staff_not_found/);
await expect("unknown staff", () => book(at(300), svc.id, "33333333-3333-3333-3333-333333333333"), /staff_not_found/);
await expect("anon reads staff", () => db.query("select id, name from staff").then(r => r.rows.length));
await expect("anon cannot add staff", () => db.query(
  "insert into staff (business_id,name) values ($1,'x')", [biz.id]), /permission denied|row-level/);
await db.exec("reset role");
await expect("anyone: first booking goes to Jana (sort order)", async () => {
  if ((await staffOf(first)) !== jana.id) throw new Error("expected Jana");
  return "Jana";
});
await expect("anyone: same slot goes to Petr", async () => {
  if ((await staffOf(second)) !== petr.id) throw new Error("expected Petr");
  return "Petr";
});

await db.exec(`set role authenticated; set request.jwt.claim.sub = '${owner}'`);
await expect("owner deactivates Petr", () => db.query("update staff set is_active=false where id=$1", [petr.id]).then(r => r.affectedRows));
await expect("owner cannot delete staff with bookings", () => db.query("delete from staff where id=$1", [petr.id]), /foreign key/);
await db.exec("reset role");
await db.exec("set role anon");
await expect("inactive staff can't be booked", () => book(at(300), svc.id, petr.id), /staff_not_found/);
await db.exec("reset role");

await db.exec(`set role authenticated; set request.jwt.claim.sub = '${other}'`);
const { rows: [biz2] } = await db.query(
  `insert into businesses (owner_id,name,slug,notification_email) values ($1,'Jiny','jiny-biz','p@x.cz') returning id`, [other]);
const { rows: [foreignStaff] } = await db.query(
  `insert into staff (business_id,name) values ($1,'Cizí') returning id`, [biz2.id]);
await expect("other user cannot add staff to foreign business", () => db.query(
  "insert into staff (business_id,name) values ($1,'x')", [biz.id]), /row-level/);
await expect("other user cannot link own staff to foreign service", () => db.query(
  "insert into staff_services values ($1,$2)", [foreignStaff.id, svc.id]), /different businesses|row-level/);
await db.exec("reset role");

await db.exec(`set role authenticated; set request.jwt.claim.sub = '${owner}'`);
await expect("owner cannot move booking to foreign staff", () => db.query(
  "update bookings set staff_id=$1 where id=$2", [foreignStaff.id, first]), /staff_not_found/);
await expect("owner moves Petr's booking onto Jana's same slot -> overlap", () => db.query(
  "update bookings set staff_id=$1 where id=$2", [jana.id, second]), /bookings_no_overlap/);
await db.exec("reset role");

console.log(failures ? `\n${failures} FAILURES` : "\nALL PASSED");
process.exit(failures || process.exitCode ? 1 : 0);
