import { describe, expect, it } from "vitest";

import {
  parsePersonMemberStatuses,
  parsePersonSources,
  serializePersonValues,
} from "./people-search-params";

describe("people search params", () => {
  it("parses source filters safely", () => {
    expect(parsePersonSources("team_member,mixed,invalid,team_member")).toEqual(
      ["team_member", "mixed"]
    );
  });

  it("parses member status filters safely", () => {
    expect(parsePersonMemberStatuses("active,pending,former")).toEqual([
      "active",
      "former",
    ]);
  });

  it("serializes empty selections as an empty param", () => {
    expect(serializePersonValues([])).toBe("");
  });
});
