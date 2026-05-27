import { createDrizzleConfig } from "@vendor/db";
import { describe, expect, it } from "vitest";

describe("Drizzle config", () => {
  it("uses the fixed Lightfast database without a custom port", () => {
    const legacyOptions = {
      database: "other_database",
      host: "example.planetscale.com",
      out: "./src/migrations",
      password: "password",
      port: 3307,
      schema: "./src/schema/index.ts",
      username: "username",
    };

    const config = createDrizzleConfig(legacyOptions);
    const credentials = (
      config as { dbCredentials?: Record<string, unknown> }
    ).dbCredentials;

    expect(credentials).toMatchObject({
      database: "lightfast",
      host: "example.planetscale.com",
      password: "password",
      user: "username",
    });
    expect(credentials).not.toHaveProperty("port");
  });
});
