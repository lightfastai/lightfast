import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

test.describe("Edge Cases", () => {
  test("activate step with token renders signing-in state", async ({
    page,
  }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-in?step=activate&token=test-token-123");

    // SessionActivator renders a "Signing in..." spinner initially
    await expect(page.getByText("Signing in...")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("code step without email shows no OTP island", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-in?step=code");

    // Without email, OTP island should not render (guarded by `email &&`)
    await expect(
      page.getByText("We sent a verification code")
    ).not.toBeVisible();
  });

  test("activate step without token shows no activator", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-in?step=activate");

    // Without token, SessionActivator should not render
    await expect(page.getByText("Signing in...")).not.toBeVisible();
  });
});
