import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const apiRoot = resolve(repoRoot, "api/app");

describe("org identity TanStack adapter boundary", () => {
  it("exports org identity server functions from @api/app", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(apiRoot, "package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };

    expect(packageJson.exports).toHaveProperty("./tanstack/org-identity");
  });

  it("defines handwritten org identity server functions in the api/app adapter layer", () => {
    const source = readFileSync(
      resolve(apiRoot, "src/adapters/tanstack/org-identity.ts"),
      "utf8"
    );

    expect(source).toContain('from "@tanstack/react-start"');
    expect(source).toContain("createServerFn");
    expect(source).toContain("getOrgIdentityCommand");
    expect(source).not.toContain("TRPCError");
    expect(source).not.toContain("ORPCError");
    expect(source).not.toContain("defineCommandSurface");
    expect(source).not.toContain("dispatchCommand");
  });

  it("removes migrated org identity procedures from tRPC", () => {
    const rootSource = readFileSync(resolve(apiRoot, "src/root.ts"), "utf8");
    const routerPath = resolve(
      apiRoot,
      "src/router/(pending-not-allowed)/org-identity.ts"
    );

    expect(rootSource).not.toContain("orgIdentityRouter");
    expect(rootSource).not.toContain("identity:");

    if (existsSync(routerPath)) {
      const routerSource = readFileSync(routerPath, "utf8");
      expect(routerSource).not.toContain("orgIdentityRouter");
      expect(routerSource).not.toContain("boundOrgProcedure.query");
    }
  });
});
