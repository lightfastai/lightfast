import { describe, expect, it } from "vitest";
import {
  getSetupRequirementRedirect,
  isOrgSettingsPath,
  isOrgSetupCompletePath,
  isOrgSetupExemptPath,
  isOrgSetupPath,
  shouldShowWorkspaceChatHistory,
} from "../workspace/workspace-route-model";

describe("workspace route model", () => {
  it("identifies setup, setup completion, and settings paths for a slug", () => {
    expect(isOrgSetupPath("acme", "/acme/tasks")).toBe(true);
    expect(isOrgSetupPath("acme", "/acme/tasks/bind")).toBe(true);
    expect(isOrgSetupPath("acme", "/other/tasks")).toBe(false);
    expect(isOrgSetupPath("acme", "/acme/task")).toBe(false);

    expect(
      isOrgSetupCompletePath("acme", "/acme/tasks/bind/github/complete")
    ).toBe(true);
    expect(
      isOrgSetupCompletePath("acme", "/acme/tasks/connectors/x/complete")
    ).toBe(true);
    expect(isOrgSetupCompletePath("acme", "/acme/tasks/bind")).toBe(false);

    expect(isOrgSettingsPath("acme", "/acme/settings")).toBe(true);
    expect(isOrgSettingsPath("acme", "/acme/settings/general")).toBe(true);
    expect(isOrgSettingsPath("acme", "/acme/settingsish")).toBe(false);
  });

  it("keeps setup requirements exempt only on setup and settings routes", () => {
    expect(isOrgSetupExemptPath("acme", "/acme/tasks/bind")).toBe(true);
    expect(isOrgSetupExemptPath("acme", "/acme/settings/source-control")).toBe(
      true
    );
    expect(isOrgSetupExemptPath("acme", "/acme/automations")).toBe(false);
  });

  it("maps setup requirements to workspace task redirects", () => {
    expect(
      getSetupRequirementRedirect("github_lightfast_repo", "acme")
    ).toStrictEqual({
      params: { slug: "acme" },
      to: "/$slug/tasks/github/lightfast-repo",
    });
    expect(getSetupRequirementRedirect("x_connector", "acme")).toStrictEqual({
      params: { slug: "acme" },
      to: "/$slug/tasks/connectors/x",
    });
    expect(getSetupRequirementRedirect("unknown", "acme")).toStrictEqual({
      params: { slug: "acme" },
      to: "/$slug/tasks/bind",
    });
  });

  it("shows chat history only for bound non-settings workspace routes", () => {
    expect(
      shouldShowWorkspaceChatHistory({
        bindingStatus: "bound",
        pathname: "/acme/automations",
        slug: "acme",
      })
    ).toBe(true);
    expect(
      shouldShowWorkspaceChatHistory({
        bindingStatus: "pending",
        pathname: "/acme/automations",
        slug: "acme",
      })
    ).toBe(false);
    expect(
      shouldShowWorkspaceChatHistory({
        bindingStatus: "bound",
        pathname: "/acme/settings/general",
        slug: "acme",
      })
    ).toBe(false);
  });
});
