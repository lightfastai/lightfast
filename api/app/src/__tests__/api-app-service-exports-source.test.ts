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
  it("does not expose backend services as package entrypoints", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(apiAppRoot, "package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };

    const serviceExports = Object.keys(packageJson.exports ?? {}).filter(
      (entrypoint) =>
        entrypoint === "./services" || entrypoint.startsWith("./services/")
    );

    expect(serviceExports).toEqual([]);
  });

  it("keeps service imports relative inside api/app", () => {
    const offenders = apiSourceFiles()
      .map((path) => ({
        path: relative(apiAppRoot, path),
        source: readFileSync(path, "utf8"),
      }))
      .filter(({ source }) => source.includes("@api/app/services/"));

    expect(offenders.map(({ path }) => path)).toEqual([]);
  });
});
