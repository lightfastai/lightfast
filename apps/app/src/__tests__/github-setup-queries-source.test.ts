import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("GitHub setup app data access", () => {
  it("uses local TanStack mutation helpers backed by api/app server functions", () => {
    const source = readFileSync(
      resolve(appRoot, "src/org/setup/github-setup-queries.ts"),
      "utf8"
    );

    expect(source).toContain('@api/app/tanstack/github-setup"');
    expect(source).toContain("mutationOptions");
    expect(source).toContain("startGitHubOrgSetupMutationOptions");
    expect(source).toContain("syncGitHubBindingClaimMutationOptions");
    expect(source).toContain("verifyGitHubLightfastRepoMutationOptions");
    expect(source).not.toContain("useTRPC");
  });

  it("removes GitHub setup UI callers from tRPC", () => {
    const files = [
      "src/org/setup/bind-github-card.tsx",
      "src/org/setup/github-bind-complete-client.tsx",
      "src/org/setup/lightfast-repo-setup-client.tsx",
      "src/org/setup/x-connector-setup-complete-client.tsx",
    ];

    for (const file of files) {
      const source = readFileSync(resolve(appRoot, file), "utf8");
      expect(source, file).not.toContain("useTRPC");
      expect(source, file).not.toContain("org.setup.github");
    }
  });
});
