import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──

const {
  mockWorkflowTrigger,
  mockDbUpdate,
  mockGetProvider,
  mockExtractResourceId,
} = vi.hoisted(() => {
  const mockExtractResourceId = vi.fn().mockReturnValue("owner/repo");

  return {
    mockWorkflowTrigger: vi.fn().mockResolvedValue({ workflowRunId: "wf-1" }),
    mockDbUpdate: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    })),
    mockGetProvider: vi.fn().mockReturnValue({
      webhook: { extractResourceId: mockExtractResourceId },
    }),
    mockExtractResourceId,
  };
});

vi.mock("@vendor/upstash-workflow/client", () => ({
  workflowClient: { trigger: mockWorkflowTrigger },
}));

vi.mock("@db/console/client", () => ({
  db: { update: mockDbUpdate },
}));

vi.mock("@db/console/schema", () => ({
  gatewayWebhookDeliveries: {
    provider: "provider",
    deliveryId: "deliveryId",
    status: "status",
  },
}));

vi.mock("@vendor/db", () => ({
  and: (...args: unknown[]) => ({ _and: args }),
  eq: (a: unknown, b: unknown) => ({ _eq: [a, b] }),
}));

vi.mock("@repo/console-providers", () => ({
  getProvider: (...args: unknown[]) => mockGetProvider(...args),
}));

vi.mock("./urls", () => ({
  relayBaseUrl: "https://relay.test",
}));

// ── Import under test (after mocks) ──

import { replayDeliveries } from "./replay.js";

// ── Helpers ──

function makeDelivery(
  overrides: Partial<{
    id: string;
    provider: string;
    deliveryId: string;
    installationId: string;
    eventType: string;
    status: string;
    failReason: string | null;
    payload: string | null;
    receivedAt: string;
  }> = {}
) {
  return {
    id: "d1",
    provider: "github",
    deliveryId: "del-1",
    installationId: "inst-1",
    eventType: "push",
    status: "dlq",
    failReason: null,
    payload: JSON.stringify({ action: "opened" }),
    receivedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ── Tests ──

beforeEach(() => {
  vi.clearAllMocks();
  mockWorkflowTrigger.mockResolvedValue({ workflowRunId: "wf-1" });
  mockExtractResourceId.mockReturnValue("owner/repo");
  mockGetProvider.mockReturnValue({
    webhook: { extractResourceId: mockExtractResourceId },
  });
  mockDbUpdate.mockImplementation(() => ({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  }));
});

describe("replayDeliveries", () => {
  describe("skipping", () => {
    it("skips entries where payload is null", async () => {
      const delivery = makeDelivery({ payload: null });
      const result = await replayDeliveries([delivery]);

      expect(result.skipped).toEqual(["del-1"]);
      expect(result.replayed).toEqual([]);
      expect(result.failed).toEqual([]);
      expect(mockWorkflowTrigger).not.toHaveBeenCalled();
    });
  });

  describe("success path", () => {
    it("triggers workflow and resets status to 'received'", async () => {
      const delivery = makeDelivery();
      const result = await replayDeliveries([delivery]);

      expect(result.replayed).toEqual(["del-1"]);
      expect(result.skipped).toEqual([]);
      expect(result.failed).toEqual([]);

      expect(mockWorkflowTrigger).toHaveBeenCalledOnce();
      expect(mockDbUpdate).toHaveBeenCalledOnce();
    });

    it("re-extracts resourceId from stored payload via provider", async () => {
      mockExtractResourceId.mockReturnValueOnce("my-org/my-repo");
      const delivery = makeDelivery();
      await replayDeliveries([delivery]);

      const body = JSON.parse(
        (mockWorkflowTrigger.mock.calls[0] as { body: string }[])[0]
          ?.body as string
      );
      expect(body.resourceId).toBe("my-org/my-repo");
      expect(mockGetProvider).toHaveBeenCalledWith("github");
    });

    it("uses null resourceId when provider not found", async () => {
      mockGetProvider.mockReturnValueOnce(null);
      const delivery = makeDelivery();
      await replayDeliveries([delivery]);

      const body = JSON.parse(
        (mockWorkflowTrigger.mock.calls[0] as { body: string }[])[0]
          ?.body as string
      );
      expect(body.resourceId).toBeNull();
    });

    it("uses null resourceId when extractResourceId throws", async () => {
      mockExtractResourceId.mockImplementationOnce(() => {
        throw new Error("parse error");
      });
      const delivery = makeDelivery();
      const result = await replayDeliveries([delivery]);

      expect(result.replayed).toEqual(["del-1"]);
      const body = JSON.parse(
        (mockWorkflowTrigger.mock.calls[0] as { body: string }[])[0]
          ?.body as string
      );
      expect(body.resourceId).toBeNull();
    });
  });

  describe("workflow trigger payload", () => {
    it("trigger body contains all WebhookReceiptPayload fields", async () => {
      const delivery = makeDelivery({
        provider: "github",
        deliveryId: "del-42",
        eventType: "pull_request",
        receivedAt: "2026-03-01T12:00:00.000Z",
      });
      await replayDeliveries([delivery]);

      const call = mockWorkflowTrigger.mock.calls[0]?.[0] as {
        url: string;
        body: string;
      };
      expect(call.url).toContain("/workflows/webhook-delivery");

      const body = JSON.parse(call.body) as Record<string, unknown>;
      expect(body).toHaveProperty("provider", "github");
      expect(body).toHaveProperty("deliveryId", "del-42");
      expect(body).toHaveProperty("eventType", "pull_request");
      expect(body).toHaveProperty("resourceId");
      expect(body).toHaveProperty("payload");
      expect(body).toHaveProperty("receivedAt");
    });

    it("receivedAt is epoch milliseconds (number) in trigger payload", async () => {
      const delivery = makeDelivery({
        receivedAt: "2026-03-01T12:00:00.000Z",
      });
      await replayDeliveries([delivery]);

      const body = JSON.parse(
        (mockWorkflowTrigger.mock.calls[0]?.[0] as { body: string }).body
      ) as { receivedAt: unknown };

      expect(typeof body.receivedAt).toBe("number");
      expect(body.receivedAt).toBe(
        new Date("2026-03-01T12:00:00.000Z").getTime()
      );
    });
  });

  describe("failure paths", () => {
    it("marks delivery as failed when workflowClient.trigger throws", async () => {
      mockWorkflowTrigger.mockRejectedValueOnce(
        new Error("workflow unavailable")
      );
      const delivery = makeDelivery();
      const result = await replayDeliveries([delivery]);

      expect(result.failed).toEqual(["del-1"]);
      expect(result.replayed).toEqual([]);
    });

    it("continues to next delivery when one trigger fails (partial batch)", async () => {
      mockWorkflowTrigger
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValueOnce({ workflowRunId: "wf-2" });

      const deliveries = [
        makeDelivery({ id: "d1", deliveryId: "del-1" }),
        makeDelivery({ id: "d2", deliveryId: "del-2" }),
      ];
      const result = await replayDeliveries(deliveries);

      expect(result.failed).toEqual(["del-1"]);
      expect(result.replayed).toEqual(["del-2"]);
    });

    it("still marks as replayed when DB status update fails after trigger succeeds", async () => {
      mockDbUpdate.mockImplementationOnce(() => ({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error("DB error")),
        }),
      }));

      const delivery = makeDelivery();
      const result = await replayDeliveries([delivery]);

      // Trigger succeeded → replayed (DB failure is non-fatal, best-effort)
      expect(result.replayed).toEqual(["del-1"]);
      expect(result.failed).toEqual([]);
    });
  });

  describe("mixed batch", () => {
    it("returns correct replayed/skipped/failed for mixed batch", async () => {
      mockWorkflowTrigger
        .mockResolvedValueOnce({ workflowRunId: "wf-ok" })
        .mockRejectedValueOnce(new Error("boom"));

      const deliveries = [
        makeDelivery({ id: "d1", deliveryId: "ok" }),
        makeDelivery({ id: "d2", deliveryId: "no-payload", payload: null }),
        makeDelivery({ id: "d3", deliveryId: "fail" }),
      ];
      const result = await replayDeliveries(deliveries);

      expect(result.replayed).toEqual(["ok"]);
      expect(result.skipped).toEqual(["no-payload"]);
      expect(result.failed).toEqual(["fail"]);
    });
  });
});
