import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

function source(path: string) {
  return readFileSync(resolve(apiRoot, path), "utf8");
}

describe("api/app app-facing tRPC root", () => {
  it("removes the final product tRPC router surface", () => {
    const indexSource = source("index.ts");
    const rootPath = resolve(apiRoot, "root.ts");
    const taskRouterPath = resolve(
      apiRoot,
      "router/(pending-not-allowed)/task.ts"
    );

    expect(existsSync(taskRouterPath)).toBe(false);
    expect(indexSource).toContain('export * from "./mcp-oauth"');
    expect(indexSource).not.toContain("@trpc/server");
    expect(indexSource).not.toContain("AppRouter");
    expect(indexSource).not.toContain("appRouter");
    expect(indexSource).not.toContain("createTRPCContext");
    expect(indexSource).not.toContain("createCallerFactory");

    if (existsSync(rootPath)) {
      const rootSource = source("root.ts");
      expect(rootSource).not.toContain("taskRouter");
      expect(rootSource).not.toContain("createTRPCRouter");
      expect(rootSource).not.toContain("appRouter");
    }
  });
});
