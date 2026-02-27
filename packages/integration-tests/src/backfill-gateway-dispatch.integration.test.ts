/**
 * Suite 4: Backfill → Gateway Dispatch (Service Auth Webhook Path)
 *
 * Verifies that POST /webhooks/:provider with X-API-Key header correctly
 * bypasses HMAC verification and processes backfill-sourced events.
 *
 * Infrastructure: in-memory Redis (dedup), QStash capture mock.
 * No PGlite needed — the service auth path does not use the DB.
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from "vitest";

// ── Create all mock state in vi.hoisted ──
const {
  redisMock,
  redisStore,
  qstashMessages,
  qstashMock,
} = await vi.hoisted(async () => {
  const { makeRedisMock, makeQStashMock } = await import("./harness.js");
  const redisStore = new Map<string, unknown>();
  const messages: { url: string; body: unknown; headers?: Record<string, string> }[] = [];
  return {
    redisMock: makeRedisMock(redisStore),
    redisStore,
    qstashMessages: messages,
    qstashMock: makeQStashMock(messages),
  };
});

// ── vi.mock declarations ──

vi.mock("@vendor/upstash", () => ({
  redis: redisMock,
}));

vi.mock("@vendor/qstash", () => ({
  getQStashClient: () => qstashMock,
  Receiver: class { verify() { return Promise.resolve(true); } },
}));

vi.mock("@vendor/related-projects", () => ({
  withRelatedProject: ({ defaultHost }: { projectName: string; defaultHost: string }) =>
    defaultHost,
}));

vi.mock("@vercel/related-projects", () => ({
  withRelatedProject: ({ defaultHost }: { projectName: string; defaultHost: string }) =>
    defaultHost,
}));

vi.mock("@vendor/upstash-workflow/client", () => ({
  getWorkflowClient: () => ({
    trigger: vi.fn().mockResolvedValue({ workflowRunId: "wf-test" }),
  }),
}));

vi.mock("@vendor/upstash-workflow/hono", () => ({
  serve: vi.fn(() => () => new Response("ok")),
}));

// ── Import gateway app after mocks ──
import gatewayApp from "@gateway/app";

// ── Request helper ──
const API_KEY = "0".repeat(64);

function webhookReq(
  provider: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  return gatewayApp.request(`/api/webhooks/${provider}`, {
    method: "POST",
    headers: new Headers({
      "Content-Type": "application/json",
      ...headers,
    }),
    body: JSON.stringify(body),
  });
}

// Valid GitHub dispatch body (service auth path)
const VALID_GITHUB_BODY = {
  connectionId: "conn-dispatch-1",
  orgId: "org-dispatch-1",
  deliveryId: "del-dispatch-1",
  eventType: "push",
  payload: { repository: { id: 12345 }, ref: "refs/heads/main" },
  receivedAt: Date.now(),
};

// ── Lifecycle ──

beforeEach(() => {
  vi.clearAllMocks();
  qstashMessages.length = 0;
  redisStore.clear();

  redisMock.hset.mockImplementation((key: string, fields: Record<string, unknown>) => {
    const existing = (redisStore.get(key) as Record<string, unknown>) ?? {};
    redisStore.set(key, { ...existing, ...fields });
    return Promise.resolve(1);
  });
  redisMock.hgetall.mockImplementation((key: string) =>
    Promise.resolve((redisStore.get(key) as Record<string, string>) ?? null),
  );
  redisMock.set.mockImplementation((key: string, value: unknown, opts?: { nx?: boolean; ex?: number }) => {
    if (opts?.nx && redisStore.has(key)) return Promise.resolve(null);
    redisStore.set(key, value);
    return Promise.resolve("OK");
  });
  redisMock.del.mockImplementation((...keys: string[]) => {
    const allKeys = keys.flat();
    let count = 0;
    for (const k of allKeys) { if (redisStore.delete(k)) count++; }
    return Promise.resolve(count);
  });
  redisMock.get.mockImplementation((key: string) =>
    Promise.resolve(redisStore.get(key) ?? null),
  );
});

// ── Tests ──

describe("Suite 4.1 — Service auth path accepts and publishes webhook", () => {
  it("POST /webhooks/github with X-API-Key returns 200 accepted", async () => {
    const res = await webhookReq("github", VALID_GITHUB_BODY, {
      "X-API-Key": API_KEY,
    });

    expect(res.status).toBe(200);

    const json = await res.json() as { status: string; deliveryId: string };
    expect(json.status).toBe("accepted");
    expect(json.deliveryId).toBe("del-dispatch-1");
  });

  it("publishes WebhookEnvelope to QStash on valid dispatch", async () => {
    await webhookReq("github", VALID_GITHUB_BODY, { "X-API-Key": API_KEY });

    expect(qstashMock.publishJSON).toHaveBeenCalledOnce();

    const call = (qstashMock.publishJSON as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      url: string;
      body: {
        deliveryId: string;
        connectionId: string;
        orgId: string;
        provider: string;
        eventType: string;
        payload: unknown;
        receivedAt: number;
      };
    };

    // Verify the WebhookEnvelope shape matches @repo/gateway-types
    expect(call.body).toMatchObject({
      deliveryId: "del-dispatch-1",
      connectionId: "conn-dispatch-1",
      orgId: "org-dispatch-1",
      provider: "github",
      eventType: "push",
      receivedAt: expect.any(Number),
    });
    expect(call.body.payload).toBeDefined();
  });

  it("dispatch body shape validates all required fields", async () => {
    // Verify each required field is present in the QStash envelope
    await webhookReq("github", VALID_GITHUB_BODY, { "X-API-Key": API_KEY });

    const envelope = (qstashMock.publishJSON as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      body: Record<string, unknown>;
    };

    const requiredFields = ["deliveryId", "connectionId", "orgId", "provider", "eventType", "payload", "receivedAt"];
    for (const field of requiredFields) {
      expect(envelope.body).toHaveProperty(field);
    }
  });
});

describe("Suite 4.2 — Deduplication via webhookSeenKey", () => {
  it("first delivery with same deliveryId returns accepted", async () => {
    const res = await webhookReq("github", VALID_GITHUB_BODY, { "X-API-Key": API_KEY });
    expect(res.status).toBe(200);
    const json = await res.json() as { status: string };
    expect(json.status).toBe("accepted");
    expect(qstashMock.publishJSON).toHaveBeenCalledOnce();
  });

  it("duplicate deliveryId returns { status: 'duplicate' } without publishing twice", async () => {
    // First delivery
    await webhookReq("github", VALID_GITHUB_BODY, { "X-API-Key": API_KEY });

    // Second delivery with same deliveryId
    const res = await webhookReq(
      "github",
      { ...VALID_GITHUB_BODY, receivedAt: Date.now() },
      { "X-API-Key": API_KEY },
    );

    expect(res.status).toBe(200);
    const json = await res.json() as { status: string; deliveryId: string };
    expect(json.status).toBe("duplicate");
    expect(json.deliveryId).toBe("del-dispatch-1");

    // QStash should only have been called once (for the first delivery)
    expect(qstashMock.publishJSON).toHaveBeenCalledOnce();
  });

  it("different deliveryIds each get accepted", async () => {
    const first = await webhookReq(
      "github",
      { ...VALID_GITHUB_BODY, deliveryId: "del-unique-1" },
      { "X-API-Key": API_KEY },
    );
    const second = await webhookReq(
      "github",
      { ...VALID_GITHUB_BODY, deliveryId: "del-unique-2" },
      { "X-API-Key": API_KEY },
    );

    expect((await first.json() as { status: string }).status).toBe("accepted");
    expect((await second.json() as { status: string }).status).toBe("accepted");
    expect(qstashMock.publishJSON).toHaveBeenCalledTimes(2);
  });
});

describe("Suite 4.3 — Missing or invalid fields", () => {
  it("POST /webhooks/github without X-API-Key falls through to HMAC path (no secret match)", async () => {
    // Without X-API-Key, the standard HMAC path runs but signature check fails
    const res = await webhookReq("github", VALID_GITHUB_BODY);
    // HMAC verification fails → 401 or 500 (missing secret match)
    expect(res.status).not.toBe(200);
  });

  it("returns 400 when required fields are missing (connectionId)", async () => {
    const { connectionId: _removed, ...bodyWithoutConnectionId } = VALID_GITHUB_BODY;
    const res = await webhookReq("github", bodyWithoutConnectionId, { "X-API-Key": API_KEY });
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("missing_required_fields");
  });

  it("returns 400 when receivedAt is not a number", async () => {
    const res = await webhookReq(
      "github",
      { ...VALID_GITHUB_BODY, receivedAt: "not-a-number" },
      { "X-API-Key": API_KEY },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when payload fails provider schema validation", async () => {
    const res = await webhookReq(
      "github",
      { ...VALID_GITHUB_BODY, payload: "not-an-object" },
      { "X-API-Key": API_KEY },
    );
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("invalid_payload");
  });

  it("returns 400 for unknown provider", async () => {
    const res = await webhookReq("unknownprovider", VALID_GITHUB_BODY, { "X-API-Key": API_KEY });
    expect(res.status).toBe(400);
  });
});
