import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

test.describe("Sign-In: Email Code Flow", () => {
  // Ensure test account exists for sign-in tests by signing up first.
  // The input-otp library does not pass data-slot through to the DOM,
  // so we use getByRole("textbox") to find the OTP input.
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await setupClerkTestingToken({ page });
    await page.goto("http://localhost:4104/sign-up");
    await page
      .getByPlaceholder("Email Address")
      .fill("test+clerk_test@lightfast.ai");
    await page.getByRole("button", { name: "Continue with Email" }).click();
    try {
      await page.waitForURL(/step=code/, { timeout: 10_000 });
      await page.getByRole("textbox").fill("424242");
      await page.waitForURL(/\/account\//, { timeout: 15_000 });
    } catch {
      // Account may already exist — OK for sign-in tests
    }
    await page.close();
  });

  test("renders email form on /sign-in", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-in");

    await expect(
      page.getByRole("heading", { name: "Log in to Lightfast" })
    ).toBeVisible();
    await expect(page.getByPlaceholder("Email Address")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue with Email" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue with GitHub" })
    ).toBeVisible();
  });

  test("submitting valid email navigates to OTP step", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-in");

    await page
      .getByPlaceholder("Email Address")
      .fill("test+clerk_test@lightfast.ai");
    await page.getByRole("button", { name: "Continue with Email" }).click();

    // URL should transition to step=code
    await expect(page).toHaveURL(/step=code/);
    await expect(page.getByText("We sent a verification code")).toBeVisible();
    await expect(page.getByText("test+clerk_test@lightfast.ai")).toBeVisible();
  });

  test("entering 424242 OTP verifies and redirects", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-in");

    // Step 1: submit email
    await page
      .getByPlaceholder("Email Address")
      .fill("test+clerk_test@lightfast.ai");
    await page.getByRole("button", { name: "Continue with Email" }).click();
    await expect(page).toHaveURL(/step=code/);

    // Step 2: enter magic test OTP
    await page.getByRole("textbox").fill("424242");

    // Must reach "Redirecting..." or navigate to console
    await Promise.race([
      expect(page.getByText("Redirecting...")).toBeVisible({ timeout: 15_000 }),
      page.waitForURL(/\/account\//, { timeout: 15_000 }),
    ]);
  });

  test("resend code button works", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-in");

    await page
      .getByPlaceholder("Email Address")
      .fill("test+clerk_test@lightfast.ai");
    await page.getByRole("button", { name: "Continue with Email" }).click();
    await expect(page).toHaveURL(/step=code/);

    // Click resend
    await page.getByRole("button", { name: "Resend" }).click();

    // Assert success toast appears
    await expect(
      page.getByText("Verification code sent to your email")
    ).toBeVisible();

    // Should still be on code step (no navigation)
    await expect(page).toHaveURL(/step=code/);
  });

  test("back button from OTP returns to email step", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-in");

    await page
      .getByPlaceholder("Email Address")
      .fill("test+clerk_test@lightfast.ai");
    await page.getByRole("button", { name: "Continue with Email" }).click();
    await expect(page).toHaveURL(/step=code/);

    await page.getByRole("button", { name: "Back" }).click();

    // Back button uses window.location.href — may go through MF proxy
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByPlaceholder("Email Address")).toBeVisible();
  });

  test("clicking GitHub button initiates OAuth redirect", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-in");

    const githubButton = page.getByRole("button", {
      name: "Continue with GitHub",
    });
    await expect(githubButton).toBeVisible();
    await githubButton.click();

    // Clerk's SSO redirect should navigate away from /sign-in
    await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), {
      timeout: 15_000,
    });
  });
});
