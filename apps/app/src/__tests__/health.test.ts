import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("app health route", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("keeps the file route wrapper browser-safe", () => {
    const routeSource = readFileSync(
      resolve(appRoot, "src/routes/api/health.ts"),
      "utf8"
    );

    expect(routeSource).not.toContain('from "~/env"');
    expect(routeSource).toContain('import("~/server/health")');
  });

  it("returns an unauthenticated health payload when no token is configured", async () => {
    vi.stubEnv("HEALTH_CHECK_AUTH_TOKEN", "");
    const { getHealth } = await import("../server/health");

    const response = getHealth(new Request("https://app.test/api/health"));

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
    const { getHealth } = await import("../server/health");

    const response = getHealth(new Request("https://app.test/api/health"));

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
    const { getHealth } = await import("../server/health");

    const response = getHealth(
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
    const { getHealth } = await import("../server/health");

    const response = getHealth(
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
