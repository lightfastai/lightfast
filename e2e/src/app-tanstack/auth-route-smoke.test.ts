import { describe, expect, it } from "vitest";

import {
  APP_TANSTACK_AUTH_ROUTE_SPECS,
  buildAppTanstackAuthRouteSmokeConfig,
  buildRouteChecks,
  collectRouteBodyProblems,
  createUniqueAppTanstackAuthOrgSlug,
  formatCommandForError,
} from "./auth-route-smoke";

describe("app-tanstack auth route smoke helpers", () => {
  it("creates stable slug-safe org names from a timestamp", () => {
    expect(
      createUniqueAppTanstackAuthOrgSlug({
        nowMs: Date.parse("2026-06-08T00:00:00.000Z"),
        prefix: "App TanStack Auth!",
      })
    ).toBe("app-tanstack-auth-1780876800000");
  });

  it("resolves config from explicit smoke inputs", () => {
    const config = buildAppTanstackAuthRouteSmokeConfig({
      env: {
        CLERK_SECRET_KEY: "sk_test_123",
        LIGHTFAST_E2E_AGENT_BROWSER_SESSION: "app-tanstack-session",
        LIGHTFAST_E2E_APP_TANSTACK_AUTH_EMAIL_PREFIX: "TanStack Auth",
        LIGHTFAST_E2E_APP_TANSTACK_AUTH_ORG_SLUG: "lf-app-tanstack-fixed",
        LIGHTFAST_E2E_APP_TANSTACK_URL:
          "https://custom.app-tanstack.lightfast.localhost/",
      },
      getPortlessUrl: (name) => `https://${name}.localhost`,
      nowMs: Date.parse("2026-06-08T00:00:00.000Z"),
    });

    expect(config).toMatchObject({
      appOrigin: "https://custom.app-tanstack.lightfast.localhost",
      clerkSecretKey: "sk_test_123",
      emailAddress: "tanstack-auth-1780876800000@lightfast.ai",
      orgSlug: "lf-app-tanstack-fixed",
      sessionName: "app-tanstack-session",
    });
  });

  it("uses the app-tanstack Portless service by default", () => {
    const config = buildAppTanstackAuthRouteSmokeConfig({
      env: {
        CLERK_SECRET_KEY: "sk_test_123",
      },
      getPortlessUrl: (name) => `https://route-smoke.${name}.localhost`,
      nowMs: Date.parse("2026-06-08T00:00:00.000Z"),
    });

    expect(config).toMatchObject({
      appOrigin:
        "https://route-smoke.app-tanstack.lightfast.localhost",
      emailAddress: "app-tanstack-auth-smoke-1780876800000@lightfast.ai",
      orgSlug: "lf-app-tanstack-auth-e2e-1780876800000",
      sessionName: "lightfast-app-tanstack-auth-smoke-1780876800000",
    });
  });

  it("builds route checks for account and org-authenticated pages", () => {
    const checks = buildRouteChecks("lf-tanstack");

    expect(checks.map((check) => check.path)).toContain(
      "/account/settings/general"
    );
    expect(checks.map((check) => check.path)).toContain(
      "/lf-tanstack/settings/source-control"
    );
    expect(checks.map((check) => check.path)).toContain(
      "/lf-tanstack/signals"
    );
    expect(checks).toHaveLength(APP_TANSTACK_AUTH_ROUTE_SPECS.length);
    expect(checks.some((check) => check.path.includes("$slug"))).toBe(false);
  });

  it("flags auth, setup, and generic error states in route body text", () => {
    const problems = collectRouteBodyProblems({
      bodyText:
        "Log in to Lightfast\nOrganization setup required\nApplication Error",
      expectedText: ["Signals"],
      finalPathname: "/sign-in",
      routeName: "signals",
      routePath: "/lf-tanstack/signals",
    });

    expect(problems).toEqual([
      "signals landed on /sign-in instead of /lf-tanstack/signals",
      "signals rendered forbidden text: Log in to Lightfast",
      "signals rendered forbidden text: Organization setup required",
      "signals rendered forbidden text: Application Error",
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
      buildAppTanstackAuthRouteSmokeConfig({
        env: {},
        getPortlessUrl: (name) => `https://${name}.localhost`,
        nowMs: Date.parse("2026-06-08T00:00:00.000Z"),
      })
    ).toThrow("CLERK_SECRET_KEY");
  });
});
