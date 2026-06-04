import { describe, expect, it } from "vitest";

const routeModules = import.meta.glob("./use-cases/*.tsx", {
  eager: true,
});

describe("use-case routes", () => {
  it("registers the migrated use-case route modules", () => {
    expect(Object.keys(routeModules).sort()).toEqual([
      "./use-cases/agent-builders.tsx",
      "./use-cases/engineering-leaders.tsx",
      "./use-cases/platform-engineers.tsx",
      "./use-cases/technical-founders.tsx",
    ]);
  });
});
