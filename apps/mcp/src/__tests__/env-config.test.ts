import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("MCP environment validation wiring", () => {
  it("validates DB env requirements in the MCP env schema", () => {
    const envSource = readFileSync(resolve(appRoot, "src/env.ts"), "utf8");

    expect(envSource).toContain('import "@tanstack/react-start/server-only"');
    expect(envSource).toContain('from "@db/app/env"');
    expect(envSource).toContain('from "@t3-oss/env-core"');
    expect(envSource).toContain("extends: [dbEnv]");
  });

  it("evaluates the MCP env schema during Vite config loading", () => {
    const viteConfigSource = readFileSync(
      resolve(appRoot, "vite.config.ts"),
      "utf8"
    );

    expect(viteConfigSource).toContain('import { env } from "./src/env"');
  });

  it("requires Sentry build env through the Vite config", () => {
    const viteConfigSource = readFileSync(
      resolve(appRoot, "vite.config.ts"),
      "utf8"
    );

    expect(viteConfigSource).toContain("sentryTanstackStart");
    expect(viteConfigSource).toContain("SENTRY_AUTH_TOKEN");
    expect(viteConfigSource).toContain("SENTRY_ORG");
    expect(viteConfigSource).toContain("SENTRY_PROJECT");
    expect(viteConfigSource).toContain("VITE_SENTRY_DSN");
    expect(viteConfigSource).toContain("NEXT_PUBLIC_SENTRY_DSN");
    expect(viteConfigSource).toContain("SENTRY_DSN");
  });

  it("loads app-specific env before the shared app fallback", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(appRoot, "package.json"), "utf8")
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts["with-env"]).toBe(
      "dotenv -e ./.vercel/.env.development.local -e ../app/.vercel/.env.development.local --"
    );
  });
});
