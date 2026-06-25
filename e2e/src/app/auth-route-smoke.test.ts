import { describe, expect, it } from "vitest";

import {
  APP_AUTH_ROUTE_SPECS,
  buildAppAuthRouteSmokeConfig,
  buildAppAuthSmokeAutomationInput,
  buildRouteChecks,
  collectRouteBodyProblems,
  combineRouteTextForSmoke,
  createUniqueAppAuthOrgSlug,
  formatCommandForError,
  readAppAuthEncryptionKey,
} from "./auth-route-smoke";

describe("app auth route smoke helpers", () => {
  it("creates stable slug-safe org names from a timestamp", () => {
    expect(
      createUniqueAppAuthOrgSlug({
        nowMs: Date.parse("2026-06-08T00:00:00.000Z"),
        prefix: "App Auth!",
      })
    ).toBe("app-auth-1780876800000");
  });

  it("resolves config from explicit smoke inputs", () => {
    const config = buildAppAuthRouteSmokeConfig({
      env: {
        CLERK_SECRET_KEY: "sk_test_123",
        LIGHTFAST_E2E_AGENT_BROWSER_SESSION: "app-session",
        LIGHTFAST_E2E_APP_AUTH_CLERK_API_TIMEOUT_MS: "45000",
        LIGHTFAST_E2E_APP_AUTH_EMAIL_PREFIX: "App Auth",
        LIGHTFAST_E2E_APP_AUTH_ORG_SLUG: "lf-app-fixed",
        LIGHTFAST_E2E_APP_URL: "https://custom.app.lightfast.localhost/",
      },
      getPortlessUrl: (name) => `https://${name}.localhost`,
      nowMs: Date.parse("2026-06-08T00:00:00.000Z"),
    });

    expect(config).toMatchObject({
      appOrigin: "https://custom.app.lightfast.localhost",
      clerkApiTimeoutMs: 45_000,
      clerkSecretKey: "sk_test_123",
      emailAddress: "app-auth-1780876800000@lightfast.ai",
      orgSlug: "lf-app-fixed",
      sessionName: "app-session",
    });
  });

  it("uses the app Portless service by default", () => {
    const config = buildAppAuthRouteSmokeConfig({
      env: {
        CLERK_SECRET_KEY: "sk_test_123",
      },
      getPortlessUrl: (name) => `https://route-smoke.${name}.localhost`,
      nowMs: Date.parse("2026-06-08T00:00:00.000Z"),
    });

    expect(config).toMatchObject({
      appOrigin: "https://route-smoke.app.lightfast.localhost",
      clerkApiTimeoutMs: 30_000,
      emailAddress: "app-auth-smoke-1780876800000@lightfast.ai",
      orgSlug: "lf-app-auth-e2e-1780876800000",
      sessionName: "lightfast-app-auth-smoke-1780876800000",
    });
  });

  it("builds route checks for account and org-authenticated pages", () => {
    const checks = buildRouteChecks("lf-app");
    const paths = checks.map((check) => check.path);

    expect(paths).toContain("/account/settings/general");
    expect(paths).toContain("/lf-app/settings/source-control");
    expect(paths).toContain("/lf-app/signals");
    expect(paths).toContain("/lf-app/chat");
    expect(paths).toContain("/lf-app/decisions");
    expect(paths).toContain("/lf-app/people");
    expect(paths).toContain("/lf-app/automations/new");
    expect(checks).toHaveLength(APP_AUTH_ROUTE_SPECS.length);
    expect(checks.some((check) => check.path.includes("$slug"))).toBe(false);
  });

  it("builds dynamic route checks from seeded smoke fixtures", () => {
    const checks = buildRouteChecks("lf-app", {
      automationId: "aut_smoke",
    });

    expect(
      checks.find((check) => check.name === "automation detail")
    ).toMatchObject({
      expectedText: [
        "Daily smoke automation",
        "Review seeded route smoke coverage.",
        "Status",
        "Previous runs",
      ],
      path: "/lf-app/automations/aut_smoke",
    });
    expect(checks.some((check) => check.path.includes("$automation"))).toBe(
      false
    );
  });

  it("builds the seeded automation fixture used by the detail route smoke", () => {
    expect(
      buildAppAuthSmokeAutomationInput({
        orgId: "org_smoke",
        userId: "user_smoke",
      })
    ).toEqual({
      clerkOrgId: "org_smoke",
      connectorProvider: null,
      createdByUserId: "user_smoke",
      name: "Daily smoke automation",
      prompt: "Review seeded route smoke coverage.",
      schedule: { kind: "daily", config: { time: "09:00" } },
      timezone: "UTC",
    });
  });

  it("combines page text with populated form control values for route checks", () => {
    expect(
      combineRouteTextForSmoke({
        bodyText: "Status\nPrevious runs",
        formControlValues: [
          "Daily smoke automation",
          "",
          "Review seeded route smoke coverage.",
        ],
      })
    ).toBe(
      "Status\nPrevious runs\nDaily smoke automation\nReview seeded route smoke coverage."
    );
  });

  it("flags auth, setup, and generic error states in route body text", () => {
    const problems = collectRouteBodyProblems({
      bodyText:
        "Log in to Lightfast\nOrganization setup required\nApplication Error",
      expectedText: ["Signals"],
      finalPathname: "/sign-in",
      routeName: "signals",
      routePath: "/lf-app/signals",
    });

    expect(problems).toEqual([
      "signals landed on /sign-in instead of /lf-app/signals",
      "signals rendered forbidden text: Log in to Lightfast",
      "signals rendered forbidden text: Organization setup required",
      "signals rendered forbidden text: Application Error",
      "signals did not render expected text: Signals",
    ]);
  });

  it("flags no-org setup as a distinct auth-boundary failure", () => {
    const problems = collectRouteBodyProblems({
      bodyText:
        "Organization setup required\nComplete setup before using Lightfast features.",
      expectedText: ["Signals"],
      finalPathname: "/lf-app/signals",
      routeName: "signals",
      routePath: "/lf-app/signals",
    });

    expect(problems).toEqual([
      "signals rendered forbidden text: Organization setup required",
      "signals did not render expected text: Signals",
    ]);
  });

  it("flags wrong-org route access by pathname and not-found content", () => {
    const problems = collectRouteBodyProblems({
      bodyText: "Team not found",
      expectedText: ["Signals"],
      finalPathname: "/unknown-team/signals",
      routeName: "signals",
      routePath: "/lf-app/signals",
    });

    expect(problems).toEqual([
      "signals landed on /unknown-team/signals instead of /lf-app/signals",
      "signals rendered forbidden text: Team not found",
      "signals did not render expected text: Signals",
    ]);
  });

  it("flags expired-session redirects as an auth-boundary failure", () => {
    const problems = collectRouteBodyProblems({
      bodyText: "Session expired\nLog in to Lightfast",
      expectedText: ["Signals"],
      finalPathname: "/sign-in",
      routeName: "signals",
      routePath: "/lf-app/signals",
    });

    expect(problems).toEqual([
      "signals landed on /sign-in instead of /lf-app/signals",
      "signals rendered forbidden text: Log in to Lightfast",
      "signals rendered forbidden text: Session expired",
      "signals did not render expected text: Signals",
    ]);
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
      buildAppAuthRouteSmokeConfig({
        env: {},
        getPortlessUrl: (name) => `https://${name}.localhost`,
        nowMs: Date.parse("2026-06-08T00:00:00.000Z"),
      })
    ).toThrow("CLERK_SECRET_KEY");
  });

  it("reads the connector encryption key from injected env", () => {
    expect(
      readAppAuthEncryptionKey({
        ENCRYPTION_KEY: " smoke-encryption-key ",
      })
    ).toBe("smoke-encryption-key");

    expect(() => readAppAuthEncryptionKey({})).toThrow("ENCRYPTION_KEY");
  });
});
