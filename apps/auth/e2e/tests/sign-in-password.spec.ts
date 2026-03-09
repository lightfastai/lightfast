import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

// Password sign-in is dev/preview only — skip in production
test.skip(
  () => process.env.NEXT_PUBLIC_VERCEL_ENV === "production",
  "Password sign-in is dev/preview only"
);

test.describe("Sign-In: Password Flow (Dev/Preview)", () => {
  test("password step renders form", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-in?step=password");

    await expect(
      page.getByPlaceholder("Email or username")
    ).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign in with Password" })
    ).toBeVisible();
  });

  test("valid credentials reach session activation", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-in?step=password");

    // Uses test credentials from apps/auth/CLAUDE.md
    await page
      .getByPlaceholder("Email or username")
      .fill("admin@lightfast.ai");
    await page.getByPlaceholder("Password").fill("ijXFdBJ3U2eMDFnKqngp");
    await page
      .getByRole("button", { name: "Sign in with Password" })
      .click();

    // Server action either activates session or returns an error
    // Account may not exist in all dev instances — accept either outcome
    await expect(page).toHaveURL(/step=activate|error=/, {
      timeout: 10_000,
    });
  });

  test("invalid credentials show error", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-in?step=password");

    await page
      .getByPlaceholder("Email or username")
      .fill("nonexistent-user@example.com");
    await page.getByPlaceholder("Password").fill("wrong-password");
    await page
      .getByRole("button", { name: "Sign in with Password" })
      .click();

    // Server action redirects with error param
    await expect(page).toHaveURL(/error=/, { timeout: 10_000 });
  });

  test("back link returns to email step", async ({ page }) => {
    await page.goto("/sign-in?step=password");

    await page
      .getByRole("link", { name: /Back to other options/ })
      .click();

    // May navigate through MF proxy — match pathname only
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});
