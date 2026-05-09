import { describe, expect, it } from "vitest";

import { signServiceJWT, verifyServiceJWT } from "./jwt";

describe("service JWT", () => {
  it("signs and verifies a valid token", async () => {
    const token = await signServiceJWT("app");
    const { caller } = await verifyServiceJWT(token);
    expect(caller).toBe("app");
  });

  it("rejects tokens with wrong audience", async () => {
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode(process.env.SERVICE_JWT_SECRET);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("app")
      .setAudience("wrong-audience")
      .setIssuedAt()
      .setExpirationTime("60s")
      .sign(key);

    await expect(verifyServiceJWT(token)).rejects.toThrow();
  });

  it("rejects expired tokens", async () => {
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode(process.env.SERVICE_JWT_SECRET);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("app")
      .setAudience("lightfast-platform")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(key);

    await expect(verifyServiceJWT(token)).rejects.toThrow();
  });

  it("rejects unknown caller (admin)", async () => {
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode(process.env.SERVICE_JWT_SECRET);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("admin")
      .setAudience("lightfast-platform")
      .setIssuedAt()
      .setExpirationTime("60s")
      .sign(key);

    await expect(verifyServiceJWT(token)).rejects.toThrow(
      /Invalid service JWT issuer/
    );
  });

  it("rejects unknown caller (webhook)", async () => {
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode(process.env.SERVICE_JWT_SECRET);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("webhook")
      .setAudience("lightfast-platform")
      .setIssuedAt()
      .setExpirationTime("60s")
      .sign(key);

    await expect(verifyServiceJWT(token)).rejects.toThrow(
      /Invalid service JWT issuer/
    );
  });

  it.each([
    "app",
    "inngest",
    "cron",
  ] as const)("round-trips caller=%s", async (caller) => {
    const token = await signServiceJWT(caller);
    const verified = await verifyServiceJWT(token);
    expect(verified.caller).toBe(caller);
  });
});
