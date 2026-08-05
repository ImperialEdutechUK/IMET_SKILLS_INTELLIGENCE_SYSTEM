import { describe, it, expect } from "vitest";
import {
  checkPassword,
  generateResetToken,
  hashResetToken,
  digestsMatch,
  MAX_PASSWORD_LENGTH,
} from "./password-policy";

describe("checkPassword", () => {
  it("accepts a password that satisfies every rule", () => {
    expect(checkPassword("Kestrel7Bridge")).toEqual({ ok: true });
  });

  it("rejects a non-string", () => {
    expect(checkPassword(undefined).ok).toBe(false);
    expect(checkPassword(12345678).ok).toBe(false);
    expect(checkPassword({ toString: () => "Password1" }).ok).toBe(false);
  });

  it("rejects anything under 8 characters", () => {
    expect(checkPassword("Abc123!").ok).toBe(false);
  });

  it("rejects input longer than bcrypt's 72-byte ceiling", () => {
    // Left unbounded this is free CPU for an attacker, and bcrypt would have
    // silently ignored everything past byte 72 anyway.
    const long = "A1" + "a".repeat(MAX_PASSWORD_LENGTH);
    expect(checkPassword(long).ok).toBe(false);
  });

  it("requires upper case, lower case and a digit", () => {
    expect(checkPassword("alllowercase1").ok).toBe(false);
    expect(checkPassword("ALLUPPERCASE1").ok).toBe(false);
    expect(checkPassword("NoDigitsHere").ok).toBe(false);
  });

  it("rejects common passwords that would otherwise pass the character rules", () => {
    // "Password1" satisfies length, case and digit — and is the single most
    // guessed password in corporate deployments.
    expect(checkPassword("Password1").ok).toBe(false);
    expect(checkPassword("Welcome123").ok).toBe(false);
    expect(checkPassword("Changeme1").ok).toBe(false);
  });

  it("rejects a password containing the user's own email local part", () => {
    const result = checkPassword("Yenushka2026", ["yenushka@imperiallearning.co.uk"]);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/name or email/i);
  });

  it("rejects a password containing the user's name, case-insensitively", () => {
    expect(checkPassword("nandika9Xy", ["a@b.com", "Nandika"]).ok).toBe(false);
  });

  it("ignores identifiers too short to be meaningful", () => {
    // A 3-character name must not blacklist every password containing it.
    expect(checkPassword("Kestrel7Bridge", [null, undefined, "ann"]).ok).toBe(true);
  });
});

describe("reset tokens", () => {
  it("returns a high-entropy token and never the digest as the secret", () => {
    const { token, digest } = generateResetToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(token).not.toBe(digest);
  });

  it("produces a different token every call", () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateResetToken().token));
    expect(seen.size).toBe(200);
  });

  it("hashes deterministically so a token can be looked up by digest", () => {
    const { token, digest } = generateResetToken();
    expect(hashResetToken(token)).toBe(digest);
  });

  it("does not match a digest computed from a different token", () => {
    const a = generateResetToken();
    const b = generateResetToken();
    expect(hashResetToken(a.token)).not.toBe(b.digest);
  });

  it("compares digests in constant time without throwing on length mismatch", () => {
    const { digest } = generateResetToken();
    expect(digestsMatch(digest, digest)).toBe(true);
    expect(digestsMatch(digest, "short")).toBe(false);
    expect(digestsMatch("", "")).toBe(true);
  });
});
