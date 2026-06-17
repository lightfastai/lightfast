import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(apiRoot, path), "utf8");
}

describe("native auth boundary exports", () => {
  it("exposes explicit native auth and TanStack adapter entrypoints", () => {
    const packageJson = JSON.parse(source("package.json")) as {
      exports: Record<string, { default: string; types: string }>;
    };

    expect(packageJson.exports["./native-auth"]).toEqual({
      default: "./src/native-auth/index.ts",
      types: "./src/native-auth/index.ts",
    });
    expect(packageJson.exports["./tanstack/native-auth"]).toEqual({
      default: "./src/adapters/tanstack/native-auth.ts",
      types: "./src/adapters/tanstack/native-auth.ts",
    });
    expect(existsSync(resolve(apiRoot, "src/native-auth/index.ts"))).toBe(true);
    expect(
      existsSync(resolve(apiRoot, "src/adapters/tanstack/native-auth.ts"))
    ).toBe(true);
  });

  it("preserves native auth statuses through TanStack server functions", () => {
    const adapterSource = source("src/adapters/tanstack/native-auth.ts");

    expect(adapterSource).toContain("setResponseStatus");
    expect(adapterSource).toContain("setResponseStatus(error.status)");
  });

  it("keeps the tRPC native router as a compatibility wrapper", () => {
    const routerSource = source("src/router/(pending-allowed)/native-auth.ts");

    expect(routerSource).toContain('from "../../native-auth"');
    expect(routerSource).not.toContain("buildClerkAuthorizeUrl");
    expect(routerSource).not.toContain("issueNativeAuthAttempt");
    expect(routerSource).not.toContain("consumeNativeAuthAttempt");
  });
});
