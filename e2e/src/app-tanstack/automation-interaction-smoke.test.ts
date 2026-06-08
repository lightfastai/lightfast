import { describe, expect, it } from "vitest";

import {
  buildAppTanstackAutomationInteractionFixture,
  buildAppTanstackAutomationInteractionPaths,
} from "./automation-interaction-smoke";

describe("app-tanstack automation interaction smoke helpers", () => {
  it("builds deterministic automation copy for browser assertions", () => {
    const fixture = buildAppTanstackAutomationInteractionFixture({
      nowMs: 1_780_876_800_000,
    });

    expect(fixture).toEqual({
      createName: "UI smoke automation 1780876800000",
      createPrompt:
        "Created through app-tanstack automation interaction smoke.",
      updateName: "Updated UI smoke automation 1780876800000",
      updatePrompt:
        "Updated through app-tanstack automation interaction smoke.",
    });
  });

  it("builds organization-scoped automation paths", () => {
    expect(buildAppTanstackAutomationInteractionPaths("lightfast")).toEqual({
      listPath: "/lightfast/automations",
      newPath: "/lightfast/automations/new",
    });
  });
});
