import { createDatabase } from "@vendor/db";
import { describe, expect, it, vi } from "vitest";
import { createClient } from "./client";
import { getDatabaseCredentials } from "./env";
import * as schema from "./schema";

vi.mock("@vendor/db", () => ({
  createDatabase: vi.fn(() => ({ fixture: true })),
}));

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

  it("passes explicit credentials and the empty schema to the vendor adapter", () => {
    const credentials = {
      host: "local.example.test",
      username: "placeholder-user",
      password: "placeholder-password",
    };
    expect(Object.keys(schema)).toEqual([]);
    expect(createClient(credentials)).toEqual({ fixture: true });
    expect(createDatabase).toHaveBeenCalledExactlyOnceWith(credentials, schema);
  });
});
