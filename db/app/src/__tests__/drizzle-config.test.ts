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
    const credentials = (config as { dbCredentials?: Record<string, unknown> })
      .dbCredentials;

    expect(credentials).toMatchObject({
      url: "mysql://username:password@example.planetscale.com/caller_database",
    });
    expect(credentials).not.toHaveProperty("host");
    expect(credentials).not.toHaveProperty("user");
    expect(config.tablesFilter).toEqual(["caller_*"]);
  });

  it("encodes credential and database URL components without rewriting the host", () => {
    const config = createDrizzleConfig({
      database: "caller/database ?#",
      host: "localhost:3306",
      out: "./src/migrations",
      password: "p/a?#",
      schema: "./src/schema/index.ts",
      username: "user@example.com",
    });
    const credentials = (config as { dbCredentials?: Record<string, unknown> })
      .dbCredentials;

    expect(credentials).toMatchObject({
      url: "mysql://user%40example.com:p%2Fa%3F%23@localhost:3306/caller%2Fdatabase%20%3F%23",
    });
  });

  it("rejects URL-unsafe database hosts instead of rewriting authority syntax", () => {
    expect(() =>
      createDrizzleConfig({
        database: "caller_database",
        host: "bad@host",
        out: "./src/migrations",
        password: "password",
        schema: "./src/schema/index.ts",
        username: "username",
      })
    ).toThrow("Drizzle database host contains URL-unsafe characters.");
  });

  it("keeps the app database fixed as lightfast", async () => {
    process.env.DATABASE_HOST = "example.planetscale.com";
    process.env.DATABASE_PASSWORD = "password";
    process.env.DATABASE_USERNAME = "username";

    const { default: config } = await import("../drizzle.config");
    const credentials = (config as { dbCredentials?: Record<string, unknown> })
      .dbCredentials;

    expect(credentials).toMatchObject({
      url: "mysql://username:password@example.planetscale.com/lightfast",
    });
    expect(credentials).not.toHaveProperty("host");
    expect(credentials).not.toHaveProperty("user");
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
