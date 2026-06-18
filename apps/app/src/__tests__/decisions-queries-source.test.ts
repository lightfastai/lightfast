import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("decisions app data access", () => {
  it("uses local TanStack query helpers backed by api/app server functions", () => {
    const querySource = source("src/decisions/decisions-queries.ts");

    expect(querySource).toContain('@api/app/tanstack/decisions"');
    expect(querySource).toContain("decisionsQueryKeys");
    expect(querySource).toContain("decisionsListInfiniteQueryOptions");
    expect(querySource).not.toContain("useTRPC");
  });

  it("inlines the single-use decisions list hook into the client", () => {
    const listHookPath = resolve(
      appRoot,
      "src/decisions/use-decisions-list-query.ts"
    );
    const clientSource = source("src/decisions/decisions-client.tsx");

    expect(existsSync(listHookPath)).toBe(false);
    expect(clientSource).toContain("useInfiniteQuery");
    expect(clientSource).toContain("decisionsListInfiniteQueryOptions");
    expect(clientSource).not.toContain("useDecisionsListQuery");
    expect(clientSource).not.toContain("./use-decisions-list-query");
  });
});
