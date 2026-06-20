import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSrcRoot = resolve(import.meta.dirname, "..");
const ignoredDirs = new Set([".next", ".turbo", "node_modules"]);
const forbiddenConnectorRuntimeImport =
  /@lightfast\/connector-[^"']+\/(?:mcp|node|oauth|operations|tools)(?=["'])/;

function walkSourceFiles(dir = appSrcRoot): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (ignoredDirs.has(entry)) {
      return [];
    }

    const path = resolve(dir, entry);
    if (statSync(path).isDirectory()) {
      return walkSourceFiles(path);
    }

    return /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}

describe("app connector import boundary", () => {
  it("keeps app UI imports on client-safe connector contracts", () => {
    const violations = walkSourceFiles()
      .filter((path) => !relative(appSrcRoot, path).startsWith("__tests__/"))
      .flatMap((path) => {
        const contents = readFileSync(path, "utf8");
        const match = contents.match(forbiddenConnectorRuntimeImport);
        return match ? [`${relative(appSrcRoot, path)} -> ${match[0]}`] : [];
      })
      .sort();

    expect(violations).toEqual([]);
  });
});
