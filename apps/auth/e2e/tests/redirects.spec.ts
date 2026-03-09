import { expect, test } from "@playwright/test";

test.describe("Middleware Redirects", () => {
  test("unauthenticated root / redirects away from auth app", async ({
    page,
  }) => {
    // In microfrontends setup, root / on port 4104 redirects via middleware.
    // The redirect resolves through the MF proxy to port 3024.
    await page.goto("/");
    const url = page.url();

    // Should not stay at the bare auth root —
    // either redirected to /sign-in or to the MF proxy
    const redirectedToSignIn = url.includes("/sign-in");
    const leftAuthApp = !url.includes(":4104/");

    expect(
      redirectedToSignIn || leftAuthApp,
      `Expected redirect to /sign-in or away from :4104, got: ${url}`
    ).toBeTruthy();
  });

  // Authenticated redirect tests require the full multi-app stack (console + auth)
  // because the middleware redirects to consoleUrl (port 4107). Skipping in
  // isolated auth-only test runs. These redirects are covered by:
  // 1. The middleware logic itself (unit-testable)
  // 2. Full-stack E2E runs with pnpm dev:app
  // biome-ignore lint/suspicious/noSkippedTests: requires full-stack dev:app to run
  test.skip("authenticated user visiting /sign-in redirects to console", async () => {
    // Requires: console dev server at port 4107
    // Test: sign in → goto /sign-in → expect redirect to console
  });
});
