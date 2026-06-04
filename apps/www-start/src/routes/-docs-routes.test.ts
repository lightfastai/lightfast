import { describe, expect, it } from "vitest";

const routeModules = import.meta.glob("./docs/$.tsx", {
  eager: true,
});
const overlappingRootRouteModules = import.meta.glob("./docs.tsx", {
  eager: true,
});

describe("docs routes", () => {
  it("registers the migrated docs catch-all route module", () => {
    expect(Object.keys(routeModules)).toEqual(["./docs/$.tsx"]);
    expect(Object.keys(overlappingRootRouteModules)).toEqual([]);
  });
});
