import { describe, expect, it } from "vitest";

const routeModules = import.meta.glob(
  [
    "./blog.tsx",
    "./blog/$slug.tsx",
    "./blog/topic/$category.tsx",
    "./blog/rss[.]xml.ts",
    "./blog/atom[.]xml.ts",
    "./blog/feed[.]xml.ts",
    "./changelog.tsx",
    "./changelog/$slug.tsx",
    "./changelog/rss[.]xml.ts",
    "./changelog/atom[.]xml.ts",
    "./changelog/feed[.]xml.ts",
  ],
  { eager: true }
);

describe("content routes", () => {
  it("registers migrated blog, changelog, and feed route modules", () => {
    expect(Object.keys(routeModules).sort()).toEqual(
      [
        "./blog.tsx",
        "./blog/$slug.tsx",
        "./blog/topic/$category.tsx",
        "./blog/rss[.]xml.ts",
        "./blog/atom[.]xml.ts",
        "./blog/feed[.]xml.ts",
        "./changelog.tsx",
        "./changelog/$slug.tsx",
        "./changelog/rss[.]xml.ts",
        "./changelog/atom[.]xml.ts",
        "./changelog/feed[.]xml.ts",
      ].sort()
    );
  });
});
