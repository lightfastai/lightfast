import { describe, expect, it } from "vitest";

import { clerkOrgSlugSchema } from "../primitives/slugs";

describe("clerkOrgSlugSchema", () => {
  it.each(["oauth", "ingest"])("rejects reserved app route %s", (slug) => {
    expect(clerkOrgSlugSchema.safeParse(slug).success).toBe(false);
  });
});
