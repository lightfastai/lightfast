import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const apiRoot = resolve(repoRoot, "api/app");

describe("organizations TanStack adapter boundary", () => {
  it("exports organization server functions from @api/app", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(apiRoot, "package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };

    expect(packageJson.exports).toHaveProperty("./tanstack/organizations");
  });

  it("defines handwritten organization server functions in the api/app adapter layer", () => {
    const source = readFileSync(
      resolve(apiRoot, "src/adapters/tanstack/organizations.ts"),
      "utf8"
    );

    expect(source).toContain('from "@tanstack/react-start"');
    expect(source).toContain("createServerFn");
    expect(source).toContain("listUserOrganizationsCommand");
    expect(source).toContain("listOrganizationDomainsCommand");
    expect(source).toContain("createOrganizationCommand");
    expect(source).toContain("updateOrganizationDomainsCommand");
    expect(source).toContain("updateOrganizationNameCommand");
    expect(source).not.toContain("TRPCError");
    expect(source).not.toContain("ORPCError");
    expect(source).not.toContain("defineCommandSurface");
    expect(source).not.toContain("dispatchCommand");
  });

  it("removes migrated organization procedures from tRPC", () => {
    const rootSource = readFileSync(resolve(apiRoot, "src/root.ts"), "utf8");
    const routerPath = resolve(
      apiRoot,
      "src/router/(pending-allowed)/organization.ts"
    );

    expect(rootSource).not.toContain("orgSettingsOrganizationRouter");
    expect(rootSource).not.toContain("organization:");

    if (existsSync(routerPath)) {
      const routerSource = readFileSync(routerPath, "utf8");
      expect(routerSource).not.toContain("listUserOrganizations");
      expect(routerSource).not.toContain("getBySlug");
      expect(routerSource).not.toContain("create: viewerProcedure");
      expect(routerSource).not.toContain("updateName");
      expect(routerSource).not.toContain("listDomains");
      expect(routerSource).not.toContain("updateDomains");
    }
  });
});
