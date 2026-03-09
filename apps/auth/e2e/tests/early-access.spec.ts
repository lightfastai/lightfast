import { expect, test } from "@playwright/test";

test.describe("Early Access: URL-Driven States", () => {
  test("renders the form on /early-access", async ({ page }) => {
    await page.goto("/early-access");

    await expect(
      page.getByRole("heading", { name: /Join the Early Access/i })
    ).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByText("Company size", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Get Early Access" })
    ).toBeVisible();
  });

  test("success state shows You're in message", async ({ page }) => {
    await page.goto("/early-access?success=true&email=test%40example.com");

    await expect(page.getByText("You're in!")).toBeVisible();
    await expect(
      page.getByText("Successfully joined early access")
    ).toBeVisible();
    await expect(page.getByText("test@example.com")).toBeVisible();
    // Form should NOT be visible in success state
    await expect(
      page.getByRole("button", { name: "Get Early Access" })
    ).not.toBeVisible();
  });

  test("general error shows red banner with form still visible", async ({
    page,
  }) => {
    await page.goto("/early-access?error=Something+went+wrong");

    await expect(page.getByText("Something went wrong")).toBeVisible();
    // Form should still be visible (user can retry)
    await expect(
      page.getByRole("button", { name: "Get Early Access" })
    ).toBeVisible();
  });

  test("rate limit error shows yellow banner with wait message", async ({
    page,
  }) => {
    await page.goto(
      "/early-access?error=Too+many+signup+attempts&isRateLimit=true"
    );

    await expect(page.getByText("Too many signup attempts")).toBeVisible();
    await expect(
      page.getByText("Please wait a moment before trying again")
    ).toBeVisible();
  });

  test("field errors display below respective fields", async ({ page }) => {
    await page.goto(
      "/early-access?emailError=Please+enter+a+valid+email&email=bad"
    );

    await expect(
      page.getByText("Please enter a valid email")
    ).toBeVisible();
  });

  test("field values are preserved in error state", async ({ page }) => {
    await page.goto(
      "/early-access?email=test%40company.com&companySize=11-50&sourcesError=Please+select+at+least+one"
    );

    // Email input should be pre-filled
    await expect(page.getByLabel("Email address")).toHaveValue(
      "test@company.com"
    );
    await expect(
      page.getByText("Please select at least one")
    ).toBeVisible();
  });

  test("terms and privacy links are present", async ({ page }) => {
    await page.goto("/early-access");

    await expect(
      page.getByRole("link", { name: "Terms and Conditions" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Privacy Policy" })
    ).toBeVisible();
  });
});
