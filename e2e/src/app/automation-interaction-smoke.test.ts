import { describe, expect, it } from "vitest";

import {
  buildAppAutomationInteractionFixture,
  buildAppAutomationInteractionPaths,
} from "./automation-interaction-smoke";

describe("app automation interaction smoke helpers", () => {
  it("builds deterministic automation copy for browser assertions", () => {
    const fixture = buildAppAutomationInteractionFixture({
      nowMs: 1_780_876_800_000,
    });

    expect(fixture).toEqual({
      createName: "UI smoke automation 1780876800000",
      createPrompt: "Created through app automation interaction smoke.",
      updateName: "Updated UI smoke automation 1780876800000",
      updatePrompt: "Updated through app automation interaction smoke.",
    });
  });

  it("builds organization-scoped automation paths", () => {
    expect(buildAppAutomationInteractionPaths("lightfast")).toEqual({
      listPath: "/lightfast/automations",
      newPath: "/lightfast/automations/new",
    });
  });
});
