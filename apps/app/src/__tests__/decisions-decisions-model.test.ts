import { describe, expect, it } from "vitest";
import { type DecisionRow, formatCaller } from "~/decisions/decisions-model";

const now = new Date("2026-06-24T00:00:00.000Z");

function decision(overrides: Partial<DecisionRow> = {}): DecisionRow {
  return {
    calledById: "user_123",
    calledByKind: "user",
    calledByUserId: "user_123",
    calledByUsername: null,
    clerkOrgId: "org_123",
    classification: "write",
    createdAt: now,
    decisionId: "provider_routine_call_123",
    errorCode: null,
    errorMessage: null,
    finishedAt: now,
    id: 1,
    inputPayload: null,
    outputPayload: null,
    provider: "linear",
    providerActorId: null,
    providerAttempted: true,
    providerConnectionId: 1,
    providerToolName: "create_issue",
    providerWorkspaceId: null,
    publicId: "provider_routine_call_123",
    routineId: "linear__create_issue",
    snippet: "Linear / Create Issue succeeded from Chat",
    sourceClientId: null,
    sourceRef: null,
    sourceSurface: "chat",
    startedAt: now,
    status: "succeeded",
    title: "Create Issue",
    updatedAt: now,
    ...overrides,
  };
}

describe("formatCaller", () => {
  it("uses the enriched username for user callers when available", () => {
    expect(formatCaller(decision({ calledByUsername: "jane" }))).toBe(
      "User jane"
    );
  });

  it("falls back to the user id when no username is available", () => {
    expect(formatCaller(decision())).toBe("User user_123");
  });
});
