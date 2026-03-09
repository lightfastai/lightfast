import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

test.describe("Sign-In: Email Code Flow", () => {
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
    await expect(
      page.getByText("We sent a verification code")
    ).toBeVisible();
    await expect(
      page.getByText("test+clerk_test@lightfast.ai")
    ).toBeVisible();
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
    const otpInput = page.getByRole("textbox");
    await otpInput.fill("424242");

    // Step 3: should show verifying/redirecting state
    await expect(
      page.getByText(/Verifying|Redirecting/)
    ).toBeVisible({ timeout: 10_000 });
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

    // Should show success toast or remain on code step without error
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
});
