import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const oldConnectorPackage = `@repo/${"connector-contract"}`;
const oldConnectorPath = `packages/${"connector-contract"}`;
const oldLinearPackage = `@repo/${"linear-app-node"}`;
const oldLinearPath = `packages/${"linear-app-node"}`;

const ignoredDirs = new Set([
  ".git",
  ".next",
  ".turbo",
  ".cache",
  "coverage",
  "dist",
  "node_modules",
]);

function source(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function readJson<T>(path: string): T {
  return JSON.parse(source(path)) as T;
}

function walkWorkspaceFiles(dir = repoRoot): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (ignoredDirs.has(entry)) {
      return [];
    }

    const path = resolve(dir, entry);
    if (statSync(path).isDirectory()) {
      return walkWorkspaceFiles(path);
    }

    return [path];
  });
}

function workspaceFilesToScan() {
  return walkWorkspaceFiles().filter((path) =>
    /\.(json|ts|tsx|yaml)$/.test(path)
  );
}

describe("connector workspace boundary", () => {
  it("hosts connector primitives in connectors/core", () => {
    const workspace = source("pnpm-workspace.yaml");
    const connectorCorePackage = readJson<{
      dependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
      name?: string;
      private?: boolean;
    }>("connectors/core/package.json");

    expect(workspace).toContain("  - connectors/*");
    expect(existsSync(resolve(repoRoot, oldConnectorPath))).toBe(false);
    expect(connectorCorePackage.name).toBe("@lightfast/connector-core");
    expect(connectorCorePackage.private).toBe(true);
    expect(connectorCorePackage.dependencies?.zod).toBe("catalog:");
    expect(Object.keys(connectorCorePackage.exports ?? {})).toEqual(["."]);
  });

  it("removes the old connector-contract package name from source and manifests", () => {
    const staleReferences = workspaceFilesToScan()
      .filter((path) => !relative(repoRoot, path).startsWith(".codex/"))
      .filter((path) => {
        const contents = readFileSync(path, "utf8");
        return (
          contents.includes(oldConnectorPackage) ||
          contents.includes(oldConnectorPath)
        );
      })
      .map((path) => relative(repoRoot, path))
      .sort();

    expect(staleReferences).toEqual([]);
  });

  it("runs repo CI when connector workspace files change", () => {
    const repoCiWorkflow = source(".github/workflows/ci.yml");

    expect(repoCiWorkflow.match(/'connectors\/\*\*'/g) ?? []).toHaveLength(2);
  });

  it("hosts Linear provider runtime code behind explicit connector entrypoints", () => {
    const linearPackage = readJson<{
      dependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
      name?: string;
      private?: boolean;
    }>("connectors/linear/package.json");

    expect(existsSync(resolve(repoRoot, oldLinearPath))).toBe(false);
    expect(linearPackage.name).toBe("@lightfast/connector-linear");
    expect(linearPackage.private).toBe(true);
    expect(linearPackage.dependencies?.["@lightfast/connector-core"]).toBe(
      "workspace:*"
    );
    expect(linearPackage.dependencies?.["@vendor/mcp"]).toBe("workspace:*");
    expect(linearPackage.dependencies?.zod).toBe("catalog:");
    expect(Object.keys(linearPackage.exports ?? {}).sort()).toEqual([
      "./mcp",
      "./node",
      "./oauth",
    ]);
  });

  it("removes the old Linear app node package name from source and manifests", () => {
    const staleReferences = workspaceFilesToScan()
      .filter((path) => !relative(repoRoot, path).startsWith(".codex/"))
      .filter((path) => {
        const contents = readFileSync(path, "utf8");
        return (
          contents.includes(oldLinearPackage) ||
          contents.includes(oldLinearPath)
        );
      })
      .map((path) => relative(repoRoot, path))
      .sort();

    expect(staleReferences).toEqual([]);
  });
});
