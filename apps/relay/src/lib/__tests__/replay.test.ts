import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GwWebhookDelivery } from "@db/console/schema";

// ── Mock externals ──
// vi.mock factories are hoisted to top of file, so use vi.hoisted for shared references

const {
  mockRedisDel,
  mockWorkflowTrigger,
  mockDbUpdate,
  mockDbSet,
  mockDbWhere,
  mockGetProvider,
  mockExtractResourceId,
} = vi.hoisted(() => {
  const mockExtractResourceId = vi.fn().mockReturnValue("res-123");
  return {
    mockRedisDel: vi.fn().mockResolvedValue(1),
    mockWorkflowTrigger: vi.fn().mockResolvedValue({ workflowRunId: "wf-1" }),
    mockDbUpdate: vi.fn(),
    mockDbSet: vi.fn(),
    mockDbWhere: vi.fn().mockResolvedValue(undefined),
    mockGetProvider: vi.fn().mockReturnValue({ extractResourceId: mockExtractResourceId }),
    mockExtractResourceId,
  };
});

vi.mock("@vendor/upstash", () => ({
  redis: { del: mockRedisDel },
}));

vi.mock("@vendor/upstash-workflow/client", () => ({
  getWorkflowClient: () => ({ trigger: mockWorkflowTrigger }),
}));

vi.mock("@db/console/client", () => ({
  db: {
    update: (...args: unknown[]) => {
      mockDbUpdate(...args);
      return { set: (...setArgs: unknown[]) => { mockDbSet(...setArgs); return { where: mockDbWhere }; } };
    },
  },
}));

vi.mock("@db/console/schema", () => ({
  gwWebhookDeliveries: {},
}));

vi.mock("../urls.js", () => ({
  relayBaseUrl: "https://relay.test/api",
}));

vi.mock("../../providers/index.js", () => ({
  getProvider: mockGetProvider,
}));

import { replayDeliveries } from "../replay.js";

// ── Helpers ──

function makeDelivery(overrides: Partial<GwWebhookDelivery> = {}): GwWebhookDelivery {
  return {
    id: "del-id-001",
    provider: "github",
    deliveryId: "delivery-001",
    eventType: "push",
    installationId: null,
    status: "dlq",
    payload: JSON.stringify({ repository: { id: 42 } }),
    receivedAt: "2026-03-02T00:00:00.000Z",
    ...overrides,
  };
}

// ── Tests ──

describe("replayDeliveries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisDel.mockResolvedValue(1);
    mockWorkflowTrigger.mockResolvedValue({ workflowRunId: "wf-1" });
    mockDbWhere.mockResolvedValue(undefined);
    mockExtractResourceId.mockReturnValue("res-123");
    mockGetProvider.mockReturnValue({ extractResourceId: mockExtractResourceId });
  });

  it("skips entries with null payload and adds to skipped list", async () => {
    const delivery = makeDelivery({ payload: null });
    const result = await replayDeliveries([delivery]);

    expect(result.skipped).toContain("delivery-001");
    expect(result.replayed).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
    expect(mockRedisDel).not.toHaveBeenCalled();
    expect(mockWorkflowTrigger).not.toHaveBeenCalled();
  });

  it("clears Redis dedup key before triggering workflow", async () => {
    const delivery = makeDelivery();
    await replayDeliveries([delivery]);

    expect(mockRedisDel).toHaveBeenCalledWith("gw:webhook:seen:github:delivery-001");
  });

  it("resets status to received after triggering workflow", async () => {
    const delivery = makeDelivery();
    await replayDeliveries([delivery]);

    expect(mockDbSet).toHaveBeenCalledWith({ status: "received" });
  });

  it("triggers workflow with correct payload shape", async () => {
    const delivery = makeDelivery({
      provider: "github",
      deliveryId: "del-trigger",
      eventType: "push",
      receivedAt: "2026-03-02T00:00:00.000Z",
    });
    await replayDeliveries([delivery]);

    expect(mockWorkflowTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://relay.test/api/workflows/webhook-delivery",
        body: expect.objectContaining({
          provider: "github",
          deliveryId: "del-trigger",
          eventType: "push",
        }),
      }),
    );
  });

  it("adds to replayed list on success", async () => {
    const delivery = makeDelivery();
    const result = await replayDeliveries([delivery]);

    expect(result.replayed).toContain("delivery-001");
    expect(result.skipped).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });

  it("adds to failed list when workflow trigger throws", async () => {
    mockWorkflowTrigger.mockRejectedValue(new Error("QStash unavailable"));
    const delivery = makeDelivery();
    const result = await replayDeliveries([delivery]);

    expect(result.failed).toContain("delivery-001");
    expect(result.replayed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it("handles mixed results across multiple deliveries", async () => {
    mockWorkflowTrigger
      .mockResolvedValueOnce({ workflowRunId: "wf-1" }) // first succeeds
      .mockRejectedValueOnce(new Error("rate limited")); // third fails

    const deliveries = [
      makeDelivery({ deliveryId: "del-001" }),
      makeDelivery({ deliveryId: "del-002", payload: null }),
      makeDelivery({ deliveryId: "del-003" }),
    ];
    const result = await replayDeliveries(deliveries);

    expect(result.replayed).toContain("del-001");
    expect(result.skipped).toContain("del-002");
    expect(result.failed).toContain("del-003");
  });

  it("handles provider extraction failure gracefully (uses null resourceId)", async () => {
    mockGetProvider.mockImplementationOnce(() => {
      throw new Error("unknown provider");
    });

    const delivery = makeDelivery();
    const result = await replayDeliveries([delivery]);

    // Should still replay with null resourceId
    expect(result.replayed).toContain("delivery-001");
    expect(mockWorkflowTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ resourceId: null }),
      }),
    );
  });
});
