import { describe, expect, it } from "vitest";
import {
  allPeopleParamValues,
  type PeopleViewConfig,
  selectionToConfig,
  viewConfigToParamValues,
} from "~/people/people-views-model";

describe("people views model", () => {
  it("serializes a saved view config into search param values", () => {
    const config: PeopleViewConfig = {
      filters: {
        providers: ["github", "email"],
        types: ["handle"],
      },
    };

    expect(viewConfigToParamValues(config)).toEqual({
      provider: "github,email",
      type: "handle",
    });
  });

  it("captures the current filter selection as a saved view config", () => {
    expect(
      selectionToConfig({
        providers: ["linkedin"],
        types: ["profile_url", "email"],
      })
    ).toEqual({
      filters: {
        providers: ["linkedin"],
        types: ["profile_url", "email"],
      },
    });
  });

  it("clears all saved view params", () => {
    expect(allPeopleParamValues()).toEqual({
      provider: "",
      type: "",
    });
  });
});
