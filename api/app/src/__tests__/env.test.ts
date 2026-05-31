import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = {
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  INNGEST_APP_NAME: process.env.INNGEST_APP_NAME,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  SKIP_ENV_VALIDATION: process.env.SKIP_ENV_VALIDATION,
  UNKEY_API_ID: process.env.UNKEY_API_ID,
  UNKEY_ROOT_KEY: process.env.UNKEY_ROOT_KEY,
};

describe("api app env", () => {
  afterEach(() => {
    for (const [name, value] of Object.entries(ORIGINAL_ENV)) {
      restoreEnv(name, value);
    }
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("requires ENCRYPTION_KEY during env module evaluation", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    process.env.CLERK_SECRET_KEY = "sk_test_fake-secret-key-for-tests";
    process.env.INNGEST_APP_NAME = "lightfast-test";
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY =
      "pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk";
    delete process.env.ENCRYPTION_KEY;
    delete process.env.SKIP_ENV_VALIDATION;
    process.env.UNKEY_API_ID = "api_test";
    process.env.UNKEY_ROOT_KEY = "root_test";
    vi.resetModules();

    await expect(import("../env")).rejects.toThrow(
      "Invalid environment variables"
    );
    expect(
      consoleErrorSpy.mock.calls.some((call) =>
        JSON.stringify(call).includes("ENCRYPTION_KEY")
      )
    ).toBe(true);
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
