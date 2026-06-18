import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("people app data access", () => {
  it("uses local TanStack query helpers backed by api/app server functions", () => {
    const querySource = source("src/people/people-queries.ts");

    expect(querySource).toContain('@api/app/tanstack/people"');
    expect(querySource).toContain("peopleQueryKeys");
    expect(querySource).toContain("peopleListInfiniteQueryOptions");
    expect(querySource).toContain("personDetailQueryOptions");
    expect(querySource).not.toContain("useTRPC");
  });

  it("moves people UI callers off workspace people tRPC procedures", () => {
    const listHookPath = resolve(
      appRoot,
      "src/people/use-people-list-query.ts"
    );
    const listSource = source("src/people/people-client.tsx");
    const detailSource = source("src/people/people-detail-sheet.tsx");
    const modelSource = source("src/people/people-model.ts");

    expect(existsSync(listHookPath)).toBe(false);
    expect(listSource).not.toContain("useTRPC");
    expect(listSource).not.toContain("org.workspace.people");
    expect(listSource).toContain("peopleListInfiniteQueryOptions");
    expect(listSource).toContain("useInfiniteQuery");
    expect(listSource).not.toContain("./use-people-list-query");
    expect(detailSource).not.toContain("useTRPC");
    expect(detailSource).not.toContain("org.workspace.people");
    expect(detailSource).toContain("personDetailQueryOptions");
    expect(modelSource).not.toContain("AppRouterOutputs");
  });
});
