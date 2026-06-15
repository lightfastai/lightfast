import { describe, expect, it } from "vitest";

import {
  buildAppAutomationDeleteFixture,
  buildAppAutomationDeletePaths,
} from "./automation-delete-smoke";

describe("app automation delete smoke helpers", () => {
  it("builds deterministic automation copy for delete assertions", () => {
    expect(
      buildAppAutomationDeleteFixture({
        nowMs: 1_780_876_800_000,
      })
    ).toEqual({
      automationName: "Delete smoke automation 1780876800000",
      automationPrompt:
        "Verify the app automation delete smoke can remove this automation from the workspace list.",
    });
  });

  it("builds organization-scoped automation list and detail paths", () => {
    expect(
      buildAppAutomationDeletePaths({
        automationId: "automation_123",
        orgSlug: "lightfast",
      })
    ).toEqual({
      detailPath: "/lightfast/automations/automation_123",
      listPath: "/lightfast/automations",
    });
  });
});
