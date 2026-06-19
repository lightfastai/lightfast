import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

const ignoredDirs = new Set([".next", ".turbo", "coverage", "node_modules"]);

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

function walkFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (ignoredDirs.has(entry)) {
      return [];
    }

    const path = resolve(dir, entry);
    if (statSync(path).isDirectory()) {
      return walkFiles(path);
    }

    return [path];
  });
}

function productionSources() {
  return walkFiles(resolve(appRoot, "src"))
    .filter((path) => /\.(ts|tsx)$/.test(path))
    .filter((path) => !relative(appRoot, path).includes("__tests__/"))
    .filter((path) => !/\.test\.[tj]sx?$/.test(path));
}

describe("hosted MCP app boundary", () => {
  it("does not import app backend packages in production MCP code", () => {
    const packageJson = JSON.parse(source("package.json")) as {
      dependencies?: Record<string, string>;
    };
    const staleSources = productionSources()
      .filter((path) => readFileSync(path, "utf8").includes("@api/app"))
      .map((path) => relative(appRoot, path))
      .sort();

    expect(packageJson.dependencies?.["@api/app"]).toBeUndefined();
    expect(staleSources).toEqual([]);
  });

  it("keeps DB env and persistence out of apps/mcp", () => {
    const packageJson = JSON.parse(source("package.json")) as {
      dependencies?: Record<string, string>;
    };
    const envSource = source("src/env.ts");

    expect(packageJson.dependencies?.["@db/app"]).toBeUndefined();
    expect(envSource).not.toContain("@db/app/env");
    expect(envSource).not.toContain("DATABASE_HOST");
    expect(envSource).not.toContain("DATABASE_USERNAME");
    expect(envSource).not.toContain("DATABASE_PASSWORD");

    const staleSources = productionSources()
      .filter((path) => readFileSync(path, "utf8").includes("@db/app"))
      .map((path) => relative(appRoot, path))
      .sort();

    expect(staleSources).toEqual([]);
  });
});
