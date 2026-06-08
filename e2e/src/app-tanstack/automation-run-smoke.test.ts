import { describe, expect, it } from "vitest";

import {
  buildAppTanstackAutomationRunFixture,
  buildAppTanstackAutomationRunPaths,
  isObservedAutomationRunStatus,
} from "./automation-run-smoke";

describe("app-tanstack automation run smoke helpers", () => {
  it("builds deterministic automation copy for manual run assertions", () => {
    expect(
      buildAppTanstackAutomationRunFixture({ nowMs: 1_780_876_800_000 })
    ).toEqual({
      automationName: "Manual run smoke automation 1780876800000",
      automationPrompt:
        "Verify the app-tanstack manual run history smoke can enqueue this automation.",
    });
  });

  it("builds automation detail and selected-run paths", () => {
    expect(
      buildAppTanstackAutomationRunPaths({
        automationId: "automation_123",
        orgSlug: "lightfast",
        runId: "automation_run_456",
      })
    ).toEqual({
      detailPath: "/lightfast/automations/automation_123",
      runDetailPath:
        "/lightfast/automations/automation_123?run=automation_run_456",
    });
  });

  it("returns null run detail path when run id is omitted", () => {
    expect(
      buildAppTanstackAutomationRunPaths({
        automationId: "automation_123",
        orgSlug: "lightfast",
      })
    ).toEqual({
      detailPath: "/lightfast/automations/automation_123",
      runDetailPath: null,
    });
  });

  it("recognizes run statuses that may be visible after enqueue", () => {
    expect(isObservedAutomationRunStatus("pending")).toBe(true);
    expect(isObservedAutomationRunStatus("running")).toBe(true);
    expect(isObservedAutomationRunStatus("completed")).toBe(true);
    expect(isObservedAutomationRunStatus("failed")).toBe(true);
    expect(isObservedAutomationRunStatus("skipped")).toBe(true);
    expect(isObservedAutomationRunStatus("deleted")).toBe(false);
  });
});
