import path from "node:path";
import { getPortlessProxyOrigins } from "@lightfastai/dev-proxy/next";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../../../../..");

describe("getPortlessProxyOrigins (Lightfast fixtures)", () => {
  it("emits the expected dev origin set with default options", () => {
    const origins = getPortlessProxyOrigins({ cwd: repoRoot });
    // NOTE: platform.lightfast.localhost is intentionally ABSENT here.
    // microfrontends.json (Lightfast) only registers lightfast-app and lightfast-www.
    // apps/platform is a sibling deployment, not a member of the MFE mesh, and
    // its dev URL comes through portless directly (not via this allowlist) —
    // the platform CORS handler imports getPortlessProxyOrigins() to build its
    // own allowlist from the same source-of-truth, so the platform origin doesn't
    // need to be here for platform tRPC to admit calls from app.lightfast.localhost.
    expect(origins).toMatchInlineSnapshot(`
      [
        "lightfast.localhost",
        "*.lightfast.localhost",
        "app.lightfast.localhost",
        "*.app.lightfast.localhost",
        "www.lightfast.localhost",
        "*.www.lightfast.localhost",
      ]
    `);
  });

  it("emits port-suffixed variants when includePort is 'both'", () => {
    const origins = getPortlessProxyOrigins({
      cwd: repoRoot,
      includePort: "both",
    });
    expect(origins).toContain("app.lightfast.localhost");
    expect(origins).toContain("app.lightfast.localhost:443");
    expect(origins).toContain("*.app.lightfast.localhost");
    expect(origins).toContain("*.app.lightfast.localhost:443");
  });

  it("returns an empty list when allowMissingConfig is true and no config is present", () => {
    const origins = getPortlessProxyOrigins({
      cwd: "/tmp",
      allowMissingConfig: true,
    });
    expect(origins).toEqual([]);
  });
});
