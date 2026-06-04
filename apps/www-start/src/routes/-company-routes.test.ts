import { describe, expect, it } from "vitest";

const routeModules = import.meta.glob("./{careers,company}.tsx", {
  eager: true,
});

describe("company routes", () => {
  it("registers the migrated company and careers route modules", () => {
    expect(Object.keys(routeModules).sort()).toEqual([
      "./careers.tsx",
      "./company.tsx",
    ]);
  });
});
