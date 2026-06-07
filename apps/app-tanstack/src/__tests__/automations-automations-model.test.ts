import { describe, expect, it } from "vitest";
import {
  type AutomationListItem,
  getAutomationSections,
  hasAutomations,
} from "~/automations/automations-model";

function automation(
  overrides: Partial<AutomationListItem> = {}
): AutomationListItem {
  return {
    id: 1,
    publicId: "automation_1",
    name: "Morning check",
    prompt: "Check the workspace",
    scheduleKind: "daily",
    scheduleConfig: { time: "09:00" },
    timezone: "UTC",
    status: "active",
    nextRunAt: new Date("2026-05-28T09:00:00.000Z"),
    lastRunAt: new Date("2026-05-27T09:00:00.000Z"),
    scheduleVersion: 1,
    createdByUserId: "user_1",
    clerkOrgId: "org_1",
    createdAt: new Date("2026-05-27T00:00:00.000Z"),
    updatedAt: new Date("2026-05-27T00:00:00.000Z"),
    ...overrides,
  } as AutomationListItem;
}

describe("hasAutomations", () => {
  it("reports whether any automation rows are present", () => {
    expect(hasAutomations([])).toBe(false);
    expect(hasAutomations([automation()])).toBe(true);
  });
});

describe("getAutomationSections", () => {
  it("groups active rows before paused rows and omits empty groups", () => {
    const active = automation({
      publicId: "automation_active",
      status: "active",
    });
    const paused = automation({
      publicId: "automation_paused",
      status: "paused",
    });

    expect(getAutomationSections([paused, active])).toEqual([
      { automations: [active], title: "Current" },
      { automations: [paused], title: "Paused" },
    ]);
    expect(getAutomationSections([active])).toEqual([
      { automations: [active], title: "Current" },
    ]);
  });
});
