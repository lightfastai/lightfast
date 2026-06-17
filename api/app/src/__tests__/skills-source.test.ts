import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const apiRoot = resolve(repoRoot, "api/app/src");

describe("skills TanStack migration", () => {
  it("exports skills server functions from @api/app", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(repoRoot, "api/app/package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };

    expect(packageJson.exports).toHaveProperty("./tanstack/skills");
  });

  it("does not expose workspace skills over tRPC", () => {
    const rootSource = readFileSync(resolve(apiRoot, "root.ts"), "utf8");

    expect(rootSource).not.toContain("workspaceSkillsRouter");
    expect(rootSource).not.toMatch(/skills\s*:\s*workspaceSkillsRouter/);
  });

  it("defines skills server functions in the api/app adapter layer", () => {
    const adapterSource = readFileSync(
      resolve(apiRoot, "adapters/tanstack/skills.ts"),
      "utf8"
    );

    expect(adapterSource).toContain('from "@tanstack/react-start"');
    expect(adapterSource).toContain("createServerFn");
    expect(adapterSource).toContain("listSkills");
    expect(adapterSource).toContain("requestSkillRefresh");
    expect(adapterSource).not.toContain("TRPCError");
  });
});
