import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { packCpd, CPD_TYPES, CPD_CATEGORIES, type CpdType, type CpdCategory } from "@/lib/cpd-activity";

// Bulk-import a CPD log from an Excel/CSV sheet. The system scans the rows and
// creates real CPD records. Flexible header matching so common column names work.
// Expected columns (any casing): Title/Activity, Type, Provider, Date, Category, Hours, Description.
export const runtime = "nodejs";

// Locate the table header row (0-indexed) by scanning the first ~15 rows for a
// row that carries recognisable CPD column names. Falls back to row 0 so plain
// single-table sheets keep working unchanged.
function findHeaderRow(sheet: XLSX.WorkSheet): number {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const cells = (aoa[i] ?? []).map((c) => String(c).trim().toLowerCase());
    const hasTitle = cells.some((c) => ["title", "course title", "activity", "activity title", "course", "name"].includes(c));
    const hasHours = cells.some((c) => c.includes("hour") || c.includes("duration"));
    if (hasTitle && hasHours) return i;
  }
  return 0;
}

function pick(row: Record<string, unknown>, keys: string[]): string {
  const lower: Record<string, unknown> = {};
  for (const k of Object.keys(row)) lower[k.trim().toLowerCase()] = row[k];
  for (const key of keys) {
    const v = lower[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

// Parse hours from "2.5", "2", "2h 30m", "2h", "90m".
function parseHours(raw: string): number {
  if (!raw) return 0;
  const n = Number(raw);
  if (Number.isFinite(n)) return n;
  let total = 0;
  const h = raw.match(/(\d+(?:\.\d+)?)\s*h/i);
  const m = raw.match(/(\d+)\s*m/i);
  if (h) total += parseFloat(h[1]);
  if (m) total += parseInt(m[1], 10) / 60;
  return Math.round(total * 100) / 100;
}

export async function POST(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  let rows: Record<string, unknown>[];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    // The official CPD Log template carries a title bar + a name/manager block
    // above the table, so the header row isn't always row 1. Find the row that
    // looks like column headers and start parsing there.
    const headerRow = findHeaderRow(sheet);
    rows = XLSX.utils.sheet_to_json(sheet, { defval: "", range: headerRow });
  } catch {
    return NextResponse.json({ error: "Could not read the spreadsheet." }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "The sheet has no data rows." }, { status: 400 });
  }

  const toCreate: { hours: number; description: string; loggedAt: Date }[] = [];
  const skipped: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const title = pick(row, ["title", "activity", "activity title", "name", "course", "course title"]);
    const hours = parseHours(pick(row, ["hours", "cpd hours", "duration", "duration (hours)", "duration (hrs)", "time"]));
    if (!title || hours <= 0) {
      skipped.push(`Row ${i + 2}: missing title or hours`);
      continue;
    }
    const typeRaw = pick(row, ["type", "activity type"]);
    const catRaw = pick(row, ["category"]);
    const type: CpdType = (CPD_TYPES as readonly string[]).includes(typeRaw) ? (typeRaw as CpdType) : "Other";
    const cat: CpdCategory = (CPD_CATEGORIES as readonly string[]).includes(catRaw) ? (catRaw as CpdCategory) : "Other";
    const dateStr = pick(row, ["date", "date completed", "completed", "completed on"]);
    const loggedAt = dateStr && !isNaN(Date.parse(dateStr)) ? new Date(dateStr) : new Date();

    toCreate.push({
      hours,
      loggedAt,
      description: packCpd({
        title,
        type,
        provider: pick(row, ["provider", "provider / platform", "platform", "organization", "organisation", "source"]) || null,
        category: cat,
        dateCompleted: dateStr || null,
        note: pick(row, ["description", "notes", "details", "reflection", "key learnings / notes", "key learnings"]) || null,
      }),
    });
  }

  if (toCreate.length === 0) {
    return NextResponse.json({ error: "No valid rows found. Each row needs a title and hours.", skipped }, { status: 400 });
  }

  await prisma.cpdRecord.createMany({
    data: toCreate.map((r) => ({ userId: authUser.id, source: "manual" as const, ...r })),
  });

  return NextResponse.json({ ok: true, imported: toCreate.length, skipped });
}
