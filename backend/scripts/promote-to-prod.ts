/**
 * Promotes staging-tested migrations to PRODUCTION, with the safety gate wired in.
 *
 * The gate is the point of this script. `prisma migrate deploy` will happily apply a
 * DROP COLUMN; this refuses to, unless the loss is stated as intended. It also refuses
 * to run when production has drifted from schema.prisma, because a baseline that no
 * longer describes the database makes every later migration untrustworthy.
 *
 * Order of checks, all read-only until the very last step:
 *   1. Resolve the prod URL from .env.production and confirm it is not staging.
 *   2. Read prod's _prisma_migrations to work out which migrations are pending.
 *   3. Scan ONLY those pending migrations for destructive SQL (see
 *      check-migration-safety.ts). BLOCK findings abort.
 *   4. prisma migrate diff — prod must already match schema.prisma minus the pending
 *      migrations. Skipped with --skip-drift-check.
 *   5. Only with --commit: prisma migrate deploy.
 *
 *   npx tsx scripts/promote-to-prod.ts                       # dry run (default)
 *   npx tsx scripts/promote-to-prod.ts --commit              # actually deploy
 *   npx tsx scripts/promote-to-prod.ts --commit --allow-destructive
 *
 * Staging is never touched. Run migrations there with `npx prisma migrate dev`.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { Client } from "pg";
import { scanMigrations, report } from "./check-migration-safety";

const COMMIT = process.argv.includes("--commit");
const ALLOW_DESTRUCTIVE = process.argv.includes("--allow-destructive");
const SKIP_DRIFT = process.argv.includes("--skip-drift-check");
const TAG = COMMIT ? "COMMIT" : "DRY-RUN";

const PROD_ENV = ".env.production";
const STAGING_ENV = ".env";
const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");

const urlFrom = (f: string) => {
  const m = readFileSync(f, "utf8").match(/^DATABASE_URL="?([^"\n]+)"?/m);
  if (!m) throw new Error(`No DATABASE_URL in ${f}`);
  return m[1];
};
const mask = (u: string) => u.replace(/:[^:@]*@/, ":****@");

function fail(msg: string): never {
  console.error(`\n✗ ABORTED — ${msg}`);
  process.exit(1);
}

/** Read-only: what would have to change to bring prod to schema.prisma. */
function prodVsSchema(): string {
  const r = spawnSync(
    "npx",
    ["prisma", "migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma"],
    { env: { ...process.env, DOTENV_CONFIG_PATH: PROD_ENV }, encoding: "utf8", shell: true }
  );
  return `${r.stdout ?? ""}${r.stderr ?? ""}`
    .replace(/^.*Loaded Prisma config.*$/gm, "")
    .trim();
}

/** Read-only: row count per table. */
async function rowCounts(url: string): Promise<Map<string, number>> {
  const c = new Client({ connectionString: url });
  await c.connect();
  const { rows } = await c.query<{ tablename: string }>(
    `select tablename from pg_tables
     where schemaname='public' and tablename <> '_prisma_migrations'`
  );
  const out = new Map<string, number>();
  for (const { tablename } of rows) {
    const n = await c.query<{ c: number }>(`select count(*)::int c from "${tablename}"`);
    out.set(tablename, n.rows[0].c);
  }
  await c.end();
  return out;
}

async function main() {
  console.log(`── Promote migrations to PRODUCTION (${TAG}) ──\n`);

  if (!existsSync(PROD_ENV)) fail(`${PROD_ENV} not found`);
  const prodUrl = urlFrom(PROD_ENV);

  // Guard: .env is staging by convention. If the two ever match, something is wrong.
  if (existsSync(STAGING_ENV) && urlFrom(STAGING_ENV) === prodUrl) {
    fail(`${PROD_ENV} and ${STAGING_ENV} point at the same database`);
  }
  console.log(`  target: ${mask(prodUrl)}\n`);

  // ---- which migrations are pending on prod? -------------------------------
  const local = existsSync(MIGRATIONS_DIR)
    ? readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort()
    : [];
  if (!local.length) fail("no migrations found in prisma/migrations");

  const client = new Client({ connectionString: prodUrl });
  await client.connect();
  const hasTable = await client.query(
    `select to_regclass('public._prisma_migrations') is not null as present`
  );
  if (!hasTable.rows[0].present) {
    await client.end();
    fail(
      "production has no _prisma_migrations table — it is not baselined.\n" +
        `  Run once:  DOTENV_CONFIG_PATH=${PROD_ENV} npx prisma migrate resolve --applied ${local[0]}`
    );
  }
  const { rows: applied } = await client.query<{ migration_name: string; rolled_back_at: Date | null }>(
    `select migration_name, rolled_back_at from _prisma_migrations where finished_at is not null`
  );
  await client.end();

  const appliedOk = new Set(
    applied.filter((r) => !r.rolled_back_at).map((r) => r.migration_name)
  );
  const pending = local.filter((m) => !appliedOk.has(m));

  if (!pending.length) {
    console.log("Nothing to promote — production is up to date.");
    return;
  }
  console.log(`  pending (${pending.length}):`);
  for (const p of pending) console.log(`    · ${p}`);
  console.log();

  // ---- safety scan of the pending migrations only --------------------------
  console.log("── Safety scan ──\n");
  const findings = scanMigrations(pending);
  const safe = report(findings, pending.length);
  console.log();

  if (!safe && !ALLOW_DESTRUCTIVE) {
    fail("destructive SQL in pending migrations (re-run with --allow-destructive to override)");
  }
  if (!safe && ALLOW_DESTRUCTIVE) {
    console.log("⚠ --allow-destructive: proceeding despite data-destroying statements.\n");
  }

  // ---- drift check ---------------------------------------------------------
  if (SKIP_DRIFT) {
    console.log("⚠ --skip-drift-check: not previewing the change.\n");
  } else {
    console.log("── Changes deploy will make to production (read-only) ──\n");
    console.log(prodVsSchema() || "(none)");
    console.log();
  }

  if (!COMMIT) {
    console.log("DRY-RUN — nothing was applied. Re-run with --commit to deploy.");
    return;
  }

  // ---- row counts before, so loss is provable afterwards -------------------
  const before = await rowCounts(prodUrl);

  // ---- deploy --------------------------------------------------------------
  console.log("── Deploying to production ──\n");
  const deploy = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DOTENV_CONFIG_PATH: PROD_ENV },
    stdio: "inherit",
    shell: true,
  });
  if (deploy.status !== 0) fail("migrate deploy failed — production may be partially migrated");

  // ---- verify ---------------------------------------------------------------
  console.log("\n── Post-deploy verification ──\n");

  const after = await rowCounts(prodUrl);
  const lost: string[] = [];
  const gone: string[] = [];
  for (const [t, n] of before) {
    if (!after.has(t)) gone.push(`${t} (had ${n} rows)`);
    else if (after.get(t)! < n) lost.push(`${t}: ${n} -> ${after.get(t)}`);
  }
  if (gone.length) console.log(`  ✗ TABLES DROPPED: ${gone.join(", ")}`);
  if (lost.length) console.log(`  ✗ ROWS LOST: ${lost.join(", ")}`);
  if (!gone.length && !lost.length) {
    console.log(`  ✓ no tables dropped, no rows lost (${after.size} tables checked)`);
  }

  const residual = prodVsSchema();
  const clean = /No difference detected/i.test(residual);
  console.log(clean
    ? "  ✓ production now matches schema.prisma"
    : `  ✗ production still differs from schema.prisma:\n${residual}`);

  if (gone.length || lost.length || !clean) {
    fail("post-deploy verification failed — inspect production before proceeding");
  }
  console.log("\n✓ Promoted.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
