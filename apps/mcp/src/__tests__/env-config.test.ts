import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createSentryBuildOptions } from "../../vite.config";

const appRoot = resolve(import.meta.dirname, "../..");

describe("MCP environment validation wiring", () => {
  it("keeps DB env requirements out of the MCP env schema", () => {
    const envSource = readFileSync(resolve(appRoot, "src/env.ts"), "utf8");

    expect(envSource).toContain('import "@tanstack/react-start/server-only"');
    expect(envSource).not.toContain("@db/app/env");
    expect(envSource).not.toContain("DATABASE_HOST");
    expect(envSource).not.toContain("DATABASE_USERNAME");
    expect(envSource).not.toContain("DATABASE_PASSWORD");
    expect(envSource).not.toContain("@vendor/observability/sentry-env");
    expect(envSource).toContain('from "@t3-oss/env-core"');
  });

  it("evaluates the MCP env schema during Vite config loading", () => {
    const viteConfigSource = readFileSync(
      resolve(appRoot, "vite.config.ts"),
      "utf8"
    );

    expect(viteConfigSource).toContain('import { env } from "./src/env"');
  });

  it("configures Sentry through the Vite config without requiring upload env", () => {
    const viteConfigSource = readFileSync(
      resolve(appRoot, "vite.config.ts"),
      "utf8"
    );

    expect(viteConfigSource).toContain("sentryTanstackStart");
    expect(viteConfigSource).toContain("SENTRY_AUTH_TOKEN");
    expect(viteConfigSource).toContain("SENTRY_ORG");
    expect(viteConfigSource).toContain("SENTRY_PROJECT");
    expect(viteConfigSource).toContain("VITE_SENTRY_DSN");
    expect(viteConfigSource).not.toContain("NEXT_PUBLIC_");
    expect(viteConfigSource).toContain("SENTRY_DSN");
  });

  it("keeps production builds working without Sentry DSNs", () => {
    expect(
      createSentryBuildOptions(
        "build",
        {
          SENTRY_AUTH_TOKEN: undefined,
          SENTRY_ORG: undefined,
          SENTRY_PROJECT: undefined,
        },
        "",
        ""
      )
    ).toEqual({
      org: undefined,
      project: undefined,
      sourcemaps: { disable: "disable-upload" },
    });
  });

  it("passes Sentry env fallbacks through the Turbo build task", () => {
    const turboConfig = JSON.parse(
      readFileSync(resolve(appRoot, "turbo.json"), "utf8")
    ) as { tasks: { build: { env: string[] } } };

    expect(turboConfig.tasks.build.env).toEqual(
      expect.arrayContaining([
        "VITE_SENTRY_DSN",
        "SENTRY_AUTH_TOKEN",
        "SENTRY_DSN",
        "SENTRY_ORG",
        "SENTRY_PROJECT",
        "VITE_*",
      ])
    );
  });

  it("loads shared app env before app-specific MCP env", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(appRoot, "package.json"), "utf8")
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts["with-env"]).toBe(
      "dotenv -e ../app/.env.overrides.local -e ../app/.vercel/.env.development.local -e ./.vercel/.env.development.local --"
    );
  });
});
