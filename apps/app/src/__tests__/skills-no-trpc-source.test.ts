import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("migrated skills data access", () => {
  it("uses TanStack server functions instead of tRPC", () => {
    const querySource = source("src/skills/use-skills-list-query.ts");
    const controllerSource = source(
      "src/skills/use-skill-index-refresh-controller.ts"
    );
    const typesSource = source("src/skills/skills-types.ts");

    expect(querySource).toContain('@api/app/tanstack/skills"');
    expect(querySource).not.toContain("useTRPC");
    expect(querySource).not.toContain("trpc.org.workspace.skills");
    expect(controllerSource).toContain('@api/app/tanstack/skills"');
    expect(controllerSource).not.toContain("useTRPC");
    expect(controllerSource).not.toContain("trpc.org.workspace.skills");
    expect(typesSource).toContain('@api/app/tanstack/skills"');
    expect(typesSource).not.toContain("AppRouterOutputs");
  });
});
