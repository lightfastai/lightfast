import { createDrizzleConfig } from "@vendor/db";
import { afterEach, describe, expect, it } from "vitest";

describe("Drizzle config", () => {
  const originalEnv = {
    DATABASE_HOST: process.env.DATABASE_HOST,
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
    DATABASE_USERNAME: process.env.DATABASE_USERNAME,
  };

  afterEach(() => {
    restoreEnv("DATABASE_HOST", originalEnv.DATABASE_HOST);
    restoreEnv("DATABASE_PASSWORD", originalEnv.DATABASE_PASSWORD);
    restoreEnv("DATABASE_USERNAME", originalEnv.DATABASE_USERNAME);
  });

  it("leaves database names and table filters owned by the caller", () => {
    const config = createDrizzleConfig({
      database: "caller_database",
      host: "example.planetscale.com",
      out: "./src/migrations",
      password: "password",
      schema: "./src/schema/index.ts",
      tablesFilter: ["caller_*"],
      username: "username",
    });
    const credentials = (
      config as { dbCredentials?: Record<string, unknown> }
    ).dbCredentials;

    expect(credentials).toMatchObject({
      database: "caller_database",
      host: "example.planetscale.com",
      password: "password",
      user: "username",
    });
    expect(config.tablesFilter).toEqual(["caller_*"]);
  });

  it("keeps the app database fixed as lightfast", async () => {
    process.env.DATABASE_HOST = "example.planetscale.com";
    process.env.DATABASE_PASSWORD = "password";
    process.env.DATABASE_USERNAME = "username";

    const { default: config } = await import("../drizzle.config");
    const credentials = (
      config as { dbCredentials?: Record<string, unknown> }
    ).dbCredentials;

    expect(credentials).toMatchObject({
      database: "lightfast",
      host: "example.planetscale.com",
      password: "password",
      user: "username",
    });
    expect(config.tablesFilter).toEqual(["lightfast_*"]);
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
