import { describe, expect, it } from "vitest";
import {
  normalizePeopleSearch,
  parsePersonProviders,
  parsePersonTypes,
  serializePersonValues,
  togglePersonValue,
  validatePeopleSearch,
} from "~/people/people-search-params";

describe("people search params", () => {
  it("normalizes route search values for the People route", () => {
    expect(
      normalizePeopleSearch({
        peopleQuery: "someone",
        person: "person_123",
        provider: "github,email",
        type: "handle",
        view: "peopleview_123",
      })
    ).toEqual({
      person: "person_123",
      provider: "github,email",
      type: "handle",
      view: "peopleview_123",
    });

    expect(
      normalizePeopleSearch({
        peopleQuery: 42,
        person: "",
        provider: ["github"],
        type: null,
        view: "",
      })
    ).toEqual({
      person: null,
      provider: "",
      type: "",
      view: null,
    });
  });

  it("validates search params by omitting default values", () => {
    expect(
      validatePeopleSearch({
        peopleQuery: "someone",
        person: "",
        provider: "",
        type: "",
        view: "",
      })
    ).toEqual({});

    expect(
      validatePeopleSearch({
        peopleQuery: "someone",
        person: "person_123",
        provider: "github",
        type: "handle",
        view: "peopleview_123",
      })
    ).toEqual({
      person: "person_123",
      provider: "github",
      type: "handle",
      view: "peopleview_123",
    });
  });

  it("parses filter lists as allowed unique values", () => {
    expect(parsePersonProviders("github,unknown,email,github")).toEqual([
      "github",
      "email",
    ]);
    expect(parsePersonTypes("handle,email,bogus,handle")).toEqual([
      "handle",
      "email",
    ]);
  });

  it("serializes and toggles filter values", () => {
    expect(serializePersonValues(["github", "email"])).toBe("github,email");
    expect(serializePersonValues([])).toBe("");
    expect(togglePersonValue(["github"], "email")).toEqual(["github", "email"]);
    expect(togglePersonValue(["github", "email"], "github")).toEqual(["email"]);
  });
});
