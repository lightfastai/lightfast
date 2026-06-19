import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const oldPackage = `@repo/${"app-setup-contract"}`;
const oldPackagePath = `packages/${"app-setup-contract"}`;
const ignoredDirs = new Set([
  ".git",
  ".next",
  ".turbo",
  ".cache",
  "coverage",
  "dist",
  "node_modules",
]);

function repoSource(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function readJson<T>(path: string): T {
  return JSON.parse(repoSource(path)) as T;
}

function sourceFilesUnder(path: string): string[] {
  const root = resolve(repoRoot, path);
  if (!existsSync(root)) {
    return [];
  }

  const files: string[] = [];
  const visit = (entry: string) => {
    const stat = statSync(entry);
    if (stat.isDirectory()) {
      if (ignoredDirs.has(entry.split("/").at(-1) ?? "")) {
        return;
      }
      for (const child of readdirSync(entry)) {
        visit(resolve(entry, child));
      }
      return;
    }
    files.push(relative(repoRoot, entry));
  };

  visit(root);
  return files;
}

function productionSourceFilesUnder(path: string): string[] {
  return sourceFilesUnder(path).filter((file) => !file.includes("/__tests__/"));
}

describe("app setup contract package boundary", () => {
  it("keeps org setup schemas in api-contract and route paths in apps/app", () => {
    const apiAppPackage = readJson<{
      dependencies?: Record<string, string>;
    }>("api/app/package.json");
    const appPackage = readJson<{ dependencies?: Record<string, string> }>(
      "apps/app/package.json"
    );
    const apiContractIndex = repoSource("packages/api-contract/src/index.ts");

    expect(existsSync(resolve(repoRoot, oldPackagePath))).toBe(false);
    expect(apiAppPackage.dependencies?.[oldPackage]).toBeUndefined();
    expect(appPackage.dependencies?.[oldPackage]).toBeUndefined();
    expect(apiContractIndex).toContain('from "./org-setup"');

    const remainingImports = [
      "api/app/src",
      "apps/app/src",
      "packages/api-contract/src",
    ].flatMap((path) =>
      sourceFilesUnder(path).filter((file) =>
        repoSource(file).includes(oldPackage)
      )
    );
    expect(remainingImports).toEqual([]);
  });

  it("keeps org setup route paths out of api/app production code", () => {
    const appRoutePathFragments = [
      "/tasks/bind",
      "/tasks/bind/github/complete",
      "/tasks/connectors/x/complete",
    ];
    const leakedFiles = productionSourceFilesUnder("api/app/src").filter(
      (file) => {
        const contents = repoSource(file);
        return appRoutePathFragments.some((fragment) =>
          contents.includes(fragment)
        );
      }
    );

    expect(leakedFiles).toEqual([]);
  });
});
