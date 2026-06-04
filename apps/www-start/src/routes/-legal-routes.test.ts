import { describe, expect, it } from "vitest";

const routeModules = import.meta.glob("./legal/$slug.tsx", {
  eager: true,
});

describe("legal routes", () => {
  it("registers the migrated dynamic legal route module", () => {
    expect(Object.keys(routeModules)).toEqual(["./legal/$slug.tsx"]);
  });
});
