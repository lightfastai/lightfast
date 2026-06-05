import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routeModules = import.meta.glob("./search.tsx", {
  eager: true,
});

const appRoot = path.resolve(process.cwd(), "src/app/(app)");

describe("search route", () => {
  it("registers the migrated search route and supporting components", () => {
    expect(Object.keys(routeModules)).toEqual(["./search.tsx"]);

    for (const filePath of [
      "_components/search-input.tsx",
      "_components/search-interface.tsx",
      "_components/search-navbar.tsx",
      "_components/search-results.tsx",
      "_hooks/use-text-cycle.ts",
      "(search)/layout.tsx",
      "(search)/search/page.tsx",
    ]) {
      expect(fs.existsSync(path.join(appRoot, filePath))).toBe(true);
    }
  });
});
