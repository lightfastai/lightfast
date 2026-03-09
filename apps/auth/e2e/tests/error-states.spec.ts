import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

test.describe("Error States", () => {
  test("error param displays error banner with try again link", async ({
    page,
  }) => {
    await page.goto("/sign-in?error=Something+went+wrong");

    await expect(page.getByText("Something went wrong")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Try again" })
    ).toBeVisible();
  });

  test("error banner try again link clears error", async ({ page }) => {
    await page.goto("/sign-in?error=Something+went+wrong");

    await page.getByRole("link", { name: "Try again" }).click();

    // Link navigates to /sign-in — may go through MF proxy (different port)
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(
      page.getByRole("heading", { name: "Log in to Lightfast" })
    ).toBeVisible();
  });

  test("waitlist error shows waitlist UI", async ({ page }) => {
    await page.goto(
      "/sign-in?error=Sign-ups+are+currently+unavailable&waitlist=true"
    );

    await expect(
      page.getByText("Sign-ups are currently unavailable")
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Join the Waitlist" })
    ).toBeVisible();
  });

  test("sign-up error param displays error banner", async ({ page }) => {
    await page.goto("/sign-up?error=Invalid+email");

    await expect(page.getByText("Invalid email")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Try again" })
    ).toBeVisible();
  });

  test("wrong OTP shows inline error", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-in");

    await page
      .getByPlaceholder("Email Address")
      .fill("test+clerk_test@lightfast.ai");
    await page.getByRole("button", { name: "Continue with Email" }).click();
    await expect(page).toHaveURL(/step=code/);

    // Enter wrong code
    const otpInput = page.getByRole("textbox");
    await otpInput.fill("000000");

    // Clerk may return various error messages — check for the AlertCircle icon
    // which accompanies any inline error in the CodeVerificationUI
    await expect(
      page.locator("[data-slot='alert-circle'], .text-destructive")
    ).toBeVisible({ timeout: 10_000 });
  });
});
