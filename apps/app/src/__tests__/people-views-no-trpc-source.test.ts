import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("migrated people views data access", () => {
  it("uses TanStack server functions instead of tRPC", () => {
    const hookPath = resolve(appRoot, "src/people/use-people-views-query.ts");
    const source = readFileSync(
      resolve(appRoot, "src/people/people-view-switcher.tsx"),
      "utf8"
    );

    expect(existsSync(hookPath)).toBe(false);
    expect(source).toContain('@api/app/tanstack/people-views"');
    expect(source).not.toContain("useTRPC");
    expect(source).not.toContain("trpc.org.workspace.people.views");
    expect(source).not.toContain("./use-people-views-query");
  });
});
