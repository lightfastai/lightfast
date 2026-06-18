import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(import.meta.dirname, "../..");
const repoRoot = resolve(packageRoot, "../..");

describe("legacy tRPC observability boundary", () => {
  it("does not keep a dead tRPC observability entrypoint or dependency", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(packageRoot, "package.json"), "utf8")
    ) as {
      dependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
    };

    expect(packageJson.exports).not.toHaveProperty("./request");
    expect(packageJson.exports).not.toHaveProperty("./trpc");
    expect(packageJson.dependencies?.["@trpc/server"]).toBeUndefined();
    expect(packageJson.dependencies?.["@vendor/lib"]).toBeUndefined();
    expect(existsSync(resolve(packageRoot, "src/request.ts"))).toBe(false);
    expect(existsSync(resolve(packageRoot, "src/trpc.ts"))).toBe(false);
  });

  it("does not keep stale tRPC labels in backend auth logging", () => {
    const authIdentitySource = readFileSync(
      resolve(repoRoot, "api/app/src/auth/identity.ts"),
      "utf8"
    );

    expect(authIdentitySource).not.toContain("[trpc]");
  });
});
