import { describe, expect, it } from "vitest";

import {
  APP_SETUP_ERROR_CODES,
  githubLightfastRepositoryProofSchema,
  LIGHTFAST_REPOSITORY_NAME,
  ORG_SETUP_REQUIREMENTS,
  pathForSetupRequirement,
  repairIdForSetupRequirement,
} from "../index";

describe("@repo/app-setup-contract", () => {
  it("defines the two setup requirements in order", () => {
    expect(ORG_SETUP_REQUIREMENTS).toEqual([
      "github_org",
      "github_lightfast_repo",
    ]);
  });

  it("keeps the required repository name exact", () => {
    expect(LIGHTFAST_REPOSITORY_NAME).toBe(".lightfast");
  });

  it("maps setup requirements to repair ids", () => {
    expect(repairIdForSetupRequirement("github_org")).toBe("setup-github-org");
    expect(repairIdForSetupRequirement("github_lightfast_repo")).toBe(
      "setup-github-lightfast-repo"
    );
  });

  it("maps setup requirements to org setup paths", () => {
    expect(
      pathForSetupRequirement({
        orgSlug: "acme",
        requirement: "github_org",
      })
    ).toBe("/acme/tasks/bind");
    expect(
      pathForSetupRequirement({
        orgSlug: "acme",
        requirement: "github_lightfast_repo",
      })
    ).toBe("/acme/tasks/github/lightfast-repo");
  });

  it("validates .lightfast repository proofs", () => {
    expect(
      githubLightfastRepositoryProofSchema.parse({
        fullName: "acme/.lightfast",
        id: "12345",
        installationId: "1001",
        name: ".lightfast",
        verifiedAt: "2026-05-30T10:00:00.000Z",
      })
    ).toEqual({
      fullName: "acme/.lightfast",
      id: "12345",
      installationId: "1001",
      name: ".lightfast",
      verifiedAt: "2026-05-30T10:00:00.000Z",
    });

    expect(
      githubLightfastRepositoryProofSchema.safeParse({
        fullName: "acme/workspace",
        id: "12345",
        installationId: "1001",
        name: "workspace",
        verifiedAt: "2026-05-30T10:00:00.000Z",
      }).success
    ).toBe(false);
  });

  it("keeps repository verification error codes compact", () => {
    expect(APP_SETUP_ERROR_CODES).toEqual([
      "github_transient_error",
      "lightfast_repo_missing",
      "lightfast_repo_inaccessible",
    ]);
  });
});
