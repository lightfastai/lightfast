import { describe, expect, it } from "vitest";

const routeModules = import.meta.glob(
  ["./sitemap[.]xml.ts", "./robots[.]txt.ts", "./llms[.]txt.ts"],
  { eager: true }
);

describe("SEO discovery routes", () => {
  it("registers sitemap, robots, and llms server route modules", () => {
    expect(Object.keys(routeModules).sort()).toEqual(
      ["./sitemap[.]xml.ts", "./robots[.]txt.ts", "./llms[.]txt.ts"].sort()
    );
  });
});
