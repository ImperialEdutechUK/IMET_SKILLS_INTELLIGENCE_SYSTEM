import { describe, it, expect } from "vitest";
import {
  checkUpload,
  checkBufferSize,
  MAX_UPLOAD_BYTES,
  ALLOWED_SPREADSHEET_EXTENSIONS,
} from "./upload-limits";

/** A File stand-in — only `name`, `size` and `type` are read. */
const file = (name: string, size = 1024, type = "application/octet-stream") =>
  ({ name, size, type }) as File;

describe("checkUpload", () => {
  it("accepts the document types the parser supports", () => {
    for (const ext of ["csv", "xlsx", "xls", "docx", "pdf", "json", "txt", "md"]) {
      expect(checkUpload(file(`report.${ext}`)).ok).toBe(true);
    }
  });

  it("rejects a file above the size ceiling", () => {
    const result = checkUpload(file("big.xlsx", MAX_UPLOAD_BYTES + 1));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/too large/i);
  });

  it("accepts a file exactly at the ceiling", () => {
    expect(checkUpload(file("edge.xlsx", MAX_UPLOAD_BYTES)).ok).toBe(true);
  });

  it("rejects executable and scriptable extensions", () => {
    for (const name of ["payload.exe", "shell.sh", "app.js", "page.html", "s.svg", "x.php"]) {
      expect(checkUpload(file(name)).ok).toBe(false);
    }
  });

  it("rejects a file with no extension at all", () => {
    expect(checkUpload(file("noextension")).ok).toBe(false);
    expect(checkUpload(file("")).ok).toBe(false);
  });

  it("judges by extension, not the client-declared MIME type", () => {
    // The browser-reported type is attacker-controlled; claiming to be a
    // spreadsheet must not get an .exe past the check.
    expect(checkUpload(file("payload.exe", 1024, "text/csv")).ok).toBe(false);
    // …and a correct extension is accepted despite a nonsense MIME type.
    expect(checkUpload(file("real.csv", 1024, "application/x-msdownload")).ok).toBe(true);
  });

  it("is not fooled by a double extension", () => {
    // Only the final extension counts, which is also how parseDocument dispatches.
    expect(checkUpload(file("invoice.pdf.exe")).ok).toBe(false);
    expect(checkUpload(file("invoice.exe.pdf")).ok).toBe(true);
  });

  it("is case-insensitive about the extension", () => {
    expect(checkUpload(file("REPORT.XLSX")).ok).toBe(true);
  });

  it("rejects an absurdly long file name", () => {
    expect(checkUpload(file(`${"a".repeat(300)}.csv`)).ok).toBe(false);
  });

  it("honours a narrower allowlist for spreadsheet-only routes", () => {
    expect(checkUpload(file("log.pdf"), ALLOWED_SPREADSHEET_EXTENSIONS).ok).toBe(false);
    expect(checkUpload(file("log.csv"), ALLOWED_SPREADSHEET_EXTENSIONS).ok).toBe(true);
  });
});

describe("checkBufferSize", () => {
  it("accepts a buffer within the limit", () => {
    expect(checkBufferSize(Buffer.alloc(100)).ok).toBe(true);
  });

  it("rejects a buffer past the limit even when file.size claimed otherwise", () => {
    // file.size is client metadata; the received bytes are the real control.
    expect(checkBufferSize(Buffer.alloc(2048), 1024).ok).toBe(false);
  });
});
