import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

test.describe("Sign-Up: Email Code Flow", () => {
  test("renders sign-up form", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-up");

    await expect(
      page.getByRole("heading", { name: "Sign up for Lightfast" })
    ).toBeVisible();
    await expect(page.getByPlaceholder("Email Address")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue with Email" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue with GitHub" })
    ).toBeVisible();

    // Legal compliance links
    await expect(page.getByText("Terms of Service")).toBeVisible();
    await expect(page.getByText("Privacy Policy")).toBeVisible();
  });

  test("submitting email navigates to OTP step", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-up");

    // Use a unique +clerk_test email to avoid "already registered" conflicts
    const email = `signup-${Date.now()}+clerk_test@lightfast.ai`;
    await page.getByPlaceholder("Email Address").fill(email);
    await page.getByRole("button", { name: "Continue with Email" }).click();

    await expect(page).toHaveURL(/step=code/);
    await expect(
      page.getByText("We sent a verification code")
    ).toBeVisible();
  });

  test("entering 424242 OTP completes sign-up", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-up");

    const email = `signup-${Date.now()}+clerk_test@lightfast.ai`;
    await page.getByPlaceholder("Email Address").fill(email);
    await page.getByRole("button", { name: "Continue with Email" }).click();
    await expect(page).toHaveURL(/step=code/);

    const otpInput = page.getByRole("textbox");
    await otpInput.fill("424242");

    await expect(
      page.getByText(/Verifying|Redirecting/)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("sign-in link navigates to /sign-in", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-up");

    await page.getByRole("link", { name: "Log In" }).click();

    // May navigate through MF proxy — match pathname only
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("invitation ticket shows banner", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-up?__clerk_ticket=test-ticket-123");

    await expect(
      page.getByText("You've been invited to join Lightfast")
    ).toBeVisible();
  });
});
