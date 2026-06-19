import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createSentryBuildOptions } from "../../vite.config";

const appRoot = resolve(import.meta.dirname, "../..");

const forbiddenAppRuntimeEnvNames = [
  "CLERK_SECRET_KEY",
  "CONNECTOR_MCP_AUTH_SECRET",
  "DATABASE_HOST",
  "DATABASE_USERNAME",
  "DATABASE_PASSWORD",
  "GITHUB_APP_CLIENT_SECRET",
  "INNGEST_APP_NAME",
  "INNGEST_DEV",
  "INNGEST_EVENT_KEY",
  "INNGEST_SERVE_ORIGIN",
  "INNGEST_SIGNING_KEY",
  "LINEAR_CLIENT_SECRET",
  "QSTASH_URL",
  "X_CLIENT_SECRET",
] as const;

function expectNoForbiddenAppRuntimeEnv(source: string) {
  for (const envName of forbiddenAppRuntimeEnvNames) {
    expect(source).not.toContain(envName);
  }
}

describe("MCP environment validation wiring", () => {
  it("keeps app runtime env requirements out of the MCP env schema", () => {
    const envSource = readFileSync(resolve(appRoot, "src/env.ts"), "utf8");

    expect(envSource).toContain('import "@tanstack/react-start/server-only"');
    expect(envSource).not.toContain("@db/app/env");
    expect(envSource).not.toContain("@vendor/observability/sentry-env");
    expect(envSource).toContain('from "@t3-oss/env-core"');
    expect(envSource).toContain("APP_INTERNAL_URL");
    expectNoForbiddenAppRuntimeEnv(envSource);
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
        "APP_INTERNAL_URL",
      ])
    );
  });

  it("pins the Vercel output directory to the Nitro Build Output API artifact", () => {
    const vercelConfig = JSON.parse(
      readFileSync(resolve(appRoot, "vercel.json"), "utf8")
    ) as { framework?: string; outputDirectory?: string };

    expect(vercelConfig.framework).toBe("tanstack-start");
    expect(vercelConfig.outputDirectory).toBe(".vercel/output");
  });

  it("loads only MCP-owned env files", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(appRoot, "package.json"), "utf8")
    ) as { scripts: Record<string, string> };

    const envScripts = [
      packageJson.scripts["with-env"],
      packageJson.scripts["with-env:local"],
      packageJson.scripts["with-env:vercel"],
    ];

    expect(envScripts).toEqual([
      "dotenv -e ./.vercel/.env.development.local --",
      "dotenv -e ./.vercel/.env.development.local --",
      "dotenv -e ./.vercel/.env.development.local --",
    ]);

    for (const script of envScripts) {
      expect(script).not.toContain("../app/.env");
      expect(script).not.toContain("../app/.vercel");
      expectNoForbiddenAppRuntimeEnv(script ?? "");
    }

    const relatedProjectsScript = packageJson.scripts["with-related-projects"];

    expect(relatedProjectsScript).toBe(
      "APP_INTERNAL_URL=$(portless get lightfast) MCP_RESOURCE_URL=$(portless get mcp.lightfast)/mcp MCP_AUTH_ISSUER=$(portless get lightfast)"
    );
    expectNoForbiddenAppRuntimeEnv(relatedProjectsScript ?? "");
  });

  it("uses a distinct app internal URL for app-owned MCP intake calls", () => {
    const intakeSource = [
      "src/tools/app-audit-intake.ts",
      "src/tools/app-proxy-intake.ts",
      "src/tools/app-signal-intake.ts",
    ]
      .map((path) => readFileSync(resolve(appRoot, path), "utf8"))
      .join("\n");

    expect(intakeSource).toContain("appInternalUrl");
    expect(intakeSource).not.toContain("env.MCP_AUTH_ISSUER");
  });

  it("keeps app runtime envs out of the Turbo build boundary", () => {
    const turboConfig = JSON.parse(
      readFileSync(resolve(appRoot, "turbo.json"), "utf8")
    ) as {
      tasks: {
        build: {
          env?: string[];
          passThroughEnv?: string[];
          inputs?: string[];
        };
      };
    };

    expect(turboConfig.tasks.build.env ?? []).toEqual(
      expect.not.arrayContaining([...forbiddenAppRuntimeEnvNames])
    );
    expect(turboConfig.tasks.build.passThroughEnv ?? []).toEqual(
      expect.arrayContaining(["HOST", "PORT"])
    );
    expect(turboConfig.tasks.build.passThroughEnv ?? []).toEqual(
      expect.not.arrayContaining([...forbiddenAppRuntimeEnvNames])
    );

    for (const input of turboConfig.tasks.build.inputs ?? []) {
      expect(input).not.toContain("../app/.env");
      expect(input).not.toContain("../app/.vercel");
    }
  });

  it("does not seed app runtime envs in the MCP test bootstrap", () => {
    const setupSource = readFileSync(
      resolve(appRoot, "src/__tests__/setup-env.ts"),
      "utf8"
    );

    expectNoForbiddenAppRuntimeEnv(setupSource);
  });
});
