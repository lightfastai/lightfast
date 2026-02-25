import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { githubBackfillConnector } from "./github";
import type { BackfillConfig } from "../types";

function makeConfig(overrides?: Partial<BackfillConfig>): BackfillConfig {
  return {
    installationId: "inst-1",
    provider: "github" as BackfillConfig["provider"],
    since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    accessToken: "ghs_test_token",
    resource: { providerResourceId: "123", resourceName: "owner/repo" },
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

function makePR(number: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    number,
    state: "open",
    user: { login: "alice" },
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeIssue(number: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    number,
    state: "open",
    user: { login: "alice" },
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeRelease(id: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    author: { login: "alice" },
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("provider metadata", () => {
  it('provider is "github"', () => {
    expect(githubBackfillConnector.provider).toBe("github");
  });

  it("supportedEntityTypes contains pull_request, issue, release", () => {
    expect(githubBackfillConnector.supportedEntityTypes).toContain("pull_request");
    expect(githubBackfillConnector.supportedEntityTypes).toContain("issue");
    expect(githubBackfillConnector.supportedEntityTypes).toContain("release");
  });

  it("defaultEntityTypes equals supportedEntityTypes", () => {
    expect(githubBackfillConnector.defaultEntityTypes).toEqual(githubBackfillConnector.supportedEntityTypes);
  });
});

describe("validateScopes", () => {
  it("resolves without throwing", async () => {
    await expect(githubBackfillConnector.validateScopes(makeConfig())).resolves.toBeUndefined();
  });
});

describe("fetchPage — pull_request", () => {
  it("returns events for PRs within since range", async () => {
    const prs = [makePR(1), makePR(2), makePR(3)];
    mockFetch.mockResolvedValueOnce(mockResponse(prs));

    const result = await githubBackfillConnector.fetchPage(makeConfig(), "pull_request", null);
    expect(result.events).toHaveLength(3);
  });

  it("each event has correct deliveryId format", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse([makePR(42)]));

    const result = await githubBackfillConnector.fetchPage(makeConfig(), "pull_request", null);
    expect(result.events[0]!.deliveryId).toBe("backfill-inst-1-123-pr-42");
  });

  it('each event has eventType: "pull_request"', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse([makePR(1)]));

    const result = await githubBackfillConnector.fetchPage(makeConfig(), "pull_request", null);
    expect(result.events[0]!.eventType).toBe("pull_request");
  });

  it("uses correct URL with query params", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse([]));

    await githubBackfillConnector.fetchPage(makeConfig(), "pull_request", null);
    const url = new URL(mockFetch.mock.calls[0]![0] as string);
    expect(url.pathname).toBe("/repos/owner/repo/pulls");
    expect(url.searchParams.get("state")).toBe("all");
    expect(url.searchParams.get("sort")).toBe("updated");
    expect(url.searchParams.get("direction")).toBe("desc");
    expect(url.searchParams.get("per_page")).toBe("100");
    expect(url.searchParams.get("page")).toBe("1");
  });

  it("sends correct auth header", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse([]));

    await githubBackfillConnector.fetchPage(makeConfig(), "pull_request", null);
    const headers = (mockFetch.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ghs_test_token");
  });

  it("excludes items with updated_at older than since", async () => {
    const config = makeConfig({ since: "2026-01-15T00:00:00.000Z" });
    const prs = [
      makePR(1, { updated_at: "2026-01-20T00:00:00.000Z" }),
      makePR(2, { updated_at: "2026-01-10T00:00:00.000Z" }), // before since
    ];
    mockFetch.mockResolvedValueOnce(mockResponse(prs));

    const result = await githubBackfillConnector.fetchPage(config, "pull_request", null);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.deliveryId).toContain("pr-1");
  });

  it("100 items all passing filter → nextCursor: { page: 2 }", async () => {
    const prs = Array.from({ length: 100 }, (_, i) => makePR(i + 1));
    mockFetch.mockResolvedValueOnce(mockResponse(prs));

    const result = await githubBackfillConnector.fetchPage(makeConfig(), "pull_request", null);
    expect(result.nextCursor).toEqual({ page: 2 });
  });

  it("fewer than 100 items → nextCursor: null", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse([makePR(1)]));

    const result = await githubBackfillConnector.fetchPage(makeConfig(), "pull_request", null);
    expect(result.nextCursor).toBeNull();
  });

  it("100 items but some filtered by since → nextCursor: null", async () => {
    const config = makeConfig({ since: "2026-01-15T00:00:00.000Z" });
    const prs = Array.from({ length: 100 }, (_, i) =>
      makePR(i + 1, {
        updated_at: i < 50 ? "2026-01-20T00:00:00.000Z" : "2026-01-10T00:00:00.000Z",
      }),
    );
    mockFetch.mockResolvedValueOnce(mockResponse(prs));

    const result = await githubBackfillConnector.fetchPage(config, "pull_request", null);
    expect(result.nextCursor).toBeNull();
  });

  it("rate limit headers present → rateLimit populated", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse([makePR(1)], {
        "x-ratelimit-remaining": "4999",
        "x-ratelimit-reset": "1700000000",
        "x-ratelimit-limit": "5000",
      }),
    );

    const result = await githubBackfillConnector.fetchPage(makeConfig(), "pull_request", null);
    expect(result.rateLimit).toBeDefined();
    expect(result.rateLimit!.remaining).toBe(4999);
  });

  it("API returns non-OK → throws Error", async () => {
    mockFetch.mockResolvedValueOnce(new Response("", { status: 403 }));

    await expect(
      githubBackfillConnector.fetchPage(makeConfig(), "pull_request", null),
    ).rejects.toThrow("GitHub API returned 403");
  });

  it("null cursor → page 1; { page: 3 } cursor → page 3", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse([]));
    await githubBackfillConnector.fetchPage(makeConfig(), "pull_request", null);
    expect(new URL(mockFetch.mock.calls[0]![0] as string).searchParams.get("page")).toBe("1");

    mockFetch.mockResolvedValueOnce(mockResponse([]));
    await githubBackfillConnector.fetchPage(makeConfig(), "pull_request", { page: 3 });
    expect(new URL(mockFetch.mock.calls[1]![0] as string).searchParams.get("page")).toBe("3");
  });
});

describe("fetchPage — issue", () => {
  it("since included as query parameter (server-side filter)", async () => {
    const config = makeConfig({ since: "2026-01-15T00:00:00.000Z" });
    mockFetch.mockResolvedValueOnce(mockResponse([]));

    await githubBackfillConnector.fetchPage(config, "issue", null);
    const url = new URL(mockFetch.mock.calls[0]![0] as string);
    expect(url.searchParams.get("since")).toBe("2026-01-15T00:00:00.000Z");
  });

  it("items with pull_request key are excluded from results", async () => {
    const items = [
      makeIssue(1),
      makeIssue(2, { pull_request: { url: "..." } }), // This is a PR, should be excluded
      makeIssue(3),
    ];
    mockFetch.mockResolvedValueOnce(mockResponse(items));

    const result = await githubBackfillConnector.fetchPage(makeConfig(), "issue", null);
    expect(result.events).toHaveLength(2);
  });

  it("pure issues (no pull_request key) are included", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse([makeIssue(5)]));

    const result = await githubBackfillConnector.fetchPage(makeConfig(), "issue", null);
    expect(result.events).toHaveLength(1);
  });

  it("deliveryId format: backfill-{installationId}-{providerResourceId}-issue-{number}", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse([makeIssue(77)]));

    const result = await githubBackfillConnector.fetchPage(makeConfig(), "issue", null);
    expect(result.events[0]!.deliveryId).toBe("backfill-inst-1-123-issue-77");
  });

  it('eventType: "issues" (not "issue")', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse([makeIssue(1)]));

    const result = await githubBackfillConnector.fetchPage(makeConfig(), "issue", null);
    expect(result.events[0]!.eventType).toBe("issues");
  });

  it("100 items → nextCursor: { page: 2 }", async () => {
    const items = Array.from({ length: 100 }, (_, i) => makeIssue(i + 1));
    mockFetch.mockResolvedValueOnce(mockResponse(items));

    const result = await githubBackfillConnector.fetchPage(makeConfig(), "issue", null);
    expect(result.nextCursor).toEqual({ page: 2 });
  });

  it("fewer than 100 items → nextCursor: null", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse([makeIssue(1)]));

    const result = await githubBackfillConnector.fetchPage(makeConfig(), "issue", null);
    expect(result.nextCursor).toBeNull();
  });
});

describe("fetchPage — release", () => {
  it("client-side filter on published_at >= since", async () => {
    const config = makeConfig({ since: "2026-01-15T00:00:00.000Z" });
    const releases = [
      makeRelease(1, { published_at: "2026-01-20T00:00:00.000Z" }),
      makeRelease(2, { published_at: "2026-01-10T00:00:00.000Z" }), // before since
    ];
    mockFetch.mockResolvedValueOnce(mockResponse(releases));

    const result = await githubBackfillConnector.fetchPage(config, "release", null);
    expect(result.events).toHaveLength(1);
  });

  it("release with only created_at (no published_at) → uses created_at for filter", async () => {
    const config = makeConfig({ since: "2026-01-15T00:00:00.000Z" });
    const releases = [
      makeRelease(1, { published_at: null, created_at: "2026-01-20T00:00:00.000Z" }),
    ];
    mockFetch.mockResolvedValueOnce(mockResponse(releases));

    const result = await githubBackfillConnector.fetchPage(config, "release", null);
    expect(result.events).toHaveLength(1);
  });

  it("deliveryId format: backfill-{installationId}-{providerResourceId}-release-{id}", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse([makeRelease(999)]));

    const result = await githubBackfillConnector.fetchPage(makeConfig(), "release", null);
    expect(result.events[0]!.deliveryId).toBe("backfill-inst-1-123-release-999");
  });

  it('eventType: "release"', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse([makeRelease(1)]));

    const result = await githubBackfillConnector.fetchPage(makeConfig(), "release", null);
    expect(result.events[0]!.eventType).toBe("release");
  });

  it("same pagination termination logic as PRs", async () => {
    const releases = Array.from({ length: 100 }, (_, i) => makeRelease(i + 1));
    mockFetch.mockResolvedValueOnce(mockResponse(releases));

    const result = await githubBackfillConnector.fetchPage(makeConfig(), "release", null);
    expect(result.nextCursor).toEqual({ page: 2 });
  });
});

describe("fetchPage — unsupported entity type", () => {
  it("throws Error for unsupported entity type", async () => {
    await expect(
      githubBackfillConnector.fetchPage(makeConfig(), "unknown", null),
    ).rejects.toThrow("Unsupported entity type: unknown");
  });
});

describe("resourceName parsing", () => {
  it("null resourceName → throws", async () => {
    const config = makeConfig({
      resource: { providerResourceId: "123", resourceName: null },
    });
    await expect(
      githubBackfillConnector.fetchPage(config, "pull_request", null),
    ).rejects.toThrow("No resource found");
  });

  it("malformed resourceName (no slash) → throws", async () => {
    const config = makeConfig({
      resource: { providerResourceId: "123", resourceName: "invalid" },
    });
    await expect(
      githubBackfillConnector.fetchPage(config, "pull_request", null),
    ).rejects.toThrow("Invalid resourceName");
  });
});
