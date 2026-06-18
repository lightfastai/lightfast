import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");

describe("automations TanStack adapter boundary", () => {
  it("exports automation server functions from @api/app", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(repoRoot, "api/app/package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };

    expect(packageJson.exports).toHaveProperty("./tanstack/automations");
  });

  it("defines automation server functions in the api/app adapter layer", () => {
    const source = readFileSync(
      resolve(repoRoot, "api/app/src/adapters/tanstack/automations.ts"),
      "utf8"
    );

    expect(source).toContain('from "@tanstack/react-start"');
    expect(source).toContain("createServerFn");
    expect(source).toContain("createAutomationCommand");
    expect(source).toContain("runAutomationNowCommand");
    expect(source).toContain("run.output === null || run.output === undefined");
    expect(source).not.toContain("output: run.output ?");
    expect(source).not.toContain("TRPCError");
    expect(source).not.toContain("ORPCError");
  });
});
