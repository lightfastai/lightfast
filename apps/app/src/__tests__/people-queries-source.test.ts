import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("people app data access", () => {
  it("uses local people query keys, not query-option wrappers", () => {
    expect(existsSync(resolve(appRoot, "src/people/people-queries.ts"))).toBe(
      false
    );
    expect(existsSync(resolve(appRoot, "src/people/people-cache.ts"))).toBe(
      false
    );
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
    expect(listSource).toContain('@api/app/tanstack/people"');
    expect(listSource).toContain("listPeople");
    expect(listSource).toContain("type ListPeopleInput");
    expect(listSource).toContain("type ListPeopleResult");
    expect(listSource).toContain('["people", "list", listInput] as const');
    expect(listSource).not.toContain("peopleListInfiniteQueryOptions");
    expect(listSource).not.toContain("peopleQueryKeys");
    expect(listSource).toContain("useInfiniteQuery");
    expect(listSource).not.toContain("./use-people-list-query");
    expect(detailSource).not.toContain("useTRPC");
    expect(detailSource).not.toContain("org.workspace.people");
    expect(detailSource).toContain('@api/app/tanstack/people"');
    expect(detailSource).toContain("getPerson");
    expect(detailSource).toContain("type GetPersonInput");
    expect(detailSource).toContain(
      '["people", "detail", publicId ?? ""] as const'
    );
    expect(detailSource).not.toContain("personDetailQueryOptions");
    expect(detailSource).not.toContain("peopleQueryKeys");
    expect(modelSource).toContain('@api/app/tanstack/people"');
    expect(modelSource).toContain("export type PeopleList");
    expect(modelSource).toContain("export type PersonRow");
    expect(modelSource).not.toContain("AppRouterOutputs");
  });
});
