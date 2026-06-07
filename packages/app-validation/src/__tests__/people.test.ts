import { describe, expect, it } from "vitest";

import {
  peopleIdentityProviderSchema,
  peopleIdentityTypeSchema,
  personMemberStatusSchema,
  personSourceSchema,
} from "../schemas/people";

describe("person identity schemas", () => {
  it("accepts supported identity providers", () => {
    expect(peopleIdentityProviderSchema.options).toEqual([
      "email",
      "x",
      "linkedin",
      "github",
      "website",
    ]);
  });

  it("accepts supported identity types", () => {
    expect(peopleIdentityTypeSchema.options).toEqual([
      "email",
      "handle",
      "profile_url",
    ]);
  });

  it("rejects unsupported provider and type values", () => {
    expect(() => peopleIdentityProviderSchema.parse("discord")).toThrow();
    expect(() => peopleIdentityTypeSchema.parse("phone")).toThrow();
  });
});

describe("person source schemas", () => {
  it("accepts supported people row sources", () => {
    expect(personSourceSchema.options).toEqual([
      "signal",
      "team_member",
      "mixed",
    ]);
  });

  it("accepts supported member statuses", () => {
    expect(personMemberStatusSchema.options).toEqual(["active", "former"]);
  });

  it("rejects unsupported source and member status values", () => {
    expect(() => personSourceSchema.parse("invitation")).toThrow();
    expect(() => personMemberStatusSchema.parse("pending")).toThrow();
  });
});
