import { readFileSync } from "node:fs";
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
  it("uses local TanStack query helpers backed by api/app server functions", () => {
    const source = readFileSync(
      resolve(
        appRoot,
        "src/org/settings/source-control/source-control-queries.ts"
      ),
      "utf8"
    );

    expect(source).toContain('@api/app/tanstack/source-control"');
    expect(source).toContain("queryOptions");
    expect(source).toContain("mutationOptions");
    expect(source).not.toContain("useTRPC");
    expect(source).not.toContain('enabled: typeof window !== "undefined"');
  });

  it("removes source-control UI callers from tRPC", () => {
    for (const file of migratedFiles) {
      const source = readFileSync(resolve(appRoot, file), "utf8");
      expect(source, file).not.toContain("useTRPC");
      expect(source, file).not.toContain("org.settings.sourceControl");
    }
  });
});
