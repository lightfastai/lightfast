import { describe, expect, it } from "vitest";
import {
  formatCaller,
  getDecisionStatusMeta,
  getSourceLabel,
  groupDecisionsByDay,
} from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/decisions-model";

const DAY = 86_400_000;

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    publicId: "provider_routine_call_1",
    clerkOrgId: "org_1",
    calledByKind: "automation",
    calledById: "run_1",
    calledByUserId: null,
    provider: "linear",
    routineId: "linear__create_issue",
    providerToolName: "create_issue",
    providerConnectionId: 1,
    providerWorkspaceId: null,
    providerActorId: null,
    providerAttempted: true,
    sourceClientId: null,
    sourceRef: null,
    sourceSurface: "automation",
    status: "succeeded",
    inputRedacted: null,
    outputRedacted: null,
    errorCode: null,
    errorMessage: null,
    startedAt: new Date("2026-06-03T10:00:00.000Z"),
    finishedAt: new Date("2026-06-03T10:00:01.000Z"),
    createdAt: new Date("2026-06-03T10:00:00.000Z"),
    updatedAt: new Date("2026-06-03T10:00:01.000Z"),
    ...overrides,
  } as Parameters<typeof formatCaller>[0];
}

describe("formatCaller", () => {
  it("labels automation, user, and system callers", () => {
    expect(formatCaller(makeRow({ calledByKind: "automation" }))).toBe(
      "Automation run_1"
    );
    expect(
      formatCaller(makeRow({ calledByKind: "user", calledByUserId: "user_42" }))
    ).toBe("User user_42");
    expect(formatCaller(makeRow({ calledByKind: "system" }))).toBe(
      "System run_1"
    );
  });
});

describe("getSourceLabel", () => {
  it("maps every source surface to a human label", () => {
    expect(getSourceLabel("automation")).toBe("Automation");
    expect(getSourceLabel("chat")).toBe("Chat");
    expect(getSourceLabel("hosted_mcp")).toBe("Hosted MCP");
    expect(getSourceLabel("native_cli")).toBe("Native CLI");
    expect(getSourceLabel("system")).toBe("System");
  });
});

describe("getDecisionStatusMeta", () => {
  it("provides a glyph tone and left-rail color per status", () => {
    expect(getDecisionStatusMeta("failed").rail).toContain("destructive");
    expect(getDecisionStatusMeta("succeeded").tone).toContain("emerald");
    expect(getDecisionStatusMeta("running").tone).toContain("animate-spin");
  });
});

describe("groupDecisionsByDay", () => {
  it("groups by UTC calendar day with Today/Yesterday labels and failure counts", () => {
    const now = new Date("2026-06-03T12:00:00.000Z");
    const rows = [
      makeRow({ id: 3, startedAt: new Date(now.getTime() - 1 * 1000) }),
      makeRow({
        id: 2,
        status: "failed",
        startedAt: new Date(now.getTime() - DAY),
      }),
      makeRow({ id: 1, startedAt: new Date(now.getTime() - 5 * DAY) }),
    ];

    const groups = groupDecisionsByDay(rows, now);

    expect(groups).toHaveLength(3);
    expect(groups[0]!.label).toBe("Today");
    expect(groups[0]!.rows).toHaveLength(1);
    expect(groups[0]!.failureCount).toBe(0);
    expect(groups[1]!.label).toBe("Yesterday");
    expect(groups[1]!.failureCount).toBe(1);
    expect(groups[2]!.label).toMatch(/\d/);
  });
});
