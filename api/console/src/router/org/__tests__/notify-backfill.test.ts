import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────────
const { mockTrigger, mockFindFirst } = vi.hoisted(() => ({
  mockTrigger: vi.fn(),
  mockFindFirst: vi.fn(),
}));

vi.mock("@repo/memory-trpc/caller", () => ({
  createMemoryCaller: () =>
    Promise.resolve({
      backfill: { trigger: mockTrigger },
    }),
}));

vi.mock("@db/console/client", () => ({
  db: {
    query: {
      gatewayInstallations: { findFirst: mockFindFirst },
    },
  },
}));

vi.mock("@db/console/schema", () => ({
  orgWorkspaces: {},
  workspaceWorkflowRuns: {},
  workspaceIntegrations: {},
  gatewayInstallations: { id: "id", backfillConfig: "backfillConfig" },
  workspaceIngestLogs: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ a, b })),
  and: vi.fn(),
  desc: vi.fn(),
  count: vi.fn(),
  sql: vi.fn(),
  inArray: vi.fn(),
  sum: vi.fn(),
  avg: vi.fn(),
  gte: vi.fn(),
  like: vi.fn(),
}));

vi.mock("@db/console/utils", () => ({
  getWorkspaceKey: vi.fn(),
  createCustomWorkspace: vi.fn(),
}));

vi.mock("@vendor/clerk/server", () => ({
  clerkClient: vi.fn().mockResolvedValue({
    organizations: { getOrganization: vi.fn() },
    users: { getUser: vi.fn() },
  }),
}));

vi.mock("@repo/console-workspace-cache", () => ({
  invalidateWorkspaceConfig: vi.fn(),
}));

vi.mock("../../../trpc", () => ({
  orgScopedProcedure: {
    input: () => ({
      query: () => ({}),
      mutation: () => ({}),
    }),
  },
  resolveWorkspaceByName: vi.fn(),
}));

vi.mock("../../../lib/activity", () => ({
  recordActivity: vi.fn(),
}));

// ── Import after mocks ─────────────────────────────────────────────────────────
import { notifyBackfill } from "../workspace";

// ──────────────────────────────────────────────────────────────────────────────

describe("notifyBackfill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls memory.backfill.trigger with correct payload when depth and entityTypes provided", async () => {
    mockTrigger.mockResolvedValue({
      status: "accepted",
      installationId: "inst-1",
    });

    await notifyBackfill({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
      depth: 30,
      entityTypes: ["pull_request"],
    });

    expect(mockTrigger).toHaveBeenCalledWith({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
      depth: 30,
      entityTypes: ["pull_request"],
      holdForReplay: undefined,
      correlationId: undefined,
    });
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("loads depth and entityTypes from DB when omitted", async () => {
    mockTrigger.mockResolvedValue({
      status: "accepted",
      installationId: "inst-1",
    });
    mockFindFirst.mockResolvedValue({
      backfillConfig: { depth: 90, entityTypes: ["issue"] },
    });

    await notifyBackfill({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
    });

    expect(mockFindFirst).toHaveBeenCalled();
    expect(mockTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ depth: 90, entityTypes: ["issue"] })
    );
  });

  it("falls back to depth 1 when DB has no backfillConfig", async () => {
    mockTrigger.mockResolvedValue({
      status: "accepted",
      installationId: "inst-1",
    });
    mockFindFirst.mockResolvedValue(null);

    await notifyBackfill({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
    });

    expect(mockTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ depth: 1 })
    );
  });

  it("does not throw when trigger rejects", async () => {
    mockTrigger.mockRejectedValue(new Error("ECONNREFUSED"));
    mockFindFirst.mockResolvedValue(null);

    await expect(
      notifyBackfill({
        installationId: "inst-1",
        provider: "github",
        orgId: "org-1",
      })
    ).resolves.toBeUndefined();
  });

  it("forwards holdForReplay when provided", async () => {
    mockTrigger.mockResolvedValue({
      status: "accepted",
      installationId: "inst-1",
    });
    mockFindFirst.mockResolvedValue(null);

    await notifyBackfill({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
      holdForReplay: true,
    });

    expect(mockTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ holdForReplay: true })
    );
  });
});
