import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("skills app data access", () => {
  it("removes the skills query module instead of hiding one query key", () => {
    const queryPath = resolve(appRoot, "src/skills/skills-queries.ts");

    expect(existsSync(queryPath)).toBe(false);
  });

  it("inlines the shared skills list hook into its consumers", () => {
    const listHookPath = resolve(
      appRoot,
      "src/skills/use-skills-list-query.ts"
    );
    const topbarActionsPath = resolve(
      appRoot,
      "src/workspace/workspace-topbar-actions.tsx"
    );
    const clientSource = source("src/skills/skills-client.tsx");
    const controllerSource = source(
      "src/skills/use-skill-index-refresh-controller.ts"
    );

    expect(existsSync(listHookPath)).toBe(false);
    expect(existsSync(topbarActionsPath)).toBe(false);
    expect(clientSource).toContain("useQuery");
    expect(clientSource).toContain('@api/app/tanstack/skills"');
    expect(clientSource).toContain("listSkills");
    expect(clientSource).toContain('queryKey: ["skills", "list"] as const');
    expect(clientSource).not.toContain("skillsListQueryKey");
    expect(clientSource).not.toContain("skills-queries");
    expect(clientSource).not.toContain("skillsListQueryOptions");
    expect(clientSource).toContain("<SkillsActions");
    expect(clientSource).not.toContain("useSkillsListQuery");
    expect(clientSource).not.toContain("./use-skills-list-query");
    expect(controllerSource).toContain('queryKey: ["skills"] as const');
    expect(controllerSource).not.toContain("skillsListQueryKey");
    expect(controllerSource).not.toContain("skills-queries");
  });
});
