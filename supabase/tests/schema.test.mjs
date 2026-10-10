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
for (const m of migrations) await db.exec(readFileSync(m, "utf8"));
console.log("migrations ok");

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

// A Prague-local 10:00 slot a few days ahead
const { rows: [{ d }] } = await db.query(
  `select ((now() at time zone 'Europe/Prague')::date + 3 + time '10:00') at time zone 'Europe/Prague' as d`);
const at = (offsetMin) => new Date(new Date(d).getTime() + offsetMin * 60000).toISOString();
const book = (start, sid = svc.id) => db.query(
  `select create_booking($1,$2,$3,'Jan Novák','Jan@Example.cz',' 777123456 ') as id`, [biz.id, sid, start]);

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
await expect("anon busy intervals", () => db.query(
  "select * from get_busy_intervals($1, now(), now() + interval '10 days')", [biz.id]).then(r => r.rows.length));
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

console.log(failures ? `\n${failures} FAILURES` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
