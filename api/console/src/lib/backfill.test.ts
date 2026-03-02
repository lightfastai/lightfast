import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Hoisted mocks ──
const { mockEnv } = vi.hoisted(() => ({
  mockEnv: { GATEWAY_API_KEY: "test-gw-key" },
}));

vi.mock("../env", () => ({ env: mockEnv }));

vi.mock("@vendor/related-projects", () => ({
  withRelatedProject: ({
    defaultHost,
  }: {
    projectName: string;
    defaultHost: string;
  }) => defaultHost,
}));

// ── Import after mocks ──
import { notifyBackfill } from "./backfill.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("notifyBackfill", () => {
  it("sends POST to relay /api/backfill with correct headers and body", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await notifyBackfill({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/backfill") as string,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-API-Key": "test-gw-key",
        }) as Record<string, string>,
        body: JSON.stringify({
          installationId: "inst-1",
          provider: "github",
          orgId: "org-1",
        }),
      }) as RequestInit,
    );
  });

  it("does not throw when fetch returns non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(
      notifyBackfill({
        installationId: "inst-1",
        provider: "github",
        orgId: "org-1",
      }),
    ).resolves.toBeUndefined();
  });

  it("does not throw when fetch rejects (network error)", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      notifyBackfill({
        installationId: "inst-1",
        provider: "github",
        orgId: "org-1",
      }),
    ).resolves.toBeUndefined();
  });
});
