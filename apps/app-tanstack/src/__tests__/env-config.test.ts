import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("app-tanstack environment validation wiring", () => {
  it("uses TanStack-safe env-core rather than env-nextjs", () => {
    const envSource = readFileSync(resolve(appRoot, "src/env.ts"), "utf8");

    expect(envSource).toContain('import "@tanstack/react-start/server-only"');
    expect(envSource).toContain('from "@t3-oss/env-core"');
    expect(envSource).not.toContain("@t3-oss/env-nextjs");
    expect(envSource).not.toContain("@vendor/clerk/env");
  });

  it("extends only non-Next shared env modules", () => {
    const envSource = readFileSync(resolve(appRoot, "src/env.ts"), "utf8");

    expect(envSource).toContain('from "@db/app/env"');
    expect(envSource).toContain('from "@vendor/upstash/env"');
    expect(envSource).toContain('from "@vendor/unkey/env"');
    expect(envSource).toContain("extends: [dbEnv, upstashEnv, unkeyEnv]");
  });

  it("accepts current NEXT_PUBLIC values and exposes Vite client values", () => {
    const envSource = readFileSync(resolve(appRoot, "src/env.ts"), "utf8");

    expect(envSource).toContain("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
    expect(envSource).toContain("NEXT_PUBLIC_SENTRY_DSN");
    expect(envSource).toContain("VITE_LIGHTFAST_APP_URL");
    expect(envSource).toContain("VITE_LIGHTFAST_WWW_URL");
    expect(envSource).toContain("VITE_LIGHTFAST_PLATFORM_URL");
  });

  it("evaluates env during Vite config loading", () => {
    const viteConfigSource = readFileSync(
      resolve(appRoot, "vite.config.ts"),
      "utf8"
    );

    expect(viteConfigSource).toContain('import { env } from "./src/env"');
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
});
