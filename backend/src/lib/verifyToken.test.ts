import { describe, it, expect, beforeAll } from "vitest";
import jwt from "jsonwebtoken";
import { verifyToken, TOKEN_ISSUER, TOKEN_AUDIENCE, jwtSecret } from "./verifyToken";

const SECRET = "test-secret-that-is-sufficiently-long-for-hs256";

beforeAll(() => {
  process.env.AUTH_SECRET = SECRET;
});

const claims = {
  id: "u1",
  email: "cdd.manager@imperiallearning.co.uk",
  name: "CDD Manager",
  role: "manager",
  status: "active",
  departmentId: "dept-cdd",
};

function sign(payload: object, options: jwt.SignOptions = {}, secret = SECRET) {
  return jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn: "1h",
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    ...options,
  });
}

const withToken = (token: string) =>
  new Request("http://localhost/api/x", { headers: { authorization: `Bearer ${token}` } });

describe("verifyToken", () => {
  it("accepts a well-formed token this app issued", () => {
    expect(verifyToken(withToken(sign(claims)))).toEqual(claims);
  });

  it("rejects a missing or malformed Authorization header", () => {
    expect(verifyToken(new Request("http://localhost/api/x"))).toBeNull();
    expect(
      verifyToken(new Request("http://localhost/api/x", { headers: { authorization: "Basic abc" } }))
    ).toBeNull();
    expect(verifyToken(withToken(""))).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    expect(verifyToken(withToken(sign(claims, {}, "not-the-real-secret")))).toBeNull();
  });

  it("rejects the `alg: none` forgery", () => {
    // The header claims no signature is needed. jsonwebtoken honours the token's
    // own algorithm unless `algorithms` is pinned, which is exactly why it is.
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(
      JSON.stringify({ ...claims, role: "admin", iss: TOKEN_ISSUER, aud: TOKEN_AUDIENCE })
    ).toString("base64url");
    expect(verifyToken(withToken(`${header}.${body}.`))).toBeNull();
  });

  it("rejects a token signed with an algorithm other than HS256", () => {
    const token = jwt.sign(claims, SECRET, {
      algorithm: "HS512",
      expiresIn: "1h",
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });
    expect(verifyToken(withToken(token))).toBeNull();
  });

  it("rejects a token issued by someone else", () => {
    expect(verifyToken(withToken(sign(claims, { issuer: "some-other-app" })))).toBeNull();
  });

  it("rejects a token minted for a different audience", () => {
    expect(verifyToken(withToken(sign(claims, { audience: "another-api" })))).toBeNull();
  });

  it("rejects an expired token", () => {
    expect(verifyToken(withToken(sign(claims, { expiresIn: "-1s" })))).toBeNull();
  });

  it("rejects a validly-signed token carrying an unknown role", () => {
    // A signature proves origin, not that the claims are a usable session.
    expect(verifyToken(withToken(sign({ ...claims, role: "superadmin" })))).toBeNull();
    expect(verifyToken(withToken(sign({ ...claims, role: 42 })))).toBeNull();
  });

  it("rejects a token with no subject id", () => {
    const { id: _omitted, ...noId } = claims;
    expect(verifyToken(withToken(sign(noId)))).toBeNull();
  });

  it("normalises a non-string departmentId to null rather than passing it through", () => {
    const result = verifyToken(withToken(sign({ ...claims, departmentId: { $ne: null } })));
    expect(result?.departmentId).toBeNull();
  });

  it("throws loudly when AUTH_SECRET is unset instead of silently failing closed", () => {
    const saved = process.env.AUTH_SECRET;
    delete process.env.AUTH_SECRET;
    try {
      expect(() => jwtSecret()).toThrow(/AUTH_SECRET/);
    } finally {
      process.env.AUTH_SECRET = saved;
    }
  });
});
