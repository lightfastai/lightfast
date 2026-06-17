import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const apiRoot = resolve(repoRoot, "api/app/src");

describe("decisions TanStack migration", () => {
  it("exports decision list server functions from @api/app", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(repoRoot, "api/app/package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };

    expect(packageJson.exports).toHaveProperty("./tanstack/decisions");
  });

  it("does not expose decision list over tRPC", () => {
    const rootSource = readFileSync(resolve(apiRoot, "root.ts"), "utf8");

    expect(rootSource).not.toContain("decisionsRouter");
    expect(rootSource).not.toContain("decisions:");
    expect(
      existsSync(resolve(apiRoot, "router/(pending-not-allowed)/decisions.ts"))
    ).toBe(false);
  });

  it("defines decision list server functions in the api/app adapter layer", () => {
    const adapterSource = readFileSync(
      resolve(apiRoot, "adapters/tanstack/decisions.ts"),
      "utf8"
    );

    expect(adapterSource).toContain('from "@tanstack/react-start"');
    expect(adapterSource).toContain("createServerFn");
    expect(adapterSource).toContain("listDecisions");
    expect(adapterSource).not.toContain("TRPCError");
  });
});
