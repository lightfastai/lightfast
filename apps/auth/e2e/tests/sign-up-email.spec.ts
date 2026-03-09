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
    await expect(page.getByText("We sent a verification code")).toBeVisible();
  });

  test("entering 424242 OTP completes sign-up", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-up");

    const email = `signup-${Date.now()}+clerk_test@lightfast.ai`;
    await page.getByPlaceholder("Email Address").fill(email);
    await page.getByRole("button", { name: "Continue with Email" }).click();
    await expect(page).toHaveURL(/step=code/);

    await page.getByRole("textbox").fill("424242");

    // Must reach "Redirecting..." or navigate to console
    await Promise.race([
      expect(page.getByText("Redirecting...")).toBeVisible({ timeout: 15_000 }),
      page.waitForURL(/\/account\//, { timeout: 15_000 }),
    ]);
  });

  test("sign-up create request includes legal_accepted", async ({ page }) => {
    await setupClerkTestingToken({ page });

    const clerkCreateRequests: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("sign_ups")) {
        clerkCreateRequests.push(req.postData() ?? "");
      }
    });

    await page.goto("/sign-up");

    const email = `signup-${Date.now()}+clerk_test@lightfast.ai`;
    await page.getByPlaceholder("Email Address").fill(email);
    // Set up response wait before clicking (init effect fires after navigation)
    const signUpResponse = page.waitForResponse(
      (res) =>
        res.url().includes("sign_ups") && res.request().method() === "POST",
      { timeout: 10_000 }
    );

    await page.getByRole("button", { name: "Continue with Email" }).click();
    await expect(page).toHaveURL(/step=code/);

    // Wait for the sign_ups POST from the init effect to complete
    await signUpResponse;

    // Verify at least one sign_ups POST included legal_accepted
    const hasLegalAccepted = clerkCreateRequests.some((body) =>
      body.includes("legal_accepted")
    );
    expect(hasLegalAccepted).toBe(true);
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

  test("clicking GitHub button initiates OAuth redirect on sign-up", async ({
    page,
  }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-up");

    const githubButton = page.getByRole("button", {
      name: "Continue with GitHub",
    });
    await expect(githubButton).toBeVisible();
    await githubButton.click();

    // Should navigate away from /sign-up
    await page.waitForURL((url) => !url.pathname.startsWith("/sign-up"), {
      timeout: 15_000,
    });
  });
});
