import { afterEach, describe, expect, it, vi } from "vitest";

const GITHUB_APP_ENV_KEYS = [
  "GITHUB_APP_CLIENT_ID",
  "GITHUB_APP_CLIENT_SECRET",
  "GITHUB_APP_ID",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_APP_SLUG",
  "GITHUB_APP_WEBHOOK_SECRET",
] as const;

const LINEAR_ENV_KEYS = ["LINEAR_CLIENT_ID", "LINEAR_CLIENT_SECRET"] as const;

const MUTATED_ENV_KEYS = [
  "CLERK_SECRET_KEY",
  "CONNECTOR_MCP_AUTH_SECRET",
  "ENCRYPTION_KEY",
  "INNGEST_APP_NAME",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "SKIP_ENV_VALIDATION",
  "UNKEY_API_ID",
  "UNKEY_ROOT_KEY",
  "VERCEL_ENV",
  ...GITHUB_APP_ENV_KEYS,
  ...LINEAR_ENV_KEYS,
] as const;

const ORIGINAL_ENV = Object.fromEntries(
  MUTATED_ENV_KEYS.map((key) => [key, process.env[key]])
);

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

  it.each([
    "development",
    "preview",
    "production",
  ] as const)("requires GitHub App env during %s env module evaluation", async (vercelEnv) => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    setValidBaseEnv(vercelEnv);
    unsetGitHubAppEnv();
    vi.resetModules();

    await expect(import("../env")).rejects.toThrow(
      "Invalid environment variables"
    );
    const loggedErrors = JSON.stringify(consoleErrorSpy.mock.calls);
    for (const key of GITHUB_APP_ENV_KEYS) {
      expect(loggedErrors).toContain(key);
    }
  });

  it.each([
    "development",
    "preview",
    "production",
  ] as const)("requires Linear env during %s env module evaluation", async (vercelEnv) => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    setValidBaseEnv(vercelEnv);
    unsetLinearEnv();
    vi.resetModules();

    await expect(import("../env")).rejects.toThrow(
      "Invalid environment variables"
    );
    const loggedErrors = JSON.stringify(consoleErrorSpy.mock.calls);
    for (const key of LINEAR_ENV_KEYS) {
      expect(loggedErrors).toContain(key);
    }
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

function setValidBaseEnv(vercelEnv: "development" | "preview" | "production") {
  process.env.CLERK_SECRET_KEY = "sk_test_fake-secret-key-for-tests";
  process.env.CONNECTOR_MCP_AUTH_SECRET = "x".repeat(32);
  process.env.ENCRYPTION_KEY = "0".repeat(64);
  process.env.INNGEST_APP_NAME = "lightfast-test";
  process.env.LINEAR_CLIENT_ID = "linear_client_test";
  process.env.LINEAR_CLIENT_SECRET = "linear_secret_test";
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY =
    "pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk";
  delete process.env.SKIP_ENV_VALIDATION;
  process.env.UNKEY_API_ID = "api_test";
  process.env.UNKEY_ROOT_KEY = "root_test";
  process.env.VERCEL_ENV = vercelEnv;
}

function unsetGitHubAppEnv() {
  for (const key of GITHUB_APP_ENV_KEYS) {
    delete process.env[key];
  }
}

function unsetLinearEnv() {
  for (const key of LINEAR_ENV_KEYS) {
    delete process.env[key];
  }
}
