import { describe, expect, it } from "vitest";

import {
  buildAppTanstackAutomationScheduleFixture,
  buildAppTanstackAutomationSchedulePaths,
} from "./automation-schedule-smoke";

describe("app-tanstack automation schedule smoke helpers", () => {
  it("builds deterministic automation copy for schedule assertions", () => {
    expect(
      buildAppTanstackAutomationScheduleFixture({
        nowMs: 1_780_876_800_000,
      })
    ).toEqual({
      automationName: "Schedule smoke automation 1780876800000",
      automationPrompt:
        "Verify the app-tanstack schedule and status editor smoke can mutate this automation.",
    });
  });

  it("builds the organization-scoped automation detail path", () => {
    expect(
      buildAppTanstackAutomationSchedulePaths({
        automationId: "automation_123",
        orgSlug: "lightfast",
      })
    ).toEqual({
      detailPath: "/lightfast/automations/automation_123",
    });
  });
});
