import { describe, expect, it } from "vitest";

import { appTeamMembersReconcileRequestedEventSchema } from "../inngest/schemas/app";

describe("app Inngest event schemas", () => {
  it("allows team member reconcile requests without continuation fields", () => {
    expect(
      appTeamMembersReconcileRequestedEventSchema.safeParse({}).success
    ).toBe(true);
  });

  it("allows explicit null cursor for first-page team member reconciliation", () => {
    expect(
      appTeamMembersReconcileRequestedEventSchema.safeParse({
        cursor: null,
        syncedAtIso: "2026-06-06T02:00:00.000Z",
      }).success
    ).toBe(true);
  });
});
