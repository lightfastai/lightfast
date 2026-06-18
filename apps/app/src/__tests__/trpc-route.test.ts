import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");
const repoRoot = resolve(appRoot, "../..");

describe("app tRPC route", () => {
  it("removes the app tRPC catch-all route after UI migration", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(appRoot, "package.json"), "utf8")
    ) as { dependencies?: Record<string, string> };
    const routeTreeSource = readFileSync(
      resolve(appRoot, "src/routeTree.gen.ts"),
      "utf8"
    );
    const corsSource = readFileSync(resolve(appRoot, "src/cors.ts"), "utf8");
    const workspaceSource = readFileSync(
      resolve(repoRoot, "pnpm-workspace.yaml"),
      "utf8"
    );

    expect(existsSync(resolve(appRoot, "src/routes/api/trpc.$.ts"))).toBe(
      false
    );
    expect(existsSync(resolve(appRoot, "src/trpc/context.ts"))).toBe(false);
    expect(packageJson.dependencies?.["@trpc/client"]).toBeUndefined();
    expect(packageJson.dependencies?.["@trpc/server"]).toBeUndefined();
    expect(
      packageJson.dependencies?.["@trpc/tanstack-react-query"]
    ).toBeUndefined();
    expect(routeTreeSource).not.toContain("/api/trpc");
    expect(routeTreeSource).not.toContain("ApiTrpcSplatRoute");
    expect(corsSource).not.toContain("x-trpc-source");
    expect(corsSource).not.toContain("trpc-accept");
    expect(workspaceSource).not.toContain("@trpc/");
  });
});
