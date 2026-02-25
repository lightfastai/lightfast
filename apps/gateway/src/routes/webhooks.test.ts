import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeHmacSha256, computeHmacSha1 } from "../lib/crypto";

// ── Mock externals (vi.hoisted runs before vi.mock hoisting) ──

const { mockPublishJSON, mockRedisSet, mockWorkflowTrigger } = vi.hoisted(
  () => ({
    mockPublishJSON: vi.fn().mockResolvedValue({ messageId: "msg-1" }),
    mockRedisSet: vi.fn().mockResolvedValue("OK"),
    mockWorkflowTrigger: vi
      .fn()
      .mockResolvedValue({ workflowRunId: "wf-1" }),
  }),
);

vi.mock("../env", () => ({
  env: {
    GATEWAY_API_KEY: "test-api-key",
    GATEWAY_WEBHOOK_SECRET: "test-webhook-secret",
    GITHUB_WEBHOOK_SECRET: "gh-secret",
    VERCEL_CLIENT_INTEGRATION_SECRET: "vc-secret",
    LINEAR_WEBHOOK_SIGNING_SECRET: "ln-secret",
    SENTRY_CLIENT_SECRET: "sn-secret",
  },
}));

vi.mock("@vendor/qstash", () => ({
  getQStashClient: () => ({ publishJSON: mockPublishJSON }),
}));

vi.mock("@vendor/upstash", () => ({
  redis: { set: mockRedisSet },
}));

vi.mock("@vendor/upstash-workflow/client", () => ({
  getWorkflowClient: () => ({ trigger: mockWorkflowTrigger }),
}));

// ── Import app after mocks ──

import { Hono } from "hono";
import { webhooks } from "./webhooks";

const app = new Hono();
app.route("/webhooks", webhooks);

function request(
  path: string,
  init: { body?: string | Record<string, unknown>; headers?: Record<string, string> },
) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const body =
    typeof init.body === "object" ? JSON.stringify(init.body) : init.body;
  return app.request(path, { method: "POST", headers, body });
}

// ── Tests ──

describe("POST /webhooks/:provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisSet.mockResolvedValue("OK");
    mockPublishJSON.mockResolvedValue({ messageId: "msg-1" });
    mockWorkflowTrigger.mockResolvedValue({ workflowRunId: "wf-1" });
  });

  describe("unknown provider", () => {
    it("returns 400 for unknown provider", async () => {
      const res = await request("/webhooks/unknown", { body: "{}" });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "unknown_provider",
        provider: "unknown",
      });
    });
  });

  describe("standard HMAC path", () => {
    it("accepts a valid GitHub webhook", async () => {
      const body = JSON.stringify({ repository: { id: 123 } });
      const sig = await computeHmacSha256(body, "gh-secret");

      const res = await request("/webhooks/github", {
        body,
        headers: {
          "x-hub-signature-256": `sha256=${sig}`,
          "x-github-delivery": "del-001",
          "x-github-event": "push",
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("accepted");
      expect(json.deliveryId).toBe("del-001");
      expect(mockWorkflowTrigger).toHaveBeenCalledOnce();
    });

    it("rejects invalid signature with 401", async () => {
      const res = await request("/webhooks/github", {
        body: '{"repository":{"id":123}}',
        headers: {
          "x-hub-signature-256": "sha256=invalid",
          "x-github-delivery": "del-002",
          "x-github-event": "push",
        },
      });

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "invalid_signature" });
      expect(mockWorkflowTrigger).not.toHaveBeenCalled();
    });

    it("rejects invalid payload with 400", async () => {
      const body = '"just a string"';
      const sig = await computeHmacSha256(body, "gh-secret");

      const res = await request("/webhooks/github", {
        body,
        headers: {
          "x-hub-signature-256": `sha256=${sig}`,
          "x-github-delivery": "del-003",
          "x-github-event": "push",
        },
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_payload" });
    });

    it("preserves full payload through to workflow trigger", async () => {
      // Real GitHub push payloads have 100+ fields — passthrough must preserve them all
      const fullPayload = {
        repository: { id: 123, full_name: "org/repo", private: true },
        installation: { id: 456 },
        sender: { login: "octocat", id: 1 },
        ref: "refs/heads/main",
        commits: [{ id: "abc123", message: "feat: 新しい機能 🎉" }],
        head_commit: { id: "abc123" },
      };
      const body = JSON.stringify(fullPayload);
      const sig = await computeHmacSha256(body, "gh-secret");

      const res = await request("/webhooks/github", {
        body,
        headers: {
          "x-hub-signature-256": `sha256=${sig}`,
          "x-github-delivery": "del-full",
          "x-github-event": "push",
        },
      });

      expect(res.status).toBe(200);

      // Verify the workflow receives the complete payload including extra fields
      const triggerCall = mockWorkflowTrigger.mock.calls[0]![0];
      const triggeredPayload = triggerCall.body.payload;
      expect(triggeredPayload.sender).toEqual({ login: "octocat", id: 1 });
      expect(triggeredPayload.ref).toBe("refs/heads/main");
      expect(triggeredPayload.commits[0].message).toBe("feat: 新しい機能 🎉");
    });

    it("handles unicode body with correct HMAC verification", async () => {
      const body = JSON.stringify({
        repository: { id: 1 },
        head_commit: { message: "fix: 修正 バグ 🐛" },
      });
      const sig = await computeHmacSha256(body, "gh-secret");

      const res = await request("/webhooks/github", {
        body,
        headers: {
          "x-hub-signature-256": `sha256=${sig}`,
          "x-github-delivery": "del-unicode",
          "x-github-event": "push",
        },
      });

      expect(res.status).toBe(200);
      expect(mockWorkflowTrigger).toHaveBeenCalledOnce();
    });
  });

  describe("wrong API key fallthrough", () => {
    it("wrong API key falls through to HMAC path, rejected without signature", async () => {
      // Misconfigured backfill sends wrong key. No HMAC headers → 401.
      // This is a real misconfiguration scenario.
      const res = await request("/webhooks/github", {
        body: '{"repository":{"id":123}}',
        headers: { "X-API-Key": "wrong-key" },
      });

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "invalid_signature" });
    });

    it("wrong API key with valid HMAC signature still succeeds via HMAC path", async () => {
      const body = '{"repository":{"id":123}}';
      const sig = await computeHmacSha256(body, "gh-secret");

      const res = await request("/webhooks/github", {
        body,
        headers: {
          "X-API-Key": "wrong-key",
          "x-hub-signature-256": `sha256=${sig}`,
          "x-github-delivery": "del-fallthrough",
          "x-github-event": "push",
        },
      });

      expect(res.status).toBe(200);
      // Goes through workflow path (HMAC), not direct QStash publish (service auth)
      expect(mockWorkflowTrigger).toHaveBeenCalledOnce();
      expect(mockPublishJSON).not.toHaveBeenCalled();
    });
  });

  describe("external service failures", () => {
    it("returns 500 when Redis throws during service auth dedup", async () => {
      mockRedisSet.mockRejectedValue(new Error("Redis connection refused"));

      const res = await request("/webhooks/github", {
        body: {
          connectionId: "conn-1",
          orgId: "org-1",
          deliveryId: "del-redis-fail",
          eventType: "push",
          payload: { repository: { id: 42 } },
          receivedAt: 1700000000,
        },
        headers: { "X-API-Key": "test-api-key" },
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when QStash throws during service auth publish", async () => {
      mockPublishJSON.mockRejectedValue(new Error("QStash rate limited"));

      const res = await request("/webhooks/github", {
        body: {
          connectionId: "conn-1",
          orgId: "org-1",
          deliveryId: "del-qstash-fail",
          eventType: "push",
          payload: { repository: { id: 42 } },
          receivedAt: 1700000000,
        },
        headers: { "X-API-Key": "test-api-key" },
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when workflow trigger fails on HMAC path", async () => {
      mockWorkflowTrigger.mockRejectedValue(new Error("QStash unavailable"));
      const body = JSON.stringify({ repository: { id: 123 } });
      const sig = await computeHmacSha256(body, "gh-secret");

      const res = await request("/webhooks/github", {
        body,
        headers: {
          "x-hub-signature-256": `sha256=${sig}`,
          "x-github-delivery": "del-wf-fail",
          "x-github-event": "push",
        },
      });

      expect(res.status).toBe(500);
    });
  });

  describe("service auth path (X-API-Key)", () => {
    it("accepts valid service auth request and publishes correct WebhookEnvelope", async () => {
      const res = await request("/webhooks/github", {
        body: {
          connectionId: "conn-1",
          orgId: "org-1",
          deliveryId: "del-100",
          eventType: "push",
          payload: { repository: { id: 42 } },
          receivedAt: 1700000000,
        },
        headers: { "X-API-Key": "test-api-key" },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("accepted");
      expect(json.deliveryId).toBe("del-100");
      expect(mockWorkflowTrigger).not.toHaveBeenCalled();

      // Verify the exact WebhookEnvelope shape published to Console
      expect(mockPublishJSON).toHaveBeenCalledWith({
        url: expect.stringContaining("/api/webhooks/ingress"),
        body: {
          deliveryId: "del-100",
          connectionId: "conn-1",
          orgId: "org-1",
          provider: "github",
          eventType: "push",
          payload: { repository: { id: 42 } },
          receivedAt: 1700000000,
        },
        retries: 5,
      });
    });

    it("rejects when required fields missing", async () => {
      const res = await request("/webhooks/github", {
        body: { connectionId: "conn-1" },
        headers: { "X-API-Key": "test-api-key" },
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "missing_required_fields" });
    });

    it("rejects when payload fails provider parse", async () => {
      const res = await request("/webhooks/github", {
        body: {
          connectionId: "conn-1",
          orgId: "org-1",
          deliveryId: "del-101",
          eventType: "push",
          payload: "not-an-object",
          receivedAt: 1700000000,
        },
        headers: { "X-API-Key": "test-api-key" },
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_payload" });
    });

    it("returns duplicate when Redis dedup rejects", async () => {
      mockRedisSet.mockResolvedValue(null);

      const res = await request("/webhooks/github", {
        body: {
          connectionId: "conn-1",
          orgId: "org-1",
          deliveryId: "del-dup",
          eventType: "push",
          payload: { repository: { id: 42 } },
          receivedAt: 1700000000,
        },
        headers: { "X-API-Key": "test-api-key" },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("duplicate");
      expect(mockPublishJSON).not.toHaveBeenCalled();
    });

    it("returns 500 when body is malformed JSON", async () => {
      // Backfill sends truncated body (network error, client bug).
      // c.req.json() throws — no try/catch → unhandled 500.
      const res = await request("/webhooks/github", {
        body: '{"connectionId": "conn-1", "orgId": "org-',
        headers: { "X-API-Key": "test-api-key" },
      });

      expect(res.status).toBe(500);
    });
  });

  describe("per-provider secret mapping", () => {
    it("Vercel webhook uses correct secret and SHA1 algorithm through full route", async () => {
      // This verifies the secret lookup object on line 100-105 maps
      // "vercel" → VERCEL_CLIENT_INTEGRATION_SECRET, not some other secret.
      // Also verifies Vercel's SHA1 (not SHA256) works end-to-end.
      const body = JSON.stringify({
        id: "evt-vc-1",
        type: "deployment.created",
        payload: { project: { id: "prj_1" } },
      });
      const sig = await computeHmacSha1(body, "vc-secret");

      const res = await request("/webhooks/vercel", {
        body,
        headers: {
          "x-vercel-signature": sig,
          "x-vercel-id": "del-vc-001",
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("accepted");
      expect(json.deliveryId).toBe("del-vc-001");
      expect(mockWorkflowTrigger).toHaveBeenCalledOnce();
    });

    it("Vercel webhook with wrong secret is rejected", async () => {
      // If the mapping used github's secret for vercel, this would fail differently
      const body = JSON.stringify({ type: "deployment.created" });
      const sig = await computeHmacSha1(body, "wrong-secret");

      const res = await request("/webhooks/vercel", {
        body,
        headers: { "x-vercel-signature": sig },
      });

      expect(res.status).toBe(401);
    });

    it("Linear webhook uses correct secret through full route", async () => {
      const body = JSON.stringify({
        type: "Issue",
        action: "create",
        organizationId: "lin-org-1",
      });
      const sig = await computeHmacSha256(body, "ln-secret");

      const res = await request("/webhooks/linear", {
        body,
        headers: {
          "linear-signature": sig,
          "linear-delivery": "del-ln-001",
        },
      });

      expect(res.status).toBe(200);
      expect(mockWorkflowTrigger).toHaveBeenCalledOnce();
    });

    it("Sentry webhook uses correct secret through full route", async () => {
      const body = JSON.stringify({ installation: { uuid: "sn-inst-1" } });
      const sig = await computeHmacSha256(body, "sn-secret");

      const res = await request("/webhooks/sentry", {
        body,
        headers: {
          "sentry-hook-signature": sig,
          "sentry-hook-resource": "issue",
          "sentry-hook-timestamp": "1700000000",
        },
      });

      expect(res.status).toBe(200);
      expect(mockWorkflowTrigger).toHaveBeenCalledOnce();
    });
  });

  describe("HMAC path → workflow payload contract", () => {
    it("builds complete WebhookReceiptPayload with all fields", async () => {
      const body = JSON.stringify({
        repository: { id: 789 },
        installation: { id: 101 },
      });
      const sig = await computeHmacSha256(body, "gh-secret");

      await request("/webhooks/github", {
        body,
        headers: {
          "x-hub-signature-256": `sha256=${sig}`,
          "x-github-delivery": "del-contract",
          "x-github-event": "push",
        },
      });

      const triggerCall = mockWorkflowTrigger.mock.calls[0]![0];
      expect(triggerCall.body).toEqual({
        provider: "github",
        deliveryId: "del-contract",
        eventType: "push",
        resourceId: "789",
        payload: expect.objectContaining({ repository: { id: 789 } }),
        receivedAt: expect.any(Number),
      });
    });

    it("passes resourceId as null when payload has no identifiable resource", async () => {
      // GitHub webhook with no repository or installation (e.g. org-level event)
      const body = JSON.stringify({ action: "member_added" });
      const sig = await computeHmacSha256(body, "gh-secret");

      await request("/webhooks/github", {
        body,
        headers: {
          "x-hub-signature-256": `sha256=${sig}`,
          "x-github-delivery": "del-no-resource",
          "x-github-event": "organization",
        },
      });

      const triggerCall = mockWorkflowTrigger.mock.calls[0]![0];
      expect(triggerCall.body.resourceId).toBeNull();
      expect(triggerCall.body.eventType).toBe("organization");
    });

    it("Vercel route produces correct workflow payload shape", async () => {
      const body = JSON.stringify({
        id: "evt-shape",
        type: "deployment.ready",
        payload: { project: { id: "prj_shape" }, team: { id: "team_shape" } },
      });
      const sig = await computeHmacSha1(body, "vc-secret");

      await request("/webhooks/vercel", {
        body,
        headers: {
          "x-vercel-signature": sig,
          "x-vercel-id": "del-vc-shape",
        },
      });

      const triggerCall = mockWorkflowTrigger.mock.calls[0]![0];
      expect(triggerCall.body).toEqual({
        provider: "vercel",
        deliveryId: "del-vc-shape",
        eventType: "deployment.ready",
        resourceId: "prj_shape",
        payload: expect.objectContaining({
          type: "deployment.ready",
          payload: expect.objectContaining({ project: { id: "prj_shape" } }),
        }),
        receivedAt: expect.any(Number),
      });
    });
  });
});
