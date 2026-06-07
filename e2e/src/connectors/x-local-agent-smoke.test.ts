import { describe, expect, it } from "vitest";

import {
  buildXConnectorSmokeConfig,
  createUniqueXConnectorOrgSlug,
  formatCommandForError,
  resolveXConnectorClerkEmail,
} from "./x-local-agent-smoke";

describe("X connector local agent smoke helpers", () => {
  it("creates slug-safe org names with the X connector prefix", () => {
    expect(
      createUniqueXConnectorOrgSlug({
        nowMs: Date.parse("2026-06-02T10:30:00.000Z"),
        prefix: "LF E2E X",
      })
    ).toBe("lf-e2e-x-1780396200000");
  });

  it("resolves a deterministic Clerk email fallback", () => {
    expect(resolveXConnectorClerkEmail({ env: {} })).toBe(
      "lightfast-e2e-x-connector@example.com"
    );

    expect(
      resolveXConnectorClerkEmail({
        env: { LIGHTFAST_E2E_CLERK_EMAIL: " agent@lightfast.test " },
      })
    ).toBe("agent@lightfast.test");
  });

  it("resolves local smoke config from Portless and optional Clerk user id", () => {
    const config = buildXConnectorSmokeConfig({
      env: {
        LIGHTFAST_E2E_AGENT_BROWSER_SESSION: "x-smoke-session",
        LIGHTFAST_E2E_CLERK_USER_ID: "user_123",
        LIGHTFAST_E2E_ORG_SLUG: "lf-e2e-x-fixed",
      },
      getPortlessUrl: (name) => `https://${name}.localhost`,
      nowMs: Date.parse("2026-06-02T10:30:00.000Z"),
    });

    expect(config).toMatchObject({
      appOrigin: "https://lightfast.localhost",
      clerkEmail: "lightfast-e2e-x-connector@example.com",
      clerkUserId: "user_123",
      orgSlug: "lf-e2e-x-fixed",
      sessionName: "x-smoke-session",
      xOrigin: "https://x.lightfast.localhost",
    });
  });

  it("creates a unique org slug when no explicit slug is provided", () => {
    const config = buildXConnectorSmokeConfig({
      env: {
        LIGHTFAST_E2E_ORG_SLUG_PREFIX: "X Smoke",
      },
      getPortlessUrl: (name) => `https://${name}.localhost`,
      nowMs: Date.parse("2026-06-02T10:30:00.000Z"),
    });

    expect(config.orgSlug).toBe("x-smoke-1780396200000");
  });

  it("redacts agent-browser eval scripts from command failure messages", () => {
    const formatted = formatCommandForError("agent-browser", [
      "--session",
      "smoke",
      "eval",
      "const ticket = 'secret-sign-in-ticket'",
    ]);

    expect(formatted).toContain("agent-browser --session smoke eval <script>");
    expect(formatted).not.toContain("secret-sign-in-ticket");
  });
});
