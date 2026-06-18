import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("skills app data access", () => {
  it("uses local TanStack query helpers backed by api/app server functions", () => {
    const querySource = source("src/skills/skills-queries.ts");

    expect(querySource).toContain('@api/app/tanstack/skills"');
    expect(querySource).toContain("skillsListQueryKey");
    expect(querySource).toContain("skillsListQueryOptions");
    expect(querySource).not.toContain("useTRPC");
  });

  it("inlines the shared skills list hook into its consumers", () => {
    const listHookPath = resolve(
      appRoot,
      "src/skills/use-skills-list-query.ts"
    );
    const clientSource = source("src/skills/skills-client.tsx");
    const topbarSource = source("src/workspace/workspace-topbar-actions.tsx");
    const controllerSource = source(
      "src/skills/use-skill-index-refresh-controller.ts"
    );

    expect(existsSync(listHookPath)).toBe(false);
    expect(clientSource).toContain("useQuery");
    expect(clientSource).toContain("skillsListQueryOptions");
    expect(clientSource).not.toContain("useSkillsListQuery");
    expect(clientSource).not.toContain("./use-skills-list-query");
    expect(topbarSource).toContain("useQuery");
    expect(topbarSource).toContain("skillsListQueryOptions");
    expect(topbarSource).not.toContain("useSkillsListQuery");
    expect(topbarSource).not.toContain("~/skills/use-skills-list-query");
    expect(controllerSource).toContain('from "./skills-queries"');
  });
});
