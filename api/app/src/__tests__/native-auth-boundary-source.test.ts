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

  it("keeps native auth off the tRPC router", () => {
    const rootSource = source("src/root.ts");

    expect(
      existsSync(
        resolve(apiRoot, "src/router/(pending-allowed)/native-auth.ts")
      )
    ).toBe(false);
    expect(rootSource).not.toContain("nativeAuthRouter");
    expect(rootSource).not.toContain("native:");
  });

  it("keeps native auth core free of request and auth-context adapters", () => {
    const nativeAuthSource = source("src/native-auth/index.ts");

    expect(nativeAuthSource).not.toContain("ResolvedAuthContext");
    expect(nativeAuthSource).not.toContain("headers: Headers");
    expect(nativeAuthSource).not.toContain("NATIVE_AUTH_HEADERS");
    expect(nativeAuthSource).not.toContain("resolveAuthContextFromClerk");
    expect(nativeAuthSource).not.toContain("ForAuthContext");
    expect(nativeAuthSource).not.toContain("ForRequest");
  });
});
