import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const oldConnectorPackage = `@repo/${"connector-contract"}`;
const oldConnectorPath = `packages/${"connector-contract"}`;
const oldLinearPackage = `@repo/${"linear-app-node"}`;
const oldLinearPath = `packages/${"linear-app-node"}`;
const oldXPackage = `@repo/${"x-app-node"}`;
const oldXPath = `packages/${"x-app-node"}`;
const oldGitHubContractPackage = `@repo/${"github-app-contract"}`;
const oldGitHubContractPath = `packages/${"github-app-contract"}`;
const oldGitHubNodePackage = `@repo/${"github-app-node"}`;
const oldGitHubNodePath = `packages/${"github-app-node"}`;
const oldGranolaPackage = `@repo/${"granola-app-node"}`;
const oldGranolaPath = `packages/${"granola-app-node"}`;
const oldProviderRoutineContractPackage = `@repo/${"provider-routine-contract"}`;
const oldProviderRoutineContractPath = `packages/${"provider-routine-contract"}`;
const oldConnectorCoreProviderRoutinesSubpath = `@lightfast/connector-core/${"provider-routines"}`;
const oldUserConnectorContractPackage = `@repo/${"user-connector-contract"}`;
const oldUserConnectorContractPath = `packages/${"user-connector-contract"}`;
const oldDeveloperConnectionContractPackage = `@repo/${"developer-connection-contract"}`;
const oldDeveloperConnectionContractPath = `packages/${"developer-connection-contract"}`;

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
    expect(connectorCorePackage.dependencies?.["@repo/api-contract"]).toBe(
      "workspace:*"
    );
    expect(connectorCorePackage.dependencies?.zod).toBe("catalog:");
    expect(Object.keys(connectorCorePackage.exports ?? {}).sort()).toEqual([
      ".",
    ]);
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

  it("keeps provider routine contracts out of connector-core", () => {
    const connectorCorePackage = readJson<{
      dependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
      name?: string;
      private?: boolean;
    }>("connectors/core/package.json");
    const apiContractPackage = readJson<{
      dependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
    }>("packages/api-contract/package.json");
    const providerRoutinesPackage = readJson<{
      dependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
    }>("packages/provider-routines/package.json");

    expect(existsSync(resolve(repoRoot, oldProviderRoutineContractPath))).toBe(
      false
    );
    expect(connectorCorePackage.name).toBe("@lightfast/connector-core");
    expect(connectorCorePackage.private).toBe(true);
    expect(connectorCorePackage.exports).not.toHaveProperty(
      "./provider-routines"
    );
    expect(
      existsSync(resolve(repoRoot, "connectors/core/src/provider-routines.ts"))
    ).toBe(false);
    expect(
      apiContractPackage.dependencies?.["@lightfast/connector-core"]
    ).toBeUndefined();
    expect(connectorCorePackage.dependencies?.["@repo/api-contract"]).toBe(
      "workspace:*"
    );
    expect(
      providerRoutinesPackage.dependencies?.[oldProviderRoutineContractPackage]
    ).toBeUndefined();
    expect(providerRoutinesPackage.exports).not.toHaveProperty("./contract");

    const connectorCoreSource = source("connectors/core/src/index.ts");
    expect(connectorCoreSource).not.toContain("CONNECTOR_CATALOG");
    expect(connectorCoreSource).not.toContain("USER_CONNECTOR_CATALOG");
    expect(connectorCoreSource).not.toContain(
      "connectorStartConnectInputSchema"
    );
    expect(connectorCoreSource).not.toContain(
      "connectorSetAutomationEnabledInputSchema"
    );
    expect(connectorCoreSource).not.toContain(
      "connectorSetAgentEnabledInputSchema"
    );
    expect(connectorCoreSource).not.toContain(
      "userConnectorStartConnectInputSchema"
    );

    const staleReferences = workspaceFilesToScan()
      .filter((path) => !relative(repoRoot, path).startsWith(".codex/"))
      .filter((path) => {
        const contents = readFileSync(path, "utf8");
        return (
          contents.includes(oldProviderRoutineContractPackage) ||
          contents.includes(oldProviderRoutineContractPath) ||
          contents.includes(oldConnectorCoreProviderRoutinesSubpath)
        );
      })
      .map((path) => relative(repoRoot, path))
      .sort();

    expect(staleReferences).toEqual([]);
  });

  it("keeps user connector chat tool contracts in api-contract", () => {
    const aiPackage = readJson<{
      dependencies?: Record<string, string>;
    }>("ai/package.json");
    const apiAppPackage = readJson<{
      dependencies?: Record<string, string>;
    }>("api/app/package.json");
    const apiContractPackage = readJson<{
      exports?: Record<string, unknown>;
    }>("packages/api-contract/package.json");
    const apiContractIndexSource = source("packages/api-contract/src/index.ts");

    expect(existsSync(resolve(repoRoot, oldUserConnectorContractPath))).toBe(
      false
    );
    expect(
      aiPackage.dependencies?.[oldUserConnectorContractPackage]
    ).toBeUndefined();
    expect(
      apiAppPackage.dependencies?.[oldUserConnectorContractPackage]
    ).toBeUndefined();
    expect(apiContractPackage.exports).not.toHaveProperty("./user-connectors");
    expect(apiContractIndexSource).toContain("userConnectorCallInputSchema");
    expect(apiContractIndexSource).toContain("userConnectorFindInputSchema");

    const staleReferences = workspaceFilesToScan()
      .filter((path) => !relative(repoRoot, path).startsWith(".codex/"))
      .filter((path) => {
        const contents = readFileSync(path, "utf8");
        return (
          contents.includes(oldUserConnectorContractPackage) ||
          contents.includes(oldUserConnectorContractPath)
        );
      })
      .map((path) => relative(repoRoot, path))
      .sort();

    expect(staleReferences).toEqual([]);
  });

  it("keeps developer connection schemas in api-contract and catalog in api app", () => {
    const apiAppPackage = readJson<{
      dependencies?: Record<string, string>;
    }>("api/app/package.json");
    const dbAppPackage = readJson<{
      dependencies?: Record<string, string>;
    }>("db/app/package.json");
    const apiContractPackage = readJson<{
      exports?: Record<string, unknown>;
    }>("packages/api-contract/package.json");
    const apiContractSource = source(
      "packages/api-contract/src/developer-connections.ts"
    );
    const apiContractIndexSource = source("packages/api-contract/src/index.ts");
    const catalogSource = source(
      "api/app/src/services/developer-connections/catalog.ts"
    );

    expect(
      existsSync(resolve(repoRoot, oldDeveloperConnectionContractPath))
    ).toBe(false);
    expect(
      apiAppPackage.dependencies?.[oldDeveloperConnectionContractPackage]
    ).toBeUndefined();
    expect(
      dbAppPackage.dependencies?.[oldDeveloperConnectionContractPackage]
    ).toBeUndefined();
    expect(apiContractPackage.exports).not.toHaveProperty(
      "./developer-connections"
    );
    expect(apiContractIndexSource).toContain(
      "developerConnectionConnectInputSchema"
    );
    expect(apiContractIndexSource).toContain(
      "developerConnectionIssueLeaseInputSchema"
    );
    expect(apiContractSource).not.toContain("DEVELOPER_CONNECTION_CATALOG");
    expect(catalogSource).toContain("DEVELOPER_CONNECTION_CATALOG");

    const staleReferences = workspaceFilesToScan()
      .filter((path) => !relative(repoRoot, path).startsWith(".codex/"))
      .filter((path) => {
        const contents = readFileSync(path, "utf8");
        return (
          contents.includes(oldDeveloperConnectionContractPackage) ||
          contents.includes(oldDeveloperConnectionContractPath)
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

  it("hosts X provider runtime code behind explicit connector entrypoints", () => {
    const xPackage = readJson<{
      dependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
      name?: string;
      private?: boolean;
    }>("connectors/x/package.json");

    expect(existsSync(resolve(repoRoot, oldXPath))).toBe(false);
    expect(xPackage.name).toBe("@lightfast/connector-x");
    expect(xPackage.private).toBe(true);
    expect(xPackage.dependencies?.["@lightfast/connector-core"]).toBe(
      "workspace:*"
    );
    expect(xPackage.dependencies?.["@vendor/mcp"]).toBe("workspace:*");
    expect(xPackage.dependencies?.zod).toBe("catalog:");
    expect(Object.keys(xPackage.exports ?? {}).sort()).toEqual([
      "./mcp",
      "./node",
      "./oauth",
      "./operations",
      "./tools",
    ]);
  });

  it("removes the old X app node package name from source and manifests", () => {
    const staleReferences = workspaceFilesToScan()
      .filter((path) => !relative(repoRoot, path).startsWith(".codex/"))
      .filter((path) => {
        const contents = readFileSync(path, "utf8");
        return contents.includes(oldXPackage) || contents.includes(oldXPath);
      })
      .map((path) => relative(repoRoot, path))
      .sort();

    expect(staleReferences).toEqual([]);
  });

  it("hosts GitHub contract and node code behind explicit connector entrypoints", () => {
    const githubPackage = readJson<{
      dependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
      name?: string;
      private?: boolean;
    }>("connectors/github/package.json");

    expect(existsSync(resolve(repoRoot, oldGitHubContractPath))).toBe(false);
    expect(existsSync(resolve(repoRoot, oldGitHubNodePath))).toBe(false);
    expect(githubPackage.name).toBe("@lightfast/connector-github");
    expect(githubPackage.private).toBe(true);
    expect(githubPackage.dependencies?.jose).toBe("catalog:");
    expect(githubPackage.dependencies?.zod).toBe("catalog:");
    expect(Object.keys(githubPackage.exports ?? {}).sort()).toEqual([
      "./contract",
      "./node",
    ]);
  });

  it("removes the old GitHub app package names from source and manifests", () => {
    const staleReferences = workspaceFilesToScan()
      .filter((path) => !relative(repoRoot, path).startsWith(".codex/"))
      .filter((path) => {
        const contents = readFileSync(path, "utf8");
        return (
          contents.includes(oldGitHubContractPackage) ||
          contents.includes(oldGitHubContractPath) ||
          contents.includes(oldGitHubNodePackage) ||
          contents.includes(oldGitHubNodePath)
        );
      })
      .map((path) => relative(repoRoot, path))
      .sort();

    expect(staleReferences).toEqual([]);
  });

  it("hosts Granola provider runtime code behind explicit connector entrypoints", () => {
    const granolaPackage = readJson<{
      dependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
      name?: string;
      private?: boolean;
    }>("connectors/granola/package.json");

    expect(existsSync(resolve(repoRoot, oldGranolaPath))).toBe(false);
    expect(granolaPackage.name).toBe("@lightfast/connector-granola");
    expect(granolaPackage.private).toBe(true);
    expect(granolaPackage.dependencies?.["@lightfast/connector-core"]).toBe(
      "workspace:*"
    );
    expect(granolaPackage.dependencies?.["@vendor/mcp"]).toBe("workspace:*");
    expect(granolaPackage.dependencies?.zod).toBe("catalog:");
    expect(Object.keys(granolaPackage.exports ?? {}).sort()).toEqual([
      "./mcp",
      "./node",
      "./oauth",
    ]);
  });

  it("removes the old Granola app node package name from source and manifests", () => {
    const staleReferences = workspaceFilesToScan()
      .filter((path) => !relative(repoRoot, path).startsWith(".codex/"))
      .filter((path) => {
        const contents = readFileSync(path, "utf8");
        return (
          contents.includes(oldGranolaPackage) ||
          contents.includes(oldGranolaPath)
        );
      })
      .map((path) => relative(repoRoot, path))
      .sort();

    expect(staleReferences).toEqual([]);
  });
});
