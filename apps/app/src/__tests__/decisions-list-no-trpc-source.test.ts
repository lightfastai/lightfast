import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("migrated decisions list data access", () => {
  it("uses TanStack server functions instead of tRPC", () => {
    const querySource = readFileSync(
      resolve(appRoot, "src/decisions/decisions-queries.ts"),
      "utf8"
    );
    const modelSource = readFileSync(
      resolve(appRoot, "src/decisions/decisions-model.ts"),
      "utf8"
    );

    expect(querySource).toContain('@api/app/tanstack/decisions"');
    expect(querySource).not.toContain("useTRPC");
    expect(querySource).not.toContain("trpc.org.workspace.decisions");
    expect(modelSource).toContain('@api/app/tanstack/decisions"');
    expect(modelSource).not.toContain("AppRouterOutputs");
  });
});
