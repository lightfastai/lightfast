import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");

describe("workspace people tRPC router after TanStack migration", () => {
  it("keeps only the still-unmigrated people views procedures", () => {
    const source = readFileSync(
      resolve(
        repoRoot,
        "api/app/src/router/(pending-not-allowed)/workspace-people.ts"
      ),
      "utf8"
    );

    expect(source).toContain("views: workspacePeopleViewsRouter");
    expect(source).not.toContain("list: boundOrgProcedure");
    expect(source).not.toContain("get: boundOrgProcedure");
    expect(source).not.toContain("TRPCError");
    expect(source).not.toContain("listPeople(");
    expect(source).not.toContain("getPersonByPublicId(");
  });
});
