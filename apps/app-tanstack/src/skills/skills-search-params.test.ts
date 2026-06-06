import { describe, expect, it } from "vitest";
import {
  normalizeSkillsSearch,
  validateSkillsSearch,
} from "./skills-search-params";

describe("skills search params", () => {
  it("normalizes the selected skill into a nullable string", () => {
    expect(normalizeSkillsSearch({ skill: "code-review" })).toEqual({
      skill: "code-review",
    });
    expect(normalizeSkillsSearch({ skill: "" })).toEqual({ skill: null });
    expect(normalizeSkillsSearch({ skill: ["code-review"] })).toEqual({
      skill: null,
    });
  });

  it("validates route search by omitting empty params", () => {
    expect(validateSkillsSearch({ skill: "code-review" })).toEqual({
      skill: "code-review",
    });
    expect(validateSkillsSearch({ skill: "" })).toEqual({});
  });
});
