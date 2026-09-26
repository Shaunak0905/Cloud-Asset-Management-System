// Database-layer test suite (docs/14-testing-and-quality-assurance.md #17A,
// docs/04-rls-security-policies.md #19). Applies every migration in
// prisma/migrations to a real Postgres engine (PGlite — Postgres compiled to
// WASM, no Docker or Azure needed), then exercises RLS and the SECURITY
// DEFINER functions acting as the RLS-subject app_user role, exactly as the
// app connects. Run: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MIGRATIONS = fileURLToPath(new URL("../migrations/", import.meta.url));

let passed = 0;
const failures = [];
function check(name, cond, detail = "") {
  if (cond) passed++;
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${!cond && detail ? ` — ${detail}` : ""}`);
}
async function expectError(name, fn, token) {
  try {
    await fn();
    check(name, false, `expected error containing ${token}, got success`);
  } catch (e) {
    check(name, e.message.includes(token), `got: ${e.message}`);
  }
}

// --- Apply every migration in order. pg_cron isn't available in PGlite, so
// its CREATE EXTENSION and cron.schedule(...) (always the final statement of
// the migration that has it) are stripped; everything else runs verbatim.
function stripPgCron(sql) {
  const cronIdx = sql.indexOf("SELECT cron.schedule(");
  if (cronIdx !== -1) sql = sql.slice(0, cronIdx);
  return sql.replace('CREATE EXTENSION IF NOT EXISTS "pg_cron";', "-- pg_cron stripped for PGlite");
}

const db = new PGlite({ extensions: { pg_trgm, pgcrypto } });

const migrationDirs = readdirSync(MIGRATIONS, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
for (const dir of migrationDirs) {
  try {
    await db.exec(stripPgCron(readFileSync(`${MIGRATIONS}/${dir}/migration.sql`, "utf8")));
    check(`${dir} applies cleanly`, true);
  } catch (e) {
    check(`${dir} applies cleanly`, false, e.message);
    process.exit(1);
  }
}

// --- Seed as owner (superuser here, table owner in Azure — both bypass RLS).
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const admin = await one(`INSERT INTO users (entra_id, full_name, email, role, updated_at) VALUES ('e-admin','Ada Admin','admin@c.edu','ADMIN',now()) RETURNING id`);
const m1u = await one(`INSERT INTO users (entra_id, full_name, email, updated_at) VALUES ('e-m1','Mia Member','m1@c.edu',now()) RETURNING id`);
const m2u = await one(`INSERT INTO users (entra_id, full_name, email, updated_at) VALUES ('e-m2','Max Member','m2@c.edu',now()) RETURNING id`);
const inactive = await one(`INSERT INTO users (entra_id, full_name, email, is_active, updated_at) VALUES ('e-x','Ex User','x@c.edu',false,now()) RETURNING id`);
const bVY = await one(`INSERT INTO buildings (code, name, updated_at) VALUES ('VY','Vyas',now()) RETURNING id`);
const bVK = await one(`INSERT INTO buildings (code, name, updated_at) VALUES ('VK','Vivekananda',now()) RETURNING id`);
const rVY001 = await one(`INSERT INTO rooms (building_id, code, name, updated_at) VALUES ($1,'VY001','VY001',now()) RETURNING id`, [bVY.id]);
const rVK404 = await one(`INSERT INTO rooms (building_id, code, name, updated_at) VALUES ($1,'VK404','VK404',now()) RETURNING id`, [bVK.id]);

const mkAsset = (name) =>
  one(
    `INSERT INTO assets (public_code, name, category, registered_building_id, registered_room_id, created_by, updated_at)
     VALUES (next_public_code('asset','AST',5), $1, 'Projector', $2, $3, $4, now()) RETURNING id, public_code`,
    [name, bVY.id, rVY001.id, admin.id],
  );
const a1 = await mkAsset("Epson Projector P-104");
const a2 = await mkAsset("Epson Projector P-107");
const year = new Date().getFullYear();
check("next_public_code issues sequential per-year codes",
  a1.public_code === `AST-${year}-00001` && a2.public_code === `AST-${year}-00002`,
  `${a1.public_code}, ${a2.public_code}`);

// --- Run SQL as app_user with (or without) an RLS identity, like withRlsContext().
async function as(user, role, fn) {
  return db.transaction(async (tx) => {
    await tx.exec("SET LOCAL ROLE app_user");
    if (user) {
      await tx.exec(`SET LOCAL app.current_user_id = '${user.id}'`);
      await tx.exec(`SET LOCAL app.current_user_role = '${role}'`);
    }
    return fn(tx);
  });
}
const q1 = async (tx, sql, params) => (await tx.query(sql, params)).rows[0];

// RLS basics
check("anonymous app_user sees no assets (RLS default-deny)",
  (await as(null, null, (tx) => q1(tx, "SELECT count(*)::int AS n FROM assets"))).n === 0);
check("member sees assets",
  (await as(m1u, "MEMBER", (tx) => q1(tx, "SELECT count(*)::int AS n FROM assets"))).n === 2);
const hacked = await as(m1u, "MEMBER", async (tx) => (await tx.query("UPDATE assets SET name = 'hacked'")).affectedRows);
check("member cannot UPDATE assets directly (RLS)", hacked === 0, `affected ${hacked}`);

// Public QR read
const pub = await as(null, null, (tx) => q1(tx, "SELECT * FROM get_public_asset($1)", [a1.public_code]));
check("get_public_asset works with no identity", pub?.name === "Epson Projector P-104");
check("get_public_asset exposes only safe columns",
  JSON.stringify(Object.keys(pub).sort()) ===
    JSON.stringify(["building_code","building_name","category","department","name","public_code","room_code","room_name","status"]),
  Object.keys(pub).join(","));
check("get_public_asset returns nothing for unknown code",
  (await as(null, null, (tx) => tx.query("SELECT * FROM get_public_asset('AST-1999-99999')"))).rows.length === 0);

// First-login provisioning
const newUser = await as(null, null, (tx) => q1(tx, "SELECT * FROM app_login_user('e-new','New Person','new@c.edu')"));
check("app_login_user provisions a MEMBER with no identity", newUser?.role === "MEMBER" && newUser.is_active === true);
const again = await as(null, null, (tx) => q1(tx, "SELECT * FROM app_login_user('e-new','Renamed','new@c.edu')"));
check("app_login_user is idempotent", again.id === newUser.id);
const existingAdmin = await as(null, null, (tx) => q1(tx, "SELECT * FROM app_login_user('e-admin','x','admin@c.edu')"));
check("app_login_user never downgrades/changes an existing role", existingAdmin.role === "ADMIN");
await expectError("users has no INSERT path for app_user outside the function",
  () => as(null, null, (tx) => tx.query("INSERT INTO users (entra_id, full_name, email, updated_at) VALUES ('e-z','Z','z@c.edu',now())")),
  "row-level security");

// Request / return
const req = (user, role, code, b, r) =>
  as(user, role, (tx) => q1(tx, "SELECT request_asset($1, $2::uuid, $3::uuid, NULL, 'lab session') AS id", [code, b, r]));

const asg = await req(m1u, "MEMBER", a1.public_code, bVK.id, rVK404.id);
check("member can request an AVAILABLE asset", typeof asg?.id === "string");
const afterReq = await one("SELECT status, current_usage_room_id, registered_room_id FROM assets WHERE id = $1", [a1.id]);
check("request moves asset to IN_USE at the usage location, registered location untouched",
  afterReq.status === "IN_USE" && afterReq.current_usage_room_id === rVK404.id && afterReq.registered_room_id === rVY001.id);
const asgRow = await one("SELECT status, asset_name_snapshot, asset_public_code_snapshot FROM assignments WHERE id = $1", [asg.id]);
check("assignment is ACTIVE with snapshots", asgRow.status === "ACTIVE" && asgRow.asset_public_code_snapshot === a1.public_code);

await expectError("second request for an IN_USE asset is rejected",
  () => req(m2u, "MEMBER", a1.public_code, bVK.id, rVK404.id), "ASSET_NOT_AVAILABLE");
await expectError("room outside the selected building is rejected",
  () => req(m1u, "MEMBER", a2.public_code, bVY.id, rVK404.id), "ROOM_NOT_IN_BUILDING");
await expectError("inactive user can't request",
  () => req(inactive, "MEMBER", a2.public_code, bVK.id, rVK404.id), "USER_INACTIVE");
await expectError("unknown asset",
  () => req(m1u, "MEMBER", "AST-1999-99999", bVK.id, rVK404.id), "ASSET_NOT_FOUND");
await expectError("no identity can't request",
  () => req(null, null, a2.public_code, bVK.id, rVK404.id), "NOT_AUTHENTICATED");

check("other member can't see someone else's assignment (RLS)",
  (await as(m2u, "MEMBER", (tx) => q1(tx, "SELECT count(*)::int AS n FROM assignments"))).n === 0);
check("admin sees all assignments",
  (await as(admin, "ADMIN", (tx) => q1(tx, "SELECT count(*)::int AS n FROM assignments"))).n === 1);

const ret = (user, role, id) => as(user, role, (tx) => tx.query("SELECT return_assignment($1::uuid)", [id]));
await expectError("other member can't return someone else's assignment", () => ret(m2u, "MEMBER", asg.id), "NOT_ALLOWED");
await ret(m1u, "MEMBER", asg.id);
const afterRet = await one("SELECT status, current_usage_room_id, registered_room_id FROM assets WHERE id = $1", [a1.id]);
check("return makes asset AVAILABLE and clears usage location",
  afterRet.status === "AVAILABLE" && afterRet.current_usage_room_id === null && afterRet.registered_room_id === rVY001.id);
await expectError("returning twice is rejected", () => ret(m1u, "MEMBER", asg.id), "ASSIGNMENT_NOT_ACTIVE");

const asg2 = await req(m1u, "MEMBER", a1.public_code, bVK.id, rVK404.id);
await ret(admin, "ADMIN", asg2.id);
check("admin can force-return someone else's assignment",
  (await one("SELECT status FROM assignments WHERE id = $1", [asg2.id])).status === "RETURNED");

// Return while the asset went into maintenance mid-checkout must not put it back in circulation.
const asg3 = await req(m1u, "MEMBER", a2.public_code, bVK.id, rVK404.id);
await db.query("UPDATE assets SET status = 'IN_MAINTENANCE' WHERE id = $1", [a2.id]);
await ret(m1u, "MEMBER", asg3.id);
const a2After = await one("SELECT status, current_usage_room_id FROM assets WHERE id = $1", [a2.id]);
check("return doesn't flip an IN_MAINTENANCE asset back to AVAILABLE",
  a2After.status === "IN_MAINTENANCE" && a2After.current_usage_room_id === null, JSON.stringify(a2After));
await db.query("UPDATE assets SET status = 'AVAILABLE' WHERE id = $1", [a2.id]);

// DB-level invariants
await expectError("partial unique index: at most one ACTIVE assignment per asset",
  () => db.query(
    `INSERT INTO assignments (asset_id, asset_name_snapshot, asset_public_code_snapshot, user_id, status, updated_at)
     VALUES ($1,'x','x',$2,'ACTIVE',now()), ($1,'x','x',$3,'ACTIVE',now())`, [a1.id, m1u.id, m2u.id]),
  "uniq_active_assignment_per_asset");
await expectError("attachments must have exactly one owner",
  () => db.query(
    `INSERT INTO attachments (blob_container, blob_name, original_filename, mime_type, file_size_bytes, uploaded_by)
     VALUES ('attachments','x','x.png','image/png',1,$1)`, [admin.id]),
  "attachments_exactly_one_owner");

// Audit log: append-only, admin-read-only
await as(m1u, "MEMBER", (tx) => tx.query(
  `INSERT INTO audit_log (entity_type, entity_id, action, actor_id, actor_name_snapshot) VALUES ('asset',$1,'ASSET_ASSIGNED',$2,'Mia Member')`,
  [a1.id, m1u.id]));
check("member can write an audit entry but not read the log",
  (await as(m1u, "MEMBER", (tx) => q1(tx, "SELECT count(*)::int AS n FROM audit_log"))).n === 0);
check("admin can read the audit log",
  (await as(admin, "ADMIN", (tx) => q1(tx, "SELECT count(*)::int AS n FROM audit_log"))).n >= 1);
const auditUpd = await as(admin, "ADMIN", async (tx) => (await tx.query("UPDATE audit_log SET action = 'x'")).affectedRows);
const auditDel = await as(admin, "ADMIN", async (tx) => (await tx.query("DELETE FROM audit_log")).affectedRows);
check("even admin can't UPDATE or DELETE audit_log", auditUpd === 0 && auditDel === 0, `upd ${auditUpd}, del ${auditDel}`);

// Retention purge: history survives, asset goes
const mr = await one(
  `INSERT INTO maintenance_requests (request_number, asset_id, reported_by, status, description, updated_at)
   VALUES (next_public_code('maintenance_request','MR',4), $1, $2, 'RESOLVED', 'bulb', now()) RETURNING id, request_number`,
  [a1.id, m1u.id]);
await db.query(
  `INSERT INTO maintenance_history (maintenance_request_id, request_number_snapshot, asset_id, asset_name_snapshot, asset_public_code_snapshot, action, actor_id)
   VALUES ($1,$2,$3,'Epson Projector P-104',$4,'RESOLVED',$5)`,
  [mr.id, mr.request_number, a1.id, a1.public_code, admin.id]);
await db.query("UPDATE assets SET status = 'RETIRED', retired_at = now() - interval '8 days' WHERE id = $1", [a1.id]);
await db.query("UPDATE assets SET status = 'RETIRED', retired_at = now() - interval '2 days' WHERE id = $1", [a2.id]);

await expectError("app_user can't run the purge itself",
  () => as(m1u, "ADMIN", (tx) => tx.query("SELECT purge_retired_assets()")), "permission denied");
await db.query("SELECT purge_retired_assets()");

check("asset retired > 7 days ago is purged",
  (await db.query("SELECT 1 FROM assets WHERE id = $1", [a1.id])).rows.length === 0);
check("asset retired < 7 days ago is kept",
  (await db.query("SELECT 1 FROM assets WHERE id = $1", [a2.id])).rows.length === 1);
const orphanAsg = (await db.query("SELECT asset_id, asset_public_code_snapshot FROM assignments WHERE id = $1", [asg.id])).rows[0];
check("assignment history survives purge via snapshot", orphanAsg && orphanAsg.asset_id === null && orphanAsg.asset_public_code_snapshot === a1.public_code);
const mh = (await db.query("SELECT asset_id, asset_name_snapshot FROM maintenance_history WHERE request_number_snapshot = $1", [mr.request_number])).rows[0];
check("maintenance history survives purge via snapshot", mh && mh.asset_id === null && mh.asset_name_snapshot === "Epson Projector P-104");
check("maintenance request row cascades away",
  (await db.query("SELECT 1 FROM maintenance_requests WHERE id = $1", [mr.id])).rows.length === 0);
const purged = (await db.query("SELECT actor_id, actor_name_snapshot, entity_public_code_snapshot FROM audit_log WHERE action = 'ASSET_PURGED'")).rows;
check("purge writes one ASSET_PURGED audit row as System",
  purged.length === 1 && purged[0].actor_id === null && purged[0].actor_name_snapshot === "System" && purged[0].entity_public_code_snapshot === a1.public_code);
check("public page sees a purged code as not found",
  (await as(null, null, (tx) => tx.query("SELECT * FROM get_public_asset($1)", [a1.public_code]))).rows.length === 0);

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFailures:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
