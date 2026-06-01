import { describe, expect, it } from "vitest";

import {
  lightfastHandleSchema,
  normalizeLightfastHandle,
} from "../primitives/handles";
import { clerkOrgSlugSchema } from "../primitives/slugs";

describe("lightfastHandleSchema", () => {
  it("normalizes handles before validation", () => {
    expect(lightfastHandleSchema.parse(" Acme-User ")).toBe("acme-user");
    expect(normalizeLightfastHandle(" Acme-User ")).toBe("acme-user");
  });

  it("accepts route-safe handles", () => {
    expect(lightfastHandleSchema.parse("acme-user1")).toBe("acme-user1");
    expect(lightfastHandleSchema.parse("abcd")).toBe("abcd");
    expect(lightfastHandleSchema.parse("a".repeat(64))).toBe("a".repeat(64));
  });

  it.each([
    ["abc", "at least 4"],
    ["a".repeat(65), "less than 65"],
    ["-acme", "start with a letter or number"],
    ["acme-", "end with a letter or number"],
    ["acme--user", "consecutive hyphens"],
    ["acme_user", "lowercase letters, numbers, and hyphens"],
    ["acme.user", "lowercase letters, numbers, and hyphens"],
    ["api", "at least 4"],
    ["docs", "reserved"],
    ["account", "reserved"],
  ])("rejects %s", (value, message) => {
    const result = lightfastHandleSchema.safeParse(value);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain(message);
  });

  it("uses the shared handle rules for Clerk org slugs", () => {
    expect(clerkOrgSlugSchema.parse("acme-user")).toBe("acme-user");
    expect(clerkOrgSlugSchema.safeParse("abc").success).toBe(false);
    expect(clerkOrgSlugSchema.safeParse("docs").success).toBe(false);
  });
});
