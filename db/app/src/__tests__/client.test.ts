import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = {
  DATABASE_HOST: process.env.DATABASE_HOST,
  DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
  DATABASE_USERNAME: process.env.DATABASE_USERNAME,
  SKIP_ENV_VALIDATION: process.env.SKIP_ENV_VALIDATION,
};

describe("database client", () => {
  afterEach(() => {
    restoreEnv("DATABASE_HOST", ORIGINAL_ENV.DATABASE_HOST);
    restoreEnv("DATABASE_PASSWORD", ORIGINAL_ENV.DATABASE_PASSWORD);
    restoreEnv("DATABASE_USERNAME", ORIGINAL_ENV.DATABASE_USERNAME);
    restoreEnv("SKIP_ENV_VALIDATION", ORIGINAL_ENV.SKIP_ENV_VALIDATION);
    vi.resetModules();
  });

  it("preserves database env values when validation is skipped", async () => {
    process.env.DATABASE_HOST = "example.planetscale.com";
    process.env.DATABASE_PASSWORD = "password";
    process.env.DATABASE_USERNAME = "username";
    process.env.SKIP_ENV_VALIDATION = "true";
    vi.resetModules();

    const { env } = await import("../env");

    expect(env.DATABASE_HOST).toBe("example.planetscale.com");
    expect(env.DATABASE_PASSWORD).toBe("password");
    expect(env.DATABASE_USERNAME).toBe("username");
  });

  it("does not create the PlanetScale client during module evaluation", async () => {
    delete process.env.DATABASE_HOST;
    delete process.env.DATABASE_PASSWORD;
    delete process.env.DATABASE_USERNAME;
    process.env.SKIP_ENV_VALIDATION = "true";
    vi.resetModules();

    await expect(import("../client")).resolves.toHaveProperty("db");
  });

  it("still requires database env when the client is used", async () => {
    delete process.env.DATABASE_HOST;
    delete process.env.DATABASE_PASSWORD;
    delete process.env.DATABASE_USERNAME;
    process.env.SKIP_ENV_VALIDATION = "true";
    vi.resetModules();

    const { createClient } = await import("../client");

    expect(() => createClient()).toThrow(
      "DATABASE_HOST is required to create the PlanetScale client."
    );
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
