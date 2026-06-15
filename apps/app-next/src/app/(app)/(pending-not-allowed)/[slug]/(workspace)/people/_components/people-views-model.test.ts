import { describe, expect, it } from "vitest";

import { isTeamMembersPresetFilters } from "./people-views-model";

describe("isTeamMembersPresetFilters", () => {
  it("does not match duplicate source values as the team members preset", () => {
    expect(
      isTeamMembersPresetFilters({
        memberStatuses: ["active"],
        providers: [],
        sources: ["team_member", "team_member"],
        types: [],
      })
    ).toBe(false);
  });
});
