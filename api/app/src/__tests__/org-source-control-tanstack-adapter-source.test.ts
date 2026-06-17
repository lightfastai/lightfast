import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");

describe("source-control TanStack adapter boundary", () => {
  it("exports source-control server functions from @api/app", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(repoRoot, "api/app/package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };

    expect(packageJson.exports).toHaveProperty("./tanstack/source-control");
  });

  it("defines source-control server functions in the adapter layer", () => {
    const source = readFileSync(
      resolve(repoRoot, "api/app/src/adapters/tanstack/source-control.ts"),
      "utf8"
    );

    expect(source).toContain('from "@tanstack/react-start"');
    expect(source).toContain("createServerFn");
    expect(source).toContain("getSourceControlConnectionCommand");
    expect(source).toContain("listSourceControlRepositoriesCommand");
    expect(source).toContain("importSourceControlRepositoryCommand");
    expect(source).not.toContain("TRPCError");
    expect(source).not.toContain("ORPCError");
  });
});
