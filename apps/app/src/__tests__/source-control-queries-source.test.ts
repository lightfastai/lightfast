import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

const migratedFiles = [
  "src/org/settings/source-control/source-control-settings-client.tsx",
  "src/org/settings/source-control/add-repository-dialog.tsx",
  "src/org/settings/source-control/repository-list.tsx",
  "src/routes/_authenticated/$slug/tasks/index.tsx",
  "src/routes/_authenticated/$slug/tasks/github/lightfast-repo.tsx",
] as const;

describe("source-control app data access", () => {
  it("keeps cache primitives without a query-options wrapper", () => {
    const queriesPath =
      "src/org/settings/source-control/source-control-queries.ts";
    const cacheSource = readFileSync(
      resolve(
        appRoot,
        "src/org/settings/source-control/source-control-cache.ts"
      ),
      "utf8"
    );
    const settingsSource = readFileSync(
      resolve(
        appRoot,
        "src/org/settings/source-control/source-control-settings-client.tsx"
      ),
      "utf8"
    );
    const addRepositorySource = readFileSync(
      resolve(
        appRoot,
        "src/org/settings/source-control/add-repository-dialog.tsx"
      ),
      "utf8"
    );
    const tasksSource = readFileSync(
      resolve(appRoot, "src/routes/_authenticated/$slug/tasks/index.tsx"),
      "utf8"
    );
    const lightfastRepoSource = readFileSync(
      resolve(
        appRoot,
        "src/routes/_authenticated/$slug/tasks/github/lightfast-repo.tsx"
      ),
      "utf8"
    );

    expect(existsSync(resolve(appRoot, queriesPath))).toBe(false);
    expect(cacheSource).toContain('@api/app/tanstack/source-control"');
    expect(cacheSource).toContain("sourceControlConnectionQueryKey");
    expect(cacheSource).toContain("sourceControlRepositoriesQueryKey");
    expect(cacheSource).toContain("sourceControlConnectionFromRepositories");
    expect(cacheSource).not.toContain("queryOptions");
    expect(cacheSource).not.toContain("mutationOptions");
    expect(cacheSource).not.toContain("getSourceControlConnection");
    expect(cacheSource).not.toContain("listSourceControlRepositories");
    expect(settingsSource).toContain('@api/app/tanstack/source-control"');
    expect(settingsSource).toContain("getSourceControlConnection");
    expect(settingsSource).toContain("listSourceControlRepositories");
    expect(settingsSource).not.toContain("sourceControlConnectionQueryOptions");
    expect(settingsSource).not.toContain(
      "sourceControlRepositoriesQueryOptions"
    );
    expect(addRepositorySource).toContain("importSourceControlRepository");
    expect(addRepositorySource).toContain("setQueryData");
    expect(addRepositorySource).not.toContain(
      "importSourceControlRepositoryMutationOptions"
    );
    expect(tasksSource).toContain("getSourceControlConnection");
    expect(lightfastRepoSource).toContain("getSourceControlConnection");
  });

  it("removes source-control UI callers from tRPC", () => {
    for (const file of migratedFiles) {
      const source = readFileSync(resolve(appRoot, file), "utf8");
      expect(source, file).not.toContain("useTRPC");
      expect(source, file).not.toContain("org.settings.sourceControl");
    }
  });
});
