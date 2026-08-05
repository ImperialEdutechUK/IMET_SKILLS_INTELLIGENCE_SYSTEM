import { describe, it, expect } from "vitest";
import { parseCertificateProof } from "./certificate-proof";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
const PDF = "data:application/pdf;base64,JVBERi0xLjQK";

const valid = {
  fileUrl: PDF,
  certificateUrl: "https://coursera.org/verify/ABC123",
  issuer: "Coursera",
  issuedDate: "2026-01-15",
};

describe("parseCertificateProof", () => {
  it("accepts a PDF with a verification link", () => {
    const result = parseCertificateProof(valid);
    expect(result.ok).toBe(true);
  });

  it("accepts the permitted raster image formats", () => {
    for (const mime of ["image/png", "image/jpeg", "image/jpg", "image/webp"]) {
      const fileUrl = `data:${mime};base64,iVBORw0KGgo=`;
      expect(parseCertificateProof({ ...valid, fileUrl }).ok).toBe(true);
    }
  });

  it("rejects an SVG certificate", () => {
    // SVG is a scriptable document. The old pattern was `image/[a-z0-9.+-]+`,
    // which accepted image/svg+xml — a stored payload that is then handed to
    // <img>, to a blob: URL and to an <a href> a manager clicks.
    const svg =
      "data:image/svg+xml;base64," +
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString("base64");
    const result = parseCertificateProof({ ...valid, fileUrl: svg });
    expect(result.ok).toBe(false);
    expect(result).toHaveProperty("error");
  });

  it("rejects other scriptable or executable types", () => {
    for (const mime of ["text/html", "image/svg+xml", "application/xhtml+xml", "text/javascript"]) {
      expect(parseCertificateProof({ ...valid, fileUrl: `data:${mime};base64,YQ==` }).ok).toBe(false);
    }
  });

  it("rejects a non-data URL smuggled into fileUrl", () => {
    for (const fileUrl of [
      "javascript:alert(1)",
      "https://evil.example/x.png",
      "data:image/png,notbase64",
    ]) {
      expect(parseCertificateProof({ ...valid, fileUrl }).ok).toBe(false);
    }
  });

  it("rejects a data URL whose payload is not valid base64", () => {
    expect(parseCertificateProof({ ...valid, fileUrl: "data:image/png;base64,not base64!!" }).ok).toBe(false);
  });

  it("still requires both the document and the verification link", () => {
    expect(parseCertificateProof({ ...valid, fileUrl: "" }).ok).toBe(false);
    expect(parseCertificateProof({ ...valid, certificateUrl: "" }).ok).toBe(false);
  });

  it("rejects a non-http verification link", () => {
    expect(parseCertificateProof({ ...valid, certificateUrl: "javascript:alert(1)" }).ok).toBe(false);
    expect(parseCertificateProof({ ...valid, certificateUrl: "file:///etc/passwd" }).ok).toBe(false);
  });

  it("rejects an oversized file", () => {
    const huge = PNG + "A".repeat(4_000_000);
    expect(parseCertificateProof({ ...valid, fileUrl: huge }).ok).toBe(false);
  });

  it("rejects a future completion date", () => {
    const nextYear = new Date(Date.now() + 400 * 86_400_000).toISOString().slice(0, 10);
    expect(parseCertificateProof({ ...valid, issuedDate: nextYear }).ok).toBe(false);
  });

  it("caps the issuer string", () => {
    const result = parseCertificateProof({ ...valid, issuer: "x".repeat(500) });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.proof.issuer!.length).toBe(120);
  });
});
