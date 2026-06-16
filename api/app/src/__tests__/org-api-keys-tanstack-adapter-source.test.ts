import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const apiRoot = resolve(repoRoot, "api/app");

describe("org API keys TanStack adapter boundary", () => {
  it("exports org API key server functions from @api/app", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(apiRoot, "package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };

    expect(packageJson.exports).toHaveProperty("./tanstack/org-api-keys");
  });

  it("defines org API key server functions in the api/app adapter layer", () => {
    const source = readFileSync(
      resolve(apiRoot, "src/adapters/tanstack/org-api-keys.ts"),
      "utf8"
    );

    expect(source).toContain('from "@tanstack/react-start"');
    expect(source).toContain("createServerFn");
    expect(source).toContain("listOrgApiKeysCommand");
    expect(source).toContain("rotateOrgApiKeyCommand");
    expect(source).not.toContain("TRPCError");
    expect(source).not.toContain("ORPCError");
  });

  it("removes migrated org API key management from the tRPC router", () => {
    const rootSource = readFileSync(resolve(apiRoot, "src/root.ts"), "utf8");
    const routerPath = resolve(
      apiRoot,
      "src/router/(pending-not-allowed)/org-api-keys.ts"
    );

    expect(rootSource).not.toContain("orgApiKeysRouter");
    expect(rootSource).not.toContain("orgApiKeys:");

    if (existsSync(routerPath)) {
      const routerSource = readFileSync(routerPath, "utf8");
      expect(routerSource).not.toContain("getUnkeyClient");
      expect(routerSource).not.toContain("orgAdminProcedure");
      expect(routerSource).not.toContain("createOrgApiKeySchema");
    }
  });
});
