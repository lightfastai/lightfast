import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");
const repoRoot = resolve(appRoot, "../..");

describe("GitHub setup app data access", () => {
  it("removes the GitHub setup mutation-only helper module", () => {
    expect(
      existsSync(resolve(appRoot, "src/org/setup/github-setup-queries.ts"))
    ).toBe(false);
  });

  it("keeps GitHub setup UI callers on direct api/app server functions", () => {
    const bindSource = readFileSync(
      resolve(appRoot, "src/org/setup/bind-github-card.tsx"),
      "utf8"
    );
    const completeSource = readFileSync(
      resolve(appRoot, "src/org/setup/github-bind-complete-client.tsx"),
      "utf8"
    );
    const repoSource = readFileSync(
      resolve(appRoot, "src/org/setup/lightfast-repo-setup-client.tsx"),
      "utf8"
    );
    const xCompleteSource = readFileSync(
      resolve(appRoot, "src/org/setup/x-connector-setup-complete-client.tsx"),
      "utf8"
    );

    expect(bindSource).toContain('@api/app/tanstack/github-setup"');
    expect(bindSource).toContain("startGitHubOrgSetup");
    expect(bindSource).toContain("type StartGitHubOrgSetupInput");
    expect(bindSource).toContain("type StartGitHubOrgSetupResult");
    expect(completeSource).toContain('@api/app/tanstack/github-setup"');
    expect(completeSource).toContain("syncGitHubBindingClaim");
    expect(repoSource).toContain('@api/app/tanstack/github-setup"');
    expect(repoSource).toContain("verifyGitHubLightfastRepo");
    expect(xCompleteSource).toContain('@api/app/tanstack/github-setup"');
    expect(xCompleteSource).toContain("syncGitHubBindingClaim");

    for (const source of [
      bindSource,
      completeSource,
      repoSource,
      xCompleteSource,
    ]) {
      expect(source).not.toContain("useTRPC");
      expect(source).not.toContain("org.setup.github");
      expect(source).not.toContain("startGitHubOrgSetupMutationOptions");
      expect(source).not.toContain("syncGitHubBindingClaimMutationOptions");
      expect(source).not.toContain("verifyGitHubLightfastRepoMutationOptions");
    }
  });

  it("exports explicit GitHub setup contracts from api/app", () => {
    const source = readFileSync(
      resolve(repoRoot, "api/app/src/adapters/tanstack/github-setup.ts"),
      "utf8"
    );

    expect(source).toContain("export type StartGitHubOrgSetupInput");
    expect(source).toContain("export type StartGitHubOrgSetupResult");
    expect(source).toContain("export type SyncGitHubBindingClaimResult");
    expect(source).toContain("export type VerifyGitHubLightfastRepoResult");
  });
});
