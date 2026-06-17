import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const apiRoot = resolve(repoRoot, "api/app");

describe("GitHub setup TanStack adapter boundary", () => {
  it("exports GitHub setup server functions from @api/app", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(apiRoot, "package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };

    expect(packageJson.exports).toHaveProperty("./tanstack/github-setup");
  });

  it("defines handwritten GitHub setup server functions in the api/app adapter layer", () => {
    const source = readFileSync(
      resolve(apiRoot, "src/adapters/tanstack/github-setup.ts"),
      "utf8"
    );

    expect(source).toContain('from "@tanstack/react-start"');
    expect(source).toContain("createServerFn");
    expect(source).toContain("startGitHubOrgSetupCommand");
    expect(source).toContain("syncGitHubBindingClaimCommand");
    expect(source).toContain("verifyGitHubLightfastRepoCommand");
    expect(source).toContain('mappedError.name = "DomainError"');
    expect(source).not.toContain("TRPCError");
    expect(source).not.toContain("ORPCError");
    expect(source).not.toContain("defineCommandSurface");
    expect(source).not.toContain("dispatchCommand");
  });

  it("removes migrated GitHub setup procedures from tRPC", () => {
    const rootSource = readFileSync(resolve(apiRoot, "src/root.ts"), "utf8");
    const routerPath = resolve(
      apiRoot,
      "src/router/(pending-not-allowed)/github-setup.ts"
    );

    expect(rootSource).not.toContain("githubSetupRouter");
    expect(rootSource).not.toContain("github:");

    if (existsSync(routerPath)) {
      const routerSource = readFileSync(routerPath, "utf8");
      expect(routerSource).not.toContain("githubSetupRouter");
      expect(routerSource).not.toContain("orgAdminProcedure");
      expect(routerSource).not.toContain("setupProcedure");
    }
  });
});
