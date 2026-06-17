import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("migrated decision views data access", () => {
  it("uses TanStack server functions instead of tRPC", () => {
    const querySource = readFileSync(
      resolve(appRoot, "src/decisions/use-decision-views-query.ts"),
      "utf8"
    );
    const modelSource = readFileSync(
      resolve(appRoot, "src/decisions/decisions-views-model.ts"),
      "utf8"
    );

    expect(querySource).toContain('@api/app/tanstack/decision-views"');
    expect(querySource).not.toContain("useTRPC");
    expect(querySource).not.toContain("trpc.org.workspace.decisions.views");
    expect(modelSource).toContain('@api/app/tanstack/decision-views"');
    expect(modelSource).not.toContain("AppRouterOutputs");
  });
});
