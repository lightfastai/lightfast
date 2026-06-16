import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createSentryBuildOptions } from "../../vite.config";

const appRoot = resolve(import.meta.dirname, "../..");

describe("app environment validation wiring", () => {
  it("uses TanStack-safe env-core rather than env-nextjs", () => {
    const envSource = readFileSync(resolve(appRoot, "src/env.ts"), "utf8");

    expect(envSource).toContain('import "@tanstack/react-start/server-only"');
    expect(envSource).toContain('from "@t3-oss/env-core"');
    expect(envSource).not.toContain("@t3-oss/env-nextjs");
    expect(envSource).toContain('from "@vendor/clerk/env"');
    expect(envSource).toContain('from "@vendor/observability/sentry-env"');
  });

  it("extends core-compatible provider env modules", () => {
    const envSource = readFileSync(resolve(appRoot, "src/env.ts"), "utf8");

    expect(envSource).toContain('from "@db/app/env"');
    expect(envSource).toContain('from "@vendor/clerk/env"');
    expect(envSource).toContain('from "@vendor/observability/sentry-env"');
    expect(envSource).toContain('from "@vendor/upstash/env"');
    expect(envSource).toContain('from "@vendor/unkey/env"');
    expect(envSource).toContain(
      "extends: [dbEnv, clerkEnvBase, sentryEnv, upstashEnv, unkeyEnv]"
    );
  });

  it("maps the current app NEXT_PUBLIC env contract into Vite client values", () => {
    const envSource = readFileSync(resolve(appRoot, "src/env.ts"), "utf8");

    expect(envSource).toContain("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
    expect(envSource).toContain("NEXT_PUBLIC_SENTRY_DSN");
    expect(envSource).toContain("process.env.NEXT_PUBLIC_APP_URL");
    expect(envSource).toContain("process.env.NEXT_PUBLIC_WWW_URL");
    expect(envSource).toContain("process.env.NEXT_PUBLIC_VERCEL_ENV");
    expect(envSource).toContain(
      "process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
    );
    expect(envSource).toContain("VITE_LIGHTFAST_APP_URL");
    expect(envSource).toContain("VITE_LIGHTFAST_WWW_URL");
    expect(envSource).toContain("VITE_CLERK_PUBLISHABLE_KEY");
    expect(envSource).toContain("VITE_VERCEL_ENV");
  });

  it("evaluates env during Vite config loading", () => {
    const viteConfigSource = readFileSync(
      resolve(appRoot, "vite.config.ts"),
      "utf8"
    );

    expect(viteConfigSource).toContain('from "./src/env"');
    expect(viteConfigSource).toContain("env.VITE_LIGHTFAST_APP_URL");
    expect(viteConfigSource).toContain("sentryEnv.SENTRY_AUTH_TOKEN");
    expect(viteConfigSource).toContain("sentryClientDsn");
    expect(viteConfigSource).toContain("sentryServerDsn");
    expect(viteConfigSource).toContain("process.env.PORTLESS_URL");
    expect(viteConfigSource).toContain('protocol: "wss"');
    expect(viteConfigSource).toContain("env.VITE_CLERK_PUBLISHABLE_KEY");
    expect(viteConfigSource).toContain("env.VITE_VERCEL_ENV");
    expect(viteConfigSource).not.toContain(
      'env.VITE_CLERK_PUBLISHABLE_KEY ?? ""'
    );
    expect(viteConfigSource).toContain("find: /^server-only$/");
    expect(viteConfigSource).toContain("find: /^@vendor\\/clerk\\/server$/");
    expect(viteConfigSource).toContain("find: /^@vendor\\/clerk$/");
  });

  it("configures TanStack Start, Nitro, React, and Sentry plugins", () => {
    const viteConfigSource = readFileSync(
      resolve(appRoot, "vite.config.ts"),
      "utf8"
    );

    expect(viteConfigSource).toContain("tanstackStart");
    expect(viteConfigSource).toContain("nitro()");
    expect(viteConfigSource).toContain("react()");
    expect(viteConfigSource).toContain("sentryTanstackStart");
  });

  it("keeps Turbo build caching sensitive to cutover URL env", () => {
    const turboJson = JSON.parse(
      readFileSync(resolve(appRoot, "turbo.json"), "utf8")
    ) as {
      tasks: {
        build: {
          env: string[];
          inputs: string[];
          passThroughEnv: string[];
        };
      };
    };

    expect(turboJson.tasks.build.env).toEqual(
      expect.arrayContaining([
        "NEXT_PUBLIC_APP_URL",
        "NEXT_PUBLIC_WWW_URL",
        "NEXT_PUBLIC_VERCEL_ENV",
        "VITE_*",
      ])
    );
    expect(turboJson.tasks.build.inputs).toEqual(
      expect.arrayContaining([".env.overrides.local", ".vercel/.env*"])
    );
    expect(turboJson.tasks.build.passThroughEnv).toEqual(
      expect.arrayContaining([
        "CLERK_CLI_OAUTH_CLIENT_ID",
        "CLERK_DESKTOP_OAUTH_CLIENT_ID",
        "CONNECTOR_MCP_AUTH_SECRET",
        "ENCRYPTION_KEY",
        "GITHUB_APP_CLIENT_ID",
        "GITHUB_APP_CLIENT_SECRET",
        "GITHUB_APP_ID",
        "GITHUB_APP_PRIVATE_KEY",
        "GITHUB_APP_SLUG",
        "GITHUB_APP_WEBHOOK_SECRET",
        "INNGEST_APP_NAME",
        "INNGEST_EVENT_KEY",
        "INNGEST_SERVE_ORIGIN",
        "INNGEST_SIGNING_KEY",
        "LINEAR_CLIENT_ID",
        "LINEAR_CLIENT_SECRET",
      ])
    );
  });

  it("keeps production builds working without Sentry upload credentials", () => {
    expect(
      createSentryBuildOptions(
        "build",
        {
          SENTRY_AUTH_TOKEN: undefined,
          SENTRY_ORG: "lightfast",
          SENTRY_PROJECT: "app",
        },
        "https://public@sentry.test/1",
        "https://server@sentry.test/1"
      )
    ).toEqual({
      org: undefined,
      project: undefined,
      sourcemaps: { disable: "disable-upload" },
    });
  });
});
