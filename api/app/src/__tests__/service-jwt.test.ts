import { describe, expect, it } from "vitest";

import { signServiceJWT, verifyServiceJWT } from "../service-jwt";

const jwtSecret = "test-service-jwt-secret-at-least-32-chars";

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
    const token = await signServiceJWT({
      audience: "lightfast-platform",
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
});
