import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("migrated decisions list data access", () => {
  it("uses TanStack server functions instead of tRPC", () => {
    const queryPath = resolve(appRoot, "src/decisions/decisions-queries.ts");
    const clientSource = readFileSync(
      resolve(appRoot, "src/decisions/decisions-client.tsx"),
      "utf8"
    );
    const modelSource = readFileSync(
      resolve(appRoot, "src/decisions/decisions-model.ts"),
      "utf8"
    );

    expect(existsSync(queryPath)).toBe(false);
    expect(clientSource).toContain('@api/app/tanstack/decisions"');
    expect(clientSource).toContain("listDecisions");
    expect(clientSource).not.toContain("useTRPC");
    expect(clientSource).not.toContain("trpc.org.workspace.decisions");
    expect(modelSource).toContain('@api/app/tanstack/decisions"');
    expect(modelSource).not.toContain("AppRouterOutputs");
  });
});
