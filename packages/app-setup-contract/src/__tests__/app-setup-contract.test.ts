import { describe, expect, it } from "vitest";

import {
  APP_SETUP_ERROR_CODES,
  githubLightfastRepositoryProofSchema,
  LIGHTFAST_REPOSITORY_NAME,
  ORG_SETUP_REQUIREMENTS,
  orgSetupGateSchema,
  pathForSetupRequirement,
  repairIdForSetupRequirement,
} from "../index";

describe("@repo/app-setup-contract", () => {
  it("defines the setup requirements in order", () => {
    expect(ORG_SETUP_REQUIREMENTS).toEqual([
      "github_org",
      "github_lightfast_repo",
      "x_connector",
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
    expect(repairIdForSetupRequirement("x_connector")).toBe(
      "setup-x-connector"
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
    expect(
      pathForSetupRequirement({
        orgSlug: "acme",
        requirement: "x_connector",
      })
    ).toBe("/acme/tasks/connectors/x");
  });

  it("models setup gate states without impossible nullable combinations", () => {
    expect(
      orgSetupGateSchema.parse({
        bindingStatus: "bound",
        nextSetupRequirement: null,
      })
    ).toEqual({
      bindingStatus: "bound",
      nextSetupRequirement: null,
    });
    expect(
      orgSetupGateSchema.parse({
        bindingStatus: "unbound",
        nextSetupRequirement: "github_org",
      })
    ).toEqual({
      bindingStatus: "unbound",
      nextSetupRequirement: "github_org",
    });

    expect(
      orgSetupGateSchema.safeParse({
        bindingStatus: "bound",
        nextSetupRequirement: "github_org",
      }).success
    ).toBe(false);
    expect(
      orgSetupGateSchema.safeParse({
        bindingStatus: "unbound",
        nextSetupRequirement: null,
      }).success
    ).toBe(false);
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
