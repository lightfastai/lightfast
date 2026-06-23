import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiAppRoot = resolve(import.meta.dirname, "../..");

function apiSourceFiles(dir = resolve(apiAppRoot, "src")): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absPath = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : apiSourceFiles(absPath);
    }

    return /\.(?:ts|tsx)$/.test(entry.name) ? [absPath] : [];
  });
}

describe("api app service internals", () => {
  it("does not expose backend internals as package entrypoints", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(apiAppRoot, "package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };
    const privateExports = new Set([
      "./auth/identity",
      "./domain",
      "./env",
      "./inngest",
      "./inngest/client",
      "./mcp-oauth/resource-access",
      "./native-provider-proxy",
      "./signals/service",
    ]);

    const forbiddenExports = Object.keys(packageJson.exports ?? {}).filter(
      (entrypoint) =>
        entrypoint === "./services" ||
        entrypoint.startsWith("./services/") ||
        privateExports.has(entrypoint)
    );

    expect(forbiddenExports).toEqual([]);
  });

  it("keeps private imports relative inside api/app", () => {
    const privateSpecifiers = [
      "@api/app/auth/identity",
      "@api/app/domain",
      "@api/app/env",
      "@api/app/inngest",
      "@api/app/mcp-oauth/resource-access",
      "@api/app/native-provider-proxy",
      "@api/app/services/",
      "@api/app/signals/service",
    ];
    const offenders = apiSourceFiles()
      .map((path) => ({
        path: relative(apiAppRoot, path),
        source: readFileSync(path, "utf8"),
      }))
      .flatMap(({ path, source }) =>
        privateSpecifiers
          .filter((specifier) => source.includes(specifier))
          .map((specifier) => ({ path, specifier }))
      );

    expect(offenders).toEqual([]);
  });
});
