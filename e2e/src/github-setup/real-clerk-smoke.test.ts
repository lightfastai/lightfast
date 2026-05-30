import { describe, expect, it } from "vitest";

import { buildSmokeConfig, createUniqueOrgSlug } from "./real-clerk-smoke";

describe("real Clerk GitHub setup smoke helpers", () => {
  it("creates stable slug-safe org names from a timestamp", () => {
    expect(
      createUniqueOrgSlug({
        nowMs: Date.parse("2026-05-30T11:45:30.000Z"),
        prefix: "lf-e2e",
      })
    ).toBe("lf-e2e-1780141530");
  });

  it("resolves required config without reading secrets into logs", () => {
    const config = buildSmokeConfig({
      env: {
        LIGHTFAST_E2E_CLERK_USER_ID: "user_123",
        LIGHTFAST_E2E_ORG_SLUG: "lf-e2e-fixed",
      },
      getPortlessUrl: (name) => `https://${name}.localhost`,
      nowMs: Date.parse("2026-05-30T11:45:30.000Z"),
    });

    expect(config).toMatchObject({
      appOrigin: "https://app.lightfast.localhost",
      clerkUserId: "user_123",
      githubOrigin: "https://github.lightfast.localhost",
      orgSlug: "lf-e2e-fixed",
      sessionName: "lightfast-github-setup-smoke",
    });
  });

  it("requires a Clerk user id so smoke runs target a known dev user", () => {
    expect(() =>
      buildSmokeConfig({
        env: {},
        getPortlessUrl: (name) => `https://${name}.localhost`,
        nowMs: Date.parse("2026-05-30T11:45:30.000Z"),
      })
    ).toThrow("LIGHTFAST_E2E_CLERK_USER_ID");
  });
});
