import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const appRoot = resolve(repoRoot, "apps/app");

function appSource(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

function repoSource(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("public API route boundaries", () => {
  it("mounts public signal routes as thin app-owned route files", () => {
    const createPath = resolve(appRoot, "src/routes/api/v1/signals.ts");
    const getPath = resolve(appRoot, "src/routes/api/v1/signals/$id.ts");

    expect(existsSync(createPath)).toBe(true);
    expect(existsSync(getPath)).toBe(true);

    const createRoute = appSource("src/routes/api/v1/signals.ts");
    const getRoute = appSource("src/routes/api/v1/signals/$id.ts");

    expect(createRoute).toContain('createFileRoute("/api/v1/signals")');
    expect(createRoute).toContain('@api/app/public-api/signals"');
    expect(createRoute).toContain("handleListSignalsPublicApiRequest");
    expect(createRoute).toContain("handleCreateSignalPublicApiRequest");
    expect(createRoute).toContain("handlePublicApiOptionsRequest");
    expect(getRoute).toContain('createFileRoute("/api/v1/signals/$id")');
    expect(getRoute).toContain('@api/app/public-api/signals"');
    expect(getRoute).toContain("handleGetSignalPublicApiRequest");
    expect(getRoute).toContain("params.id");

    for (const source of [createRoute, getRoute]) {
      expect(source).not.toContain("OpenAPIHandler");
      expect(source).not.toContain("orpcRouter");
      expect(source).not.toContain("@db/app");
      expect(source).not.toContain("resolveApiKeyAuth");
    }
  });

  it("mounts public system health as a thin app-owned route file", () => {
    const healthPath = resolve(appRoot, "src/routes/api/v1/system/health.ts");

    expect(existsSync(healthPath)).toBe(true);

    const healthRoute = appSource("src/routes/api/v1/system/health.ts");

    expect(healthRoute).toContain('createFileRoute("/api/v1/system/health")');
    expect(healthRoute).toContain('@api/app/public-api/system"');
    expect(healthRoute).toContain("handleSystemHealthPublicApiRequest");
    expect(healthRoute).toContain("handlePublicApiOptionsRequest");
    expect(healthRoute).not.toContain("OpenAPIHandler");
    expect(healthRoute).not.toContain("orpcRouter");
    expect(healthRoute).not.toContain("@db/app");
    expect(healthRoute).not.toContain("resolveApiKeyAuth");
  });

  it("keeps public signal behavior in an explicit api/app adapter", () => {
    const packageJson = JSON.parse(repoSource("api/app/package.json")) as {
      exports?: Record<string, unknown>;
    };
    const adapter = repoSource("api/app/src/adapters/public/signals.ts");

    expect(packageJson.exports).toHaveProperty("./public-api/signals");
    expect(adapter).toContain("resolveApiKeyAuth");
    expect(adapter).toContain('from "../../auth/actors"');
    expect(adapter).toContain("actorFromApiKeyAuth");
    expect(adapter).toContain("createSignalCommand");
    expect(adapter).toContain("getSignalCommand");
    expect(adapter).toContain("createSignalInput");
    expect(adapter).toContain("getVisibleSignalByPublicId");
    expect(adapter).toContain("listSignalEntityLinksForSignal");
    expect(adapter).toContain("getSignalOutput.parse");
    expect(adapter).not.toContain("createSignalForActor");
    expect(adapter).not.toContain("ORPCError");
    expect(adapter).not.toContain("@orpc/");
    expect(adapter).not.toContain("OpenAPIHandler");
    expect(adapter).not.toContain("actorFromApiKeyAuth, isDomainError");
  });

  it("keeps public system health behavior in an explicit api/app adapter", () => {
    const packageJson = JSON.parse(repoSource("api/app/package.json")) as {
      exports?: Record<string, unknown>;
    };
    const adapter = repoSource("api/app/src/adapters/public/system.ts");

    expect(packageJson.exports).toHaveProperty("./public-api/system");
    expect(adapter).toContain("resolveApiKeyAuth");
    expect(adapter).toContain("systemHealthOutput.parse");
    expect(adapter).not.toContain("ORPCError");
    expect(adapter).not.toContain("@orpc/");
    expect(adapter).not.toContain("OpenAPIHandler");
  });

  it("removes the oRPC catch-all after explicit public routes cover the contract", () => {
    const packageJson = JSON.parse(repoSource("apps/app/package.json")) as {
      dependencies?: Record<string, string>;
    };
    const routeTree = appSource("src/routeTree.gen.ts");

    expect(existsSync(resolve(appRoot, "src/routes/api/v1/$.ts"))).toBe(false);
    expect(packageJson.dependencies?.["@orpc/openapi"]).toBeUndefined();
    expect(routeTree).not.toContain("/api/v1/$");
    expect(routeTree).not.toContain("ApiV1SplatRoute");
  });
});
