import { describe, expect, it } from "vitest";

import {
  getMemberStatusLabel,
  getPersonSourceLabel,
  peopleMemberStatusOptions,
  peopleSourceOptions,
} from "./people-model";

describe("people team member model", () => {
  it("exposes source and member status filter options", () => {
    expect(peopleSourceOptions.map((option) => option.value)).toEqual([
      "signal",
      "team_member",
      "mixed",
    ]);
    expect(peopleMemberStatusOptions.map((option) => option.value)).toEqual([
      "active",
      "former",
    ]);
  });

  it("formats source and member status labels", () => {
    expect(getPersonSourceLabel("team_member")).toBe("Team member");
    expect(getMemberStatusLabel("former")).toBe("Former member");
  });
});
