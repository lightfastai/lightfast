import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("decisions app data access", () => {
  it("inlines the single-use decisions query options into the client", () => {
    const queryPath = resolve(appRoot, "src/decisions/decisions-queries.ts");
    const clientSource = source("src/decisions/decisions-client.tsx");

    expect(existsSync(queryPath)).toBe(false);
    expect(clientSource).toContain('@api/app/tanstack/decisions"');
    expect(clientSource).toContain("listDecisions");
    expect(clientSource).toContain("type ListDecisionsInput");
    expect(clientSource).toContain("type ListDecisionsResult");
    expect(clientSource).toContain("useInfiniteQuery");
    expect(clientSource).not.toContain("decisionsListInfiniteQueryOptions");
    expect(clientSource).not.toContain("./decisions-queries");
    expect(clientSource).not.toContain("useTRPC");
  });

  it("inlines the single-use decisions list hook into the client", () => {
    const listHookPath = resolve(
      appRoot,
      "src/decisions/use-decisions-list-query.ts"
    );
    const clientSource = source("src/decisions/decisions-client.tsx");

    expect(existsSync(listHookPath)).toBe(false);
    expect(clientSource).toContain("useInfiniteQuery");
    expect(clientSource).toContain("queryKey: decisionsListQueryKey");
    expect(clientSource).not.toContain("useDecisionsListQuery");
    expect(clientSource).not.toContain("./use-decisions-list-query");
  });
});
