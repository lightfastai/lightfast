import { exportPKCS8, generateKeyPair, jwtVerify } from "jose";
import { describe, expect, it } from "vitest";
import { createGitHubAppJwt } from "../app-jwt";

describe("createGitHubAppJwt", () => {
  it("creates an RS256 app JWT with GitHub-compatible timing claims", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256", {
      extractable: true,
    });
    const now = new Date("2026-05-28T00:00:00.000Z");
    const jwt = await createGitHubAppJwt({
      appId: "424242",
      now,
      privateKey: await exportPKCS8(privateKey),
    });

    const { payload, protectedHeader } = await jwtVerify(jwt, publicKey, {
      currentDate: now,
    });
    expect(protectedHeader.alg).toBe("RS256");
    expect(payload.iss).toBe("424242");
    expect(payload.iat).toBe(1_779_926_370);
    expect(payload.exp).toBe(1_779_926_940);
  });
});
