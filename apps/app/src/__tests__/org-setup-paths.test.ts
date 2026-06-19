import { describe, expect, it } from "vitest";

import {
  accountTeamsPath,
  connectorCatalogPath,
  githubSetupCompletePath,
  pathForSetupRequirement,
  signInPath,
  xConnectorSetupCompletePath,
} from "../org/setup/setup-paths";

describe("app setup paths", () => {
  it("maps setup requirements to app-local org setup routes", () => {
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

  it("keeps OAuth completion redirect paths app-local", () => {
    expect(githubSetupCompletePath({ orgSlug: "acme" })).toBe(
      "/acme/tasks/bind/github/complete"
    );
    expect(xConnectorSetupCompletePath({ orgSlug: "acme" })).toBe(
      "/acme/tasks/connectors/x/complete"
    );
    expect(connectorCatalogPath({ orgSlug: "acme" })).toBe("/acme/connectors");
    expect(accountTeamsPath()).toBe("/account/teams");
    expect(signInPath()).toBe("/sign-in");
  });
});
