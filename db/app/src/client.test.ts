import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { getDatabaseCredentials } from "./env";

const packageRoot = resolve(import.meta.dirname, "..");

describe("database foundation", () => {
  it("requires explicit PlanetScale credentials without contacting a provider", () => {
    expect(() => getDatabaseCredentials({})).toThrow(/DATABASE_HOST/);
    expect(
      getDatabaseCredentials({
        DATABASE_HOST: "local.example.test",
        DATABASE_PASSWORD: "placeholder-password",
        DATABASE_USERNAME: "placeholder-user",
      })
    ).toEqual({
      host: "local.example.test",
      password: "placeholder-password",
      username: "placeholder-user",
    });
  });

  it("keeps the provider adapter behind @vendor/db and has no migration baseline", () => {
    const clientSource = readFileSync(
      resolve(packageRoot, "src/client.ts"),
      "utf8"
    );

    expect(clientSource).toContain('from "@vendor/db"');
    expect(clientSource).not.toContain("@planetscale/");
    expect(existsSync(resolve(packageRoot, "src/migrations"))).toBe(false);
  });
});
