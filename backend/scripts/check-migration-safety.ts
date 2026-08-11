/**
 * Scans migration SQL for statements that destroy data.
 *
 * Prisma generates a column rename as DROP COLUMN + ADD COLUMN. That is valid SQL,
 * it applies without error, and it silently empties the column — the failure is only
 * visible afterwards, in production, as missing data. Renaming a table has the same
 * shape. This scanner exists so that shape cannot reach production unnoticed.
 *
 * Findings are split two ways:
 *   BLOCK — destroys rows or columns (DROP COLUMN/TABLE, TRUNCATE, DELETE).
 *   WARN  — may fail or lose precision (type changes, SET NOT NULL, dropped
 *           constraints). Not automatically wrong, but never accidental either.
 *
 * A DROP COLUMN and an ADD COLUMN on the same table in one migration is reported
 * as a probable rename, with the ALTER TABLE ... RENAME COLUMN to use instead.
 *
 *   npx tsx scripts/check-migration-safety.ts              # scan every migration
 *   npx tsx scripts/check-migration-safety.ts 0_init 20260811_x   # scan named ones
 *
 * Exit code 0 = no BLOCK findings, 1 = at least one. Used by promote-to-prod.ts.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");

export type Finding = {
  migration: string;
  level: "BLOCK" | "WARN";
  statement: string;
  reason: string;
  fix?: string;
};

/** Remove comments and string literals so keywords inside them don't match. */
function sanitize(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/'(?:[^']|'')*'/g, "''");
}

const RULES: { re: RegExp; level: "BLOCK" | "WARN"; reason: string; fix?: string }[] = [
  { re: /\bDROP\s+TABLE\b/i, level: "BLOCK", reason: "drops a table and every row in it",
    fix: "To rename, use: ALTER TABLE \"old\" RENAME TO \"new\";" },
  { re: /\bDROP\s+COLUMN\b/i, level: "BLOCK", reason: "drops a column and all its data",
    fix: "To rename, use: ALTER TABLE \"t\" RENAME COLUMN \"old\" TO \"new\";" },
  { re: /\bTRUNCATE\b/i, level: "BLOCK", reason: "empties a table" },
  { re: /\bDELETE\s+FROM\b/i, level: "BLOCK", reason: "deletes rows" },
  { re: /\bDROP\s+(SCHEMA|DATABASE)\b/i, level: "BLOCK", reason: "drops a schema or database" },
  { re: /\bALTER\s+COLUMN\b[\s\S]*\b(TYPE|SET\s+DATA\s+TYPE)\b/i, level: "WARN",
    reason: "changes a column type — can truncate or fail to cast",
    fix: "Consider add-new-column + backfill + drop-old across two releases." },
  { re: /\bSET\s+NOT\s+NULL\b/i, level: "WARN",
    reason: "fails if any existing row holds NULL",
    fix: "Backfill the column first, then set NOT NULL." },
  { re: /\bDROP\s+CONSTRAINT\b/i, level: "WARN", reason: "removes a constraint (FK/unique/check)" },
  { re: /\bDROP\s+DEFAULT\b/i, level: "WARN", reason: "removes a column default" },
  { re: /\bDROP\s+INDEX\b/i, level: "WARN", reason: "removes an index" },
];

function statementsOf(sql: string): string[] {
  return sanitize(sql)
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Table name from a DROP/ADD COLUMN statement, for rename-pair detection. */
function tableOf(stmt: string): string | null {
  const m = stmt.match(/ALTER\s+TABLE\s+(?:ONLY\s+)?"?([\w.]+)"?/i);
  return m ? m[1] : null;
}

export function scanMigration(name: string, sql: string): Finding[] {
  const found: Finding[] = [];
  const stmts = statementsOf(sql);

  for (const stmt of stmts) {
    for (const rule of RULES) {
      if (rule.re.test(stmt)) {
        found.push({
          migration: name,
          level: rule.level,
          statement: stmt.length > 160 ? stmt.slice(0, 160) + "…" : stmt,
          reason: rule.reason,
          fix: rule.fix,
        });
      }
    }
  }

  // A drop and an add on the same table almost always means a rename.
  const dropped = new Set(
    stmts.filter((s) => /\bDROP\s+COLUMN\b/i.test(s)).map(tableOf).filter(Boolean) as string[]
  );
  for (const stmt of stmts) {
    if (!/\bADD\s+COLUMN\b/i.test(stmt)) continue;
    const t = tableOf(stmt);
    if (t && dropped.has(t)) {
      found.push({
        migration: name,
        level: "BLOCK",
        statement: stmt.length > 160 ? stmt.slice(0, 160) + "…" : stmt,
        reason: `table "${t}" has both a DROP COLUMN and an ADD COLUMN — this is how Prisma writes a RENAME, and it will silently empty the column`,
        fix: `Replace both with: ALTER TABLE "${t}" RENAME COLUMN "old" TO "new";`,
      });
    }
  }

  return found;
}

export function scanMigrations(only?: string[]): Finding[] {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => !only || only.includes(n))
    .sort();

  const findings: Finding[] = [];
  for (const dir of dirs) {
    const file = join(MIGRATIONS_DIR, dir, "migration.sql");
    if (!existsSync(file)) continue;
    findings.push(...scanMigration(dir, readFileSync(file, "utf8")));
  }
  return findings;
}

export function report(findings: Finding[], scanned: number): boolean {
  const blocks = findings.filter((f) => f.level === "BLOCK");
  const warns = findings.filter((f) => f.level === "WARN");

  for (const f of findings) {
    console.log(`  [${f.level}] ${f.migration}`);
    console.log(`     ${f.statement}`);
    console.log(`     → ${f.reason}`);
    if (f.fix) console.log(`     ✎ ${f.fix}`);
    console.log();
  }

  console.log(
    `${scanned} migration(s) scanned · ${blocks.length} blocking · ${warns.length} warning(s)`
  );
  if (blocks.length) {
    console.log(
      "\nBLOCKING findings destroy data. Hand-edit the migration SQL, or pass\n" +
        "--allow-destructive if the loss is genuinely intended."
    );
  } else if (!warns.length) {
    console.log("No destructive statements found.");
  }
  return blocks.length === 0;
}

const invokedDirectly = process.argv[1]?.includes("check-migration-safety");
if (invokedDirectly) {
  const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const findings = scanMigrations(only.length ? only : undefined);
  const dirs = existsSync(MIGRATIONS_DIR)
    ? readdirSync(MIGRATIONS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).length
    : 0;
  console.log(`── Migration safety scan ──\n`);
  const ok = report(findings, only.length || dirs);
  process.exit(ok ? 0 : 1);
}
