/**
 * Document parsing: raw file bytes → plain text (and rows where relevant).
 *
 * Supported: .xlsx / .xls / .csv (SheetJS), .docx (mammoth), .pdf (pdf-parse),
 * .txt / .md / .json (utf-8). The flattened text is what the AI extraction and
 * heuristics consume.
 */
import * as XLSX from "xlsx";

export type ParsedKind = "spreadsheet" | "docx" | "pdf" | "text" | "json";

export interface ParsedDocument {
  kind: ParsedKind;
  text: string;
  /** Present for spreadsheets/CSV: array of row objects keyed by header. */
  rows?: Record<string, unknown>[];
}

export class ParseError extends Error {}

function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

export async function parseDocument(
  buffer: Buffer,
  fileName: string,
  mimeType?: string
): Promise<ParsedDocument> {
  const ext = extOf(fileName);
  const mime = (mimeType ?? "").toLowerCase();

  try {
    if (ext === "xlsx" || ext === "xls" || ext === "csv" || mime.includes("spreadsheet") || mime.includes("excel")) {
      return parseSpreadsheet(buffer);
    }
    if (ext === "docx" || mime.includes("wordprocessingml")) {
      return await parseDocx(buffer);
    }
    if (ext === "pdf" || mime.includes("pdf")) {
      return await parsePdf(buffer);
    }
    if (ext === "json" || mime.includes("json")) {
      const text = buffer.toString("utf-8");
      return { kind: "json", text };
    }
    // Fallback: treat as UTF-8 text.
    return { kind: "text", text: buffer.toString("utf-8") };
  } catch (err) {
    if (err instanceof ParseError) throw err;
    throw new ParseError(`Failed to parse ${fileName}: ${(err as Error).message}`);
  }
}

function parseSpreadsheet(buffer: Buffer): ParsedDocument {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const allRows: Record<string, unknown>[] = [];
  const textChunks: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    allRows.push(...rows);
    textChunks.push(`# Sheet: ${sheetName}`);
    // A readable, line-per-row flattening the AI can reason over.
    for (const row of rows) {
      const line = Object.entries(row)
        .filter(([, v]) => v !== "" && v !== null && v !== undefined)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" | ");
      if (line) textChunks.push(line);
    }
  }

  return { kind: "spreadsheet", text: textChunks.join("\n"), rows: allRows };
}

async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  // Imported lazily so the dependency only loads when a .docx is processed.
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({ buffer });
  return { kind: "docx", text: result.value.trim() };
}

async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  // Import the library entry directly to avoid pdf-parse's debug harness that
  // runs when the module is required as the main module.
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as (
    b: Buffer
  ) => Promise<{ text: string }>;
  const data = await pdfParse(buffer);
  return { kind: "pdf", text: data.text.trim() };
}
