import { SignJWT } from "@vendor/jose";
import { describe, expect, it } from "vitest";

import { signServiceJWT, verifyServiceJWT } from "..";

const jwtSecret = "test-service-jwt-secret-at-least-32-chars";

function secretKey(): Uint8Array {
  return new TextEncoder().encode(jwtSecret);
}

async function tokenWithAudience(audience: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT({ token_use: "service_access" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("mcp")
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(now + 60)
    .sign(secretKey());
}

async function expiredToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT({ token_use: "service_access" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("mcp")
    .setAudience("lightfast-app")
    .setIssuedAt(now - 120)
    .setExpirationTime(now - 60)
    .sign(secretKey());
}

describe("service JWT", () => {
  it("signs and verifies an mcp caller for the app audience", async () => {
    const token = await signServiceJWT({
      audience: "lightfast-app",
      caller: "mcp",
      jwtSecret,
    });

    await expect(
      verifyServiceJWT({
        allowedCallers: ["mcp"],
        audience: "lightfast-app",
        jwtSecret,
        token,
      })
    ).resolves.toEqual({
      audience: "lightfast-app",
      caller: "mcp",
    });
  });

  it("rejects the wrong audience", async () => {
    const token = await tokenWithAudience("wrong-service");

    await expect(
      verifyServiceJWT({
        allowedCallers: ["mcp"],
        audience: "lightfast-app",
        jwtSecret,
        token,
      })
    ).rejects.toMatchObject({
      code: "invalid_token",
      status: 401,
    });
  });

  it("rejects callers not allowed by the receiving route", async () => {
    const token = await signServiceJWT({
      audience: "lightfast-app",
      caller: "app",
      jwtSecret,
    });

    await expect(
      verifyServiceJWT({
        allowedCallers: ["mcp"],
        audience: "lightfast-app",
        jwtSecret,
        token,
      })
    ).rejects.toMatchObject({
      code: "disallowed_caller",
      status: 403,
    });
  });

  it("rejects expired tokens", async () => {
    const token = await expiredToken();

    await expect(
      verifyServiceJWT({
        allowedCallers: ["mcp"],
        audience: "lightfast-app",
        jwtSecret,
        token,
      })
    ).rejects.toMatchObject({
      code: "invalid_token",
      status: 401,
    });
  });

  it("rejects malformed tokens", async () => {
    await expect(
      verifyServiceJWT({
        allowedCallers: ["mcp"],
        audience: "lightfast-app",
        jwtSecret,
        token: "not-a-jwt",
      })
    ).rejects.toMatchObject({
      code: "invalid_token",
      status: 401,
    });
  });
});
