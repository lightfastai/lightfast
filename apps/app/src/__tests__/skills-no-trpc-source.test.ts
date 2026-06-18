import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("migrated skills data access", () => {
  it("uses TanStack server functions instead of tRPC", () => {
    const skillsAdapterImport = /from\s+["']@api\/app\/tanstack\/skills["']/;
    const clientSource = source("src/skills/skills-client.tsx");
    const querySource = source("src/skills/skills-queries.ts");
    const controllerSource = source(
      "src/skills/use-skill-index-refresh-controller.ts"
    );
    const typesSource = source("src/skills/skills-types.ts");

    expect(clientSource).toMatch(skillsAdapterImport);
    expect(clientSource).toContain("listSkills");
    expect(clientSource).toContain("skillsListQueryKey");
    expect(clientSource).not.toContain("skillsListQueryOptions");
    expect(clientSource).not.toContain("useTRPC");
    expect(clientSource).not.toContain("trpc.org.workspace.skills");
    expect(querySource).toContain("skillsListQueryKey");
    expect(querySource).not.toMatch(skillsAdapterImport);
    expect(querySource).not.toContain("useTRPC");
    expect(querySource).not.toContain("trpc.org.workspace.skills");
    expect(controllerSource).toMatch(skillsAdapterImport);
    expect(controllerSource).not.toContain("useTRPC");
    expect(controllerSource).not.toContain("trpc.org.workspace.skills");
    expect(typesSource).toMatch(skillsAdapterImport);
    expect(typesSource).not.toContain("AppRouterOutputs");
  });
});
