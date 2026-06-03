import { describe, expect, it } from "vitest";

import {
  buildDecisionsSmokeConfig,
  createUniqueDecisionsOrgSlug,
  formatCommandForError,
} from "./real-clerk-smoke";

describe("real Clerk Decisions smoke helpers", () => {
  it("creates stable slug-safe org names from a timestamp", () => {
    expect(
      createUniqueDecisionsOrgSlug({
        nowMs: Date.parse("2026-06-02T04:00:00.000Z"),
        prefix: "Decisions E2E!",
      })
    ).toBe("decisions-e2e-1780372800000");
  });

  it("resolves config from explicit smoke inputs", () => {
    const config = buildDecisionsSmokeConfig({
      env: {
        CLERK_SECRET_KEY: "sk_test_123",
        LIGHTFAST_E2E_AGENT_BROWSER_SESSION: "decisions-session",
        LIGHTFAST_E2E_APP_URL: "https://custom.app.lightfast.localhost/",
        LIGHTFAST_E2E_DECISIONS_EMAIL_PREFIX: "Decision Runner",
        LIGHTFAST_E2E_DECISIONS_ORG_SLUG: "lf-decisions-fixed",
        LIGHTFAST_E2E_DECISIONS_RUNTIME_CALL: "0",
        LIGHTFAST_E2E_LINEAR_MCP_ENDPOINT:
          "https://linear.lightfast.localhost/mcp",
      },
      nowMs: Date.parse("2026-06-02T04:00:00.000Z"),
    });

    expect(config).toMatchObject({
      appOrigin: "https://custom.app.lightfast.localhost",
      clerkSecretKey: "sk_test_123",
      emailAddress: "decision-runner-1780372800000@lightfast.ai",
      linearMcpEndpoint: "https://linear.lightfast.localhost/mcp",
      orgSlug: "lf-decisions-fixed",
      runtimeDecisionEnabled: false,
      sessionName: "decisions-session",
    });
  });

  it("uses the worktree Linear emulator endpoint for runtime Decision proof by default", () => {
    const config = buildDecisionsSmokeConfig({
      env: {
        CLERK_SECRET_KEY: "sk_test_123",
      },
      getPortlessUrl: (name) =>
        `https://integration-call-ledger.${name}.localhost`,
      nowMs: Date.parse("2026-06-02T04:00:00.000Z"),
    });

    expect(config).toMatchObject({
      linearMcpEndpoint:
        "https://integration-call-ledger.linear.lightfast.localhost/mcp",
      runtimeDecisionEnabled: true,
      sessionName: "lightfast-decisions-smoke-1780372800000",
    });
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

  it("requires a Clerk secret key so smoke runs can create dev users", () => {
    expect(() =>
      buildDecisionsSmokeConfig({
        env: {},
        getPortlessUrl: (name) => `https://${name}.localhost`,
        nowMs: Date.parse("2026-06-02T04:00:00.000Z"),
      })
    ).toThrow("CLERK_SECRET_KEY");
  });
});
