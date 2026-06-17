import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");

describe("workspace people tRPC router after TanStack migration", () => {
  it("does not expose migrated people data or views over tRPC", () => {
    const apiRoot = resolve(repoRoot, "api/app/src");
    const rootSource = readFileSync(resolve(apiRoot, "root.ts"), "utf8");

    expect(rootSource).not.toContain("workspacePeopleRouter");
    expect(rootSource).not.toContain("people: workspacePeopleRouter");
    expect(
      existsSync(
        resolve(apiRoot, "router/(pending-not-allowed)/workspace-people.ts")
      )
    ).toBe(false);
    expect(
      existsSync(
        resolve(
          apiRoot,
          "router/(pending-not-allowed)/workspace-people-views.ts"
        )
      )
    ).toBe(false);

    const tanstackSource = readFileSync(
      resolve(apiRoot, "adapters/tanstack/people.ts"),
      "utf8"
    );

    expect(tanstackSource).toContain("listPeople");
    expect(tanstackSource).toContain("getPerson");
  });
});
