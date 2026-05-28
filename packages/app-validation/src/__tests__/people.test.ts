import { describe, expect, it } from "vitest";

import {
  peopleIdentityProviderSchema,
  peopleIdentityTypeSchema,
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
