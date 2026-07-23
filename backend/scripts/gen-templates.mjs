/**
 * Generates the downloadable Excel templates the recommendation engine accepts:
 *   Skills Matrix, CPD Log, Daily Report.
 *
 * These mirror the official IMPERIAL EDUTECH layouts (title bars, the CPD
 * metadata block, exact column headings) and ship with placeholder ("e.g. …")
 * content so the file reads as a fill-in template, not real data.
 *
 * Output → frontend/public/templates/*.xlsx (served as static downloads).
 * Re-run with:  node backend/scripts/gen-templates.mjs
 *
 * Uses exceljs (dev dependency) because it can write cell fills/fonts — the
 * community `xlsx` package used at runtime can read these files but cannot
 * write styled ones.
 */
import ExcelJS from "exceljs";
import { fileURLToPath } from "url";
import path from "path";
import { promises as fs } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../frontend/public/templates");

// ── Palette (ARGB) ────────────────────────────────────────────────────────────
const NAVY = "FF1F3864";
const CREAM = "FFFCF3DD";
const GRID = "FFD9DEE6";
const ZEBRA = "FFF4F6FA";
const PLACEHOLDER = "FF9AA5B1"; // muted gray-blue for example text
const PROF = {
  Expert: { fill: "FFC6EFCE", font: "FF006100" },
  Advanced: { fill: "FFC6EFCE", font: "FF006100" },
  Intermediate: { fill: "FFFFEB9C", font: "FF9C6500" },
  Beginner: { fill: "FFFFC7CE", font: "FF9C0006" },
  Basic: { fill: "FFFFC7CE", font: "FF9C0006" },
};

const thin = { style: "thin", color: { argb: GRID } };
const allBorders = { top: thin, left: thin, bottom: thin, right: thin };

function fill(cell, argb) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

/** Navy heading cell: bold white on navy, centered, bordered. */
function heading(cell) {
  fill(cell, NAVY);
  cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = allBorders;
}

/** Title bar cell. */
function titleBar(cell, text) {
  cell.value = text;
  fill(cell, NAVY);
  cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 15 };
  cell.alignment = { horizontal: "center", vertical: "middle" };
}

function placeholder(cell, text) {
  cell.value = text;
  cell.font = { italic: true, color: { argb: PLACEHOLDER }, size: 10 };
  cell.alignment = { vertical: "middle", wrapText: true };
  cell.border = allBorders;
}

/** Empty, bordered cell so users see where to type. */
function blankCell(cell, zebra) {
  cell.border = allBorders;
  if (zebra) fill(cell, ZEBRA);
}

function guideSheet(wb, lines) {
  const ws = wb.addWorksheet("How to fill", { properties: { tabColor: { argb: NAVY } } });
  ws.getColumn(1).width = 100;
  const t = ws.getCell("A1");
  titleBar(t, "How to fill this template");
  t.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 13 };
  ws.getRow(1).height = 24;
  lines.forEach((line, i) => {
    const c = ws.getCell(`A${i + 3}`);
    c.value = line;
    c.font = { size: 11, color: { argb: "FF35424F" } };
    c.alignment = { wrapText: true, vertical: "middle" };
    ws.getRow(i + 3).height = line.length > 70 ? 30 : 18;
  });
  return ws;
}

// ── 1. Skills Matrix ──────────────────────────────────────────────────────────
async function skillsMatrix() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Skill Matrix", { views: [{ state: "frozen", ySplit: 2 }] });

  const widths = [22, 30, 18, 18, 15, 46];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  // Title bar (A1:F1)
  ws.mergeCells("A1:F1");
  titleBar(ws.getCell("A1"), "[ Your Role ] — Skill Matrix");
  ws.getRow(1).height = 28;

  // Header row
  const headers = [
    "Skill Category", "Specific Skill / Technology", "Current Proficiency",
    "Target Proficiency", "Last Assessed", "Gap Analysis",
  ];
  headers.forEach((h, i) => {
    const c = ws.getCell(2, i + 1);
    c.value = h;
    heading(c);
  });
  ws.getRow(2).height = 24;

  // Placeholder example rows (proficiency cells colour-coded like the original)
  const examples = [
    ["e.g. Agent Frameworks", "e.g. LangChain / LangGraph", "Advanced", "Expert", "2026-06-01", "e.g. Need focus on stateful graph deployments."],
    ["e.g. LLM Integration", "e.g. Prompt Engineering", "Intermediate", "Advanced", "2026-06-01", "e.g. Working on Tree-of-Thoughts prompting."],
    ["e.g. Data & Memory", "e.g. Vector Databases", "Beginner", "Intermediate", "2026-06-01", "e.g. Needs hands-on practice with Pinecone."],
  ];
  examples.forEach((row, r) => {
    const rowIdx = r + 3;
    row.forEach((val, i) => {
      const c = ws.getCell(rowIdx, i + 1);
      placeholder(c, val);
      // Colour Current (3) / Target (4) proficiency cells.
      if (i === 2 || i === 3) {
        const p = PROF[val];
        if (p) {
          fill(c, p.fill);
          c.font = { bold: true, italic: true, color: { argb: p.font }, size: 10 };
          c.alignment = { horizontal: "center", vertical: "middle" };
        }
      }
    });
    ws.getRow(rowIdx).height = 20;
  });

  // Empty rows to fill in.
  for (let r = 6; r <= 14; r++) {
    for (let i = 1; i <= 6; i++) blankCell(ws.getCell(r, i), r % 2 === 0);
    ws.getRow(r).height = 20;
  }

  guideSheet(wb, [
    "One row per skill. Keep the title bar and header row exactly as they are.",
    "Replace the grey 'e.g. …' example rows with your own skills, then fill the empty rows.",
    "Current / Target Proficiency must be one of:  Beginner · Intermediate · Advanced · Expert  (use None if you have not started).",
    "Include weak skills too — low proficiencies are what drive your learning recommendations.",
    "Target Proficiency = the level your role needs. Leave blank if you are unsure.",
    "Last Assessed = a date such as 2026-06-01.  Gap Analysis = a short note (optional).",
  ]);

  return wb;
}

// ── 2. CPD Log ────────────────────────────────────────────────────────────────
async function cpdLog() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("CPD Log", { views: [{ state: "frozen", ySplit: 6 }] });

  const widths = [5, 15, 34, 16, 18, 13, 17, 15, 22, 34, 14];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  // Title bar A1:K1
  ws.mergeCells("A1:K1");
  titleBar(ws.getCell("A1"), "IMPERIAL EDUTECH · Individual CPD Log");
  ws.getRow(1).height = 28;

  // Metadata block (rows 2–4): label | value pairs, left & right.
  const meta = [
    ["Full Name:", "e.g. John Doe", "Job Title:", "e.g. AI / Agent Developer"],
    ["Department:", "e.g. AI Engineering", "Review Period:", "e.g. 2025–2026"],
    ["Manager:", "e.g. Jane Smith", "Date Updated:", "e.g. 2026-07-13"],
  ];
  meta.forEach((m, r) => {
    const row = r + 2;
    ws.getRow(row).height = 22;
    // Left label A:C, value D:F ; right label G:H, value I:K
    ws.mergeCells(row, 1, row, 3);
    ws.mergeCells(row, 4, row, 6);
    ws.mergeCells(row, 7, row, 8);
    ws.mergeCells(row, 9, row, 11);
    const label = (cell, text) => {
      cell.value = text;
      fill(cell, NAVY);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      cell.border = allBorders;
    };
    const value = (cell, text) => {
      cell.value = text;
      fill(cell, CREAM);
      cell.font = { italic: true, color: { argb: PLACEHOLDER }, size: 10 };
      cell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      cell.border = allBorders;
    };
    label(ws.getCell(row, 1), m[0]);
    value(ws.getCell(row, 4), m[1]);
    label(ws.getCell(row, 7), m[2]);
    value(ws.getCell(row, 9), m[3]);
  });

  // Header row (row 6)
  const headers = [
    "#", "Date Completed", "Course Title", "Platform", "Course URL (optional)",
    "Duration (hrs)", "Category", "Certificate Attached?", "Proof Reference / Filename",
    "Key Learnings / Notes", "Applicable to Role?",
  ];
  headers.forEach((h, i) => {
    const c = ws.getCell(6, i + 1);
    c.value = h;
    heading(c);
  });
  ws.getRow(6).height = 30;

  // Placeholder example rows.
  const examples = [
    ["1", "2025-08-15", "e.g. LangChain for LLM App Development", "e.g. DeepLearning.AI", "(optional)", 4.5, "Technical Skills", "Yes", "e.g. cert_langchain.pdf", "e.g. Mastered LCEL syntax and memory chains.", "Yes"],
    ["2", "2025-10-02", "e.g. Multi-Agent Systems with AutoGen", "e.g. Coursera", "(optional)", 8, "Technical Skills", "Yes", "e.g. cert_autogen.pdf", "e.g. Built agents to debug Python code.", "Yes"],
  ];
  examples.forEach((row, r) => {
    const rowIdx = r + 7;
    row.forEach((val, i) => {
      const c = ws.getCell(rowIdx, i + 1);
      placeholder(c, val);
      if (i === 0 || i === 5) c.alignment = { horizontal: "center", vertical: "middle" };
    });
    ws.getRow(rowIdx).height = 20;
  });

  // Empty numbered rows to fill in.
  for (let r = 9; r <= 16; r++) {
    for (let i = 1; i <= 11; i++) blankCell(ws.getCell(r, i), r % 2 === 1);
    const num = ws.getCell(r, 1);
    num.value = r - 6; // continues 3, 4, 5 …
    num.font = { color: { argb: PLACEHOLDER }, size: 10 };
    num.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(r).height = 20;
  }

  guideSheet(wb, [
    "Fill in your details at the top, then one row per completed course / CPD activity.",
    "Keep the title bar and the header row (row 6) exactly as they are.",
    "Course Title and Duration (hrs) are required — rows missing either are skipped on import.",
    "Duration (hrs) is a number, e.g. 4.5.",
    "Category:  Technical Skills · Professional Skills · Leadership · Other.",
    "Date Completed = a date such as 2025-08-15. Platform, URL, Certificate and Proof columns are optional.",
    "Replace every grey 'e.g. …' placeholder with your own entries before uploading.",
  ]);

  return wb;
}

// ── 3. Daily Report ───────────────────────────────────────────────────────────
async function dailyReport() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Daily Report", { views: [{ state: "frozen", ySplit: 1 }] });

  const widths = [14, 26, 46, 15, 13];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const headers = ["Date", "Project / Task", "Description of task", "Status", "Time Spent"];
  headers.forEach((h, i) => {
    const c = ws.getCell(1, i + 1);
    c.value = h;
    heading(c);
    c.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  });
  ws.getRow(1).height = 24;

  const examples = [
    ["2026-07-07", "e.g. Agile Practitioner exam", "e.g. Added exam quizzes — sample 2", "Done", "5 hrs"],
    ["2026-07-08", "e.g. Skills metric", "e.g. Worked on the recommendation architecture", "In progress", "6 hrs"],
    ["2026-07-09", "e.g. QA SLC course", "e.g. QA'd an SLC course", "Done", "2 hrs"],
  ];
  examples.forEach((row, r) => {
    const rowIdx = r + 2;
    row.forEach((val, i) => placeholder(ws.getCell(rowIdx, i + 1), val));
    ws.getRow(rowIdx).height = 20;
  });

  for (let r = 5; r <= 16; r++) {
    for (let i = 1; i <= 5; i++) blankCell(ws.getCell(r, i), r % 2 === 1);
    ws.getRow(r).height = 20;
  }

  guideSheet(wb, [
    "One row per task / activity you worked on. Keep the header row exactly as it is.",
    "Describe the work in plain language — the engine reads it to infer the skills you use.",
    "The more concrete the description, the sharper your course recommendations.",
    "Date = e.g. 2026-07-07.  Status = Done / In progress.  Time Spent = e.g. 5 hrs.",
    "Replace the grey 'e.g. …' example rows with your own entries.",
  ]);

  return wb;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const files = [
    ["skills-matrix-template.xlsx", await skillsMatrix()],
    ["cpd-log-template.xlsx", await cpdLog()],
    ["daily-report-template.xlsx", await dailyReport()],
  ];
  for (const [name, wb] of files) {
    await wb.xlsx.writeFile(path.join(OUT_DIR, name));
    console.log("wrote", path.join(OUT_DIR, name));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
