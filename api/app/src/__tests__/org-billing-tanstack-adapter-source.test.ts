import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const apiRoot = resolve(repoRoot, "api/app");

describe("org billing TanStack adapter boundary", () => {
  it("exports org billing server functions from @api/app", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(apiRoot, "package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };

    expect(packageJson.exports).toHaveProperty("./tanstack/org-billing");
  });

  it("defines handwritten org billing server functions in the api/app adapter layer", () => {
    const source = readFileSync(
      resolve(apiRoot, "src/adapters/tanstack/org-billing.ts"),
      "utf8"
    );

    expect(source).toContain('from "@tanstack/react-start"');
    expect(source).toContain("createServerFn");
    expect(source).toContain("getOrgBillingOverviewCommand");
    expect(source).toContain("cancelOrgBillingSubscriptionItemCommand");
    expect(source).toContain('mappedError.name = "DomainError"');
    expect(source).not.toContain("TRPCError");
    expect(source).not.toContain("ORPCError");
    expect(source).not.toContain("defineCommandSurface");
    expect(source).not.toContain("dispatchCommand");
  });

  it("removes migrated org billing procedures from tRPC", () => {
    const rootPath = resolve(apiRoot, "src/root.ts");
    const routerPath = resolve(
      apiRoot,
      "src/router/(pending-not-allowed)/org-billing.ts"
    );

    expect(existsSync(rootPath)).toBe(false);

    if (existsSync(routerPath)) {
      const routerSource = readFileSync(routerPath, "utf8");
      expect(routerSource).not.toContain("orgBillingRouter");
      expect(routerSource).not.toContain("orgAdminProcedure");
      expect(routerSource).not.toContain("orgProcedure");
    }
  });
});
