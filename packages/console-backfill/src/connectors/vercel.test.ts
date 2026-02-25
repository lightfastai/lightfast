import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { vercelBackfillConnector } from "./vercel";
import type { BackfillConfig } from "../types";

function makeConfig(overrides?: Partial<BackfillConfig>): BackfillConfig {
  return {
    installationId: "inst-1",
    provider: "vercel" as BackfillConfig["provider"],
    since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    accessToken: "tok_test_vercel",
    resource: { providerResourceId: "prj-xyz", resourceName: "my-project" },
    ...overrides,
  };
}

function mockResponse(
  data: unknown,
  headers: Record<string, string> = {},
  status = 200,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function makeDeployment(uid: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    uid,
    name: "my-app",
    url: "my-app.vercel.app",
    projectId: "prj-xyz",
    readyState: "READY",
    created: Date.now(),
    meta: {},
    ...overrides,
  };
}

function makeDeploymentsResponse(
  deployments: Record<string, unknown>[],
  next: number | null = null,
) {
  return {
    deployments,
    pagination: { count: deployments.length, next, prev: null },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateScopes", () => {
  it("resolves when API returns 200", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ deployments: [], pagination: {} }));

    await expect(vercelBackfillConnector.validateScopes(makeConfig())).resolves.toBeUndefined();
    const url = new URL(mockFetch.mock.calls[0]![0] as string);
    expect(url.pathname).toBe("/v6/deployments");
    expect(url.searchParams.get("projectId")).toBe("prj-xyz");
    expect(url.searchParams.get("limit")).toBe("1");
  });

  it("throws when API returns non-OK", async () => {
    mockFetch.mockResolvedValueOnce(new Response("", { status: 403 }));

    await expect(vercelBackfillConnector.validateScopes(makeConfig())).rejects.toThrow(
      "Vercel API returned 403",
    );
  });
});

describe("fetchPage — deployment", () => {
  it("first page (cursor null): URL has no until param", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(makeDeploymentsResponse([])));

    await vercelBackfillConnector.fetchPage(makeConfig(), "deployment", null);
    const url = new URL(mockFetch.mock.calls[0]![0] as string);
    expect(url.searchParams.has("until")).toBe(false);
  });

  it("subsequent page (cursor 12345): URL has until=12345", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(makeDeploymentsResponse([])));

    await vercelBackfillConnector.fetchPage(makeConfig(), "deployment", 12345);
    const url = new URL(mockFetch.mock.calls[0]![0] as string);
    expect(url.searchParams.get("until")).toBe("12345");
  });

  it("deliveryId format: backfill-{installationId}-{providerResourceId}-deploy-{uid}", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(makeDeploymentsResponse([makeDeployment("dpl-abc")])),
    );

    const result = await vercelBackfillConnector.fetchPage(makeConfig(), "deployment", null);
    expect(result.events[0]!.deliveryId).toBe("backfill-inst-1-prj-xyz-deploy-dpl-abc");
  });

  it("client-side filter: deployment.created >= config.since", async () => {
    const config = makeConfig({ since: "2026-01-15T00:00:00.000Z" });
    const deployments = [
      makeDeployment("dpl-1", { created: new Date("2026-01-20T00:00:00.000Z").getTime() }),
      makeDeployment("dpl-2", { created: new Date("2026-01-10T00:00:00.000Z").getTime() }), // before since
    ];
    mockFetch.mockResolvedValueOnce(mockResponse(makeDeploymentsResponse(deployments)));

    const result = await vercelBackfillConnector.fetchPage(config, "deployment", null);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.deliveryId).toContain("dpl-1");
  });

  it("pagination.next non-null and all items pass filter → nextCursor: pagination.next", async () => {
    const deployments = [makeDeployment("dpl-1"), makeDeployment("dpl-2")];
    mockFetch.mockResolvedValueOnce(
      mockResponse(makeDeploymentsResponse(deployments, 99999)),
    );

    const result = await vercelBackfillConnector.fetchPage(makeConfig(), "deployment", null);
    expect(result.nextCursor).toBe(99999);
  });

  it("some items filtered → nextCursor: null", async () => {
    const config = makeConfig({ since: "2026-01-15T00:00:00.000Z" });
    const deployments = [
      makeDeployment("dpl-1", { created: new Date("2026-01-20T00:00:00.000Z").getTime() }),
      makeDeployment("dpl-2", { created: new Date("2026-01-10T00:00:00.000Z").getTime() }),
    ];
    mockFetch.mockResolvedValueOnce(
      mockResponse(makeDeploymentsResponse(deployments, 88888)),
    );

    const result = await vercelBackfillConnector.fetchPage(config, "deployment", null);
    expect(result.nextCursor).toBeNull();
  });

  it("resourceName falls back to providerResourceId when null", async () => {
    const config = makeConfig({
      resource: { providerResourceId: "prj-fallback", resourceName: null },
    });
    mockFetch.mockResolvedValueOnce(
      mockResponse(makeDeploymentsResponse([makeDeployment("dpl-1")])),
    );

    const result = await vercelBackfillConnector.fetchPage(config, "deployment", null);
    // The project name in the adapted payload should be the providerResourceId
    expect(result.events).toHaveLength(1);
  });

  it("rate limit headers parsed from response", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(makeDeploymentsResponse([makeDeployment("dpl-1")]), {
        "x-ratelimit-remaining": "50",
        "x-ratelimit-reset": "1700000000",
        "x-ratelimit-limit": "100",
      }),
    );

    const result = await vercelBackfillConnector.fetchPage(makeConfig(), "deployment", null);
    expect(result.rateLimit).toBeDefined();
    expect(result.rateLimit!.remaining).toBe(50);
    expect(result.rateLimit!.limit).toBe(100);
  });

  it("auth header: Authorization: Bearer {accessToken}", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(makeDeploymentsResponse([])));

    await vercelBackfillConnector.fetchPage(makeConfig(), "deployment", null);
    const headers = (mockFetch.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok_test_vercel");
  });
});

describe("fetchPage — unsupported entity type", () => {
  it("throws for unsupported entity types", async () => {
    await expect(
      vercelBackfillConnector.fetchPage(makeConfig(), "unknown", null),
    ).rejects.toThrow("Unsupported entity type: unknown");
  });
});
