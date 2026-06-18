import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");
const repoRoot = resolve(appRoot, "../..");

function appSource(path: string): string {
  return readFileSync(resolve(appRoot, path), "utf8");
}

function repoSource(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("app health route", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("keeps the file route wrapper browser-safe", () => {
    const routeSource = appSource("src/routes/api/health.ts");
    const serverPath = resolve(appRoot, "src/server/health.ts");
    const apiPackageJson = JSON.parse(repoSource("api/app/package.json")) as {
      exports: Record<string, { default: string; types: string }>;
    };

    expect(routeSource).not.toContain('from "~/env"');
    expect(routeSource).toContain('@api/app/internal-api/health"');
    expect(routeSource).toContain("handleAppHealthRequest");
    expect(routeSource).not.toContain('import("~/server/health")');
    expect(existsSync(serverPath)).toBe(false);
    expect(apiPackageJson.exports["./internal-api/health"]).toEqual({
      default: "./src/adapters/internal/health.ts",
      types: "./src/adapters/internal/health.ts",
    });
  });

  it("returns an unauthenticated health payload when no token is configured", async () => {
    vi.stubEnv("HEALTH_CHECK_AUTH_TOKEN", "");
    const { handleAppHealthRequest } = await import(
      "@api/app/internal-api/health"
    );

    const response = handleAppHealthRequest(
      new Request("https://app.test/api/health")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "no-store, no-cache, must-revalidate"
    );
    await expect(response.json()).resolves.toMatchObject({
      environment: "test",
      service: "app",
      status: "ok",
    });
  });

  it("rejects missing bearer auth when the token is configured", async () => {
    vi.stubEnv(
      "HEALTH_CHECK_AUTH_TOKEN",
      "test-health-token-test-health-token"
    );
    const { handleAppHealthRequest } = await import(
      "@api/app/internal-api/health"
    );

    const response = handleAppHealthRequest(
      new Request("https://app.test/api/health")
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Authorization required",
    });
  });

  it("rejects invalid bearer auth when the token is configured", async () => {
    vi.stubEnv(
      "HEALTH_CHECK_AUTH_TOKEN",
      "test-health-token-test-health-token"
    );
    const { handleAppHealthRequest } = await import(
      "@api/app/internal-api/health"
    );

    const response = handleAppHealthRequest(
      new Request("https://app.test/api/health", {
        headers: { authorization: "Bearer wrong-token" },
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("accepts valid bearer auth when the token is configured", async () => {
    vi.stubEnv(
      "HEALTH_CHECK_AUTH_TOKEN",
      "test-health-token-test-health-token"
    );
    const { handleAppHealthRequest } = await import(
      "@api/app/internal-api/health"
    );

    const response = handleAppHealthRequest(
      new Request("https://app.test/api/health", {
        headers: {
          authorization: "Bearer test-health-token-test-health-token",
        },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      service: "app",
      status: "ok",
    });
  });
});
