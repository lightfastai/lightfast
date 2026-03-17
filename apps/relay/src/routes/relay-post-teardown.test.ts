/**
 * Suite 6.6 — Post-Teardown Webhook Routing Invariant
 *
 * After soft-delete (connection revoked), webhooks for the revoked connection
 * must route to DLQ, never to Console ingress.
 *
 * "soft-delete" = DB lookup returns no active connection (installation revoked)
 *
 * The workflow queries the DB directly. After soft-delete, the connection is
 * unresolvable → DLQ routing is mandatory.
 */

import type { WebhookReceiptPayload } from "@repo/console-providers";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Capture workflow handler from serve() ──
let capturedHandler: (context: unknown) => Promise<void>;

vi.mock("@vendor/upstash-workflow/hono", () => ({
  serve: (handler: (ctx: unknown) => Promise<void>) => {
    capturedHandler = handler;
    return () => new Response("ok");
  },
}));

// ── QStash mock ──
const mockPublishJSON = vi.fn().mockResolvedValue({ messageId: "msg-1" });
const mockPublishToTopic = vi.fn().mockResolvedValue([{ messageId: "dlq-1" }]);

vi.mock("@vendor/qstash", () => ({
  getQStashClient: () => ({
    publishJSON: mockPublishJSON,
    publishToTopic: mockPublishToTopic,
  }),
}));

// ── DB mock ──
const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined);
const mockDbWhere = vi.fn().mockResolvedValue(undefined);
let mockDbRows: { installationId: string; orgId: string }[] = [];

vi.mock("@db/console/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: () => mockDbRows,
          }),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({ onConflictDoNothing: mockOnConflictDoNothing }),
    }),
    update: () => ({
      set: () => ({ where: mockDbWhere }),
    }),
  },
}));

vi.mock("@db/console/schema", () => ({
  gatewayWebhookDeliveries: {},
  gatewayInstallations: {},
  gatewayResources: {},
}));

vi.mock("../lib/urls", () => ({
  relayBaseUrl: "https://relay.test/api",
  consoleUrl: "https://console.test",
}));

// Force module load to capture the workflow handler via serve()
await import("./workflows.js");

// ── Helpers ──

function makePayload(deliveryId: string): WebhookReceiptPayload {
  return {
    provider: "github",
    deliveryId,
    eventType: "push",
    resourceId: "res-teardown-001",
    payload: { repository: { id: 99 } },
    receivedAt: Date.now(),
  };
}

function makeContext(payload: WebhookReceiptPayload) {
  return {
    requestPayload: payload,
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
  };
}

// ── Tests ──

describe("Suite 6.6 — Post-teardown webhook routes to DLQ in all orderings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbRows = [];
    mockOnConflictDoNothing.mockResolvedValue(undefined);
    mockDbWhere.mockResolvedValue(undefined);
    mockPublishJSON.mockResolvedValue({ messageId: "msg-1" });
    mockPublishToTopic.mockResolvedValue([{ messageId: "dlq-1" }]);
  });

  it("after soft-delete, webhook for revoked connection goes to DLQ (not Console)", async () => {
    // Soft-delete: DB returns no active connection for this resource
    mockDbRows = [];

    const payload = makePayload("post-teardown-001");
    await capturedHandler(makeContext(payload));

    // Must route to DLQ (no-connection path), NOT to Console ingress
    expect(mockPublishToTopic).toHaveBeenCalledOnce();
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it("before teardown: active connection routes to Console ingress (baseline)", async () => {
    // Active connection in DB
    mockDbRows = [{ installationId: "inst-active", orgId: "org-active" }];

    const payload = makePayload("pre-teardown-baseline");
    await capturedHandler(makeContext(payload));

    expect(mockPublishJSON).toHaveBeenCalledOnce();
    expect(mockPublishToTopic).not.toHaveBeenCalled();
  });
});
