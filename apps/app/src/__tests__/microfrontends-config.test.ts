import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const appRoot = resolve(repoRoot, "apps/app");
const wwwRoot = resolve(repoRoot, "apps/www");

describe("microfrontends config", () => {
  it("keeps the app-owned mesh as the local aggregate source of truth", () => {
    const config = JSON.parse(
      readFileSync(resolve(appRoot, "microfrontends.json"), "utf8")
    ) as {
      applications: Record<
        string,
        { packageName?: string; routing?: Array<{ paths?: string[] }> }
      >;
    };

    expect(config.applications["lightfast-app"]?.packageName).toBe(
      "@lightfast/app"
    );
    expect(config.applications["lightfast-www"]?.packageName).toBe(
      "@lightfast/www"
    );
    expect(
      config.applications["lightfast-www"]?.routing?.flatMap(
        (group) => group.paths ?? []
      )
    ).toContain("/docs/:path*");
  });

  it("pins Next microfrontends config loading to the app mesh", () => {
    const appNextConfig = readFileSync(
      resolve(appRoot, "next.config.ts"),
      "utf8"
    );
    const wwwNextConfig = readFileSync(
      resolve(wwwRoot, "next.config.ts"),
      "utf8"
    );

    expect(appNextConfig).toContain('configPath: "./microfrontends.json"');
    expect(wwwNextConfig).toContain('configPath: "../app/microfrontends.json"');
  });
});
