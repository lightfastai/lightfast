/**
 * Fixture-based smoke tests for the GitHub webhook route.
 *
 * Uses the real payloads from __fixtures__/ to verify the full HMAC path
 * with production-representative data — not synthetic minimal objects.
 * These tests catch regressions where the provider schema rejects shape
 * changes in GitHub's actual webhook payloads.
 */

import { computeHmac } from "@repo/console-providers";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FIXTURES_DIR = join(__dirname, "../__fixtures__");

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf-8");
}

const PUSH_FIXTURE = loadFixture("github-push.json");
const INSTALLATION_FIXTURE = loadFixture("github-installation.json");

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockWorkflowTrigger, mockEnv } = vi.hoisted(() => ({
  mockWorkflowTrigger: vi
    .fn<
      (args: {
        url: string;
        body: string;
        headers?: Record<string, string>;
      }) => Promise<{ workflowRunId: string }>
    >()
    .mockResolvedValue({ workflowRunId: "wf-fixture-1" }),
  mockEnv: {
    GITHUB_WEBHOOK_SECRET: "gh-fixture-secret",
    GATEWAY_API_KEY: "test-api-key",
    GATEWAY_WEBHOOK_SECRET: "test-webhook-secret",
    VERCEL_CLIENT_INTEGRATION_SECRET: "vc-secret",
    LINEAR_WEBHOOK_SIGNING_SECRET: "ln-secret",
    SENTRY_CLIENT_SECRET: "sn-secret",
  },
}));

vi.mock("../env", () => ({ env: mockEnv }));
vi.mock("@vendor/qstash", () => ({
  getQStashClient: () => ({ publishJSON: vi.fn().mockResolvedValue({}) }),
}));
vi.mock("@vendor/upstash", () => ({
  redis: { set: vi.fn().mockResolvedValue("OK") },
}));
vi.mock("@vendor/upstash-workflow/client", () => ({
  workflowClient: { trigger: mockWorkflowTrigger },
}));
vi.mock("@db/console/client", () => ({
  db: {
    insert: () => ({ values: () => ({ onConflictDoNothing: () => Promise.resolve() }) }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  },
}));
vi.mock("@db/console/schema", () => ({ gatewayWebhookDeliveries: {} }));

// ── App ───────────────────────────────────────────────────────────────────────

import { Hono } from "hono";
import { webhooks } from "./webhooks.js";

const app = new Hono();
app.route("/webhooks", webhooks);

function signedRequest(
  path: string,
  body: string,
  extraHeaders: Record<string, string>
) {
  const sig = computeHmac(body, mockEnv.GITHUB_WEBHOOK_SECRET, "SHA-256");
  return app.request(path, {
    method: "POST",
    headers: new Headers({
      "content-type": "application/json",
      "x-hub-signature-256": `sha256=${sig}`,
      ...extraHeaders,
    }),
    body,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GitHub webhook — fixture-based smoke tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkflowTrigger.mockResolvedValue({ workflowRunId: "wf-fixture-1" });
  });

  describe("push event", () => {
    it("accepts the full push fixture and triggers a workflow", async () => {
      const res = await signedRequest("/webhooks/github", PUSH_FIXTURE, {
        "x-github-delivery": "fixture-push-001",
        "x-github-event": "push",
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("accepted");
      expect(json.deliveryId).toBe("fixture-push-001");
      expect(mockWorkflowTrigger).toHaveBeenCalledOnce();
    });

    it("workflow receives correct provider and eventType from push fixture", async () => {
      await signedRequest("/webhooks/github", PUSH_FIXTURE, {
        "x-github-delivery": "fixture-push-002",
        "x-github-event": "push",
      });

      const call = mockWorkflowTrigger.mock.calls[0];
      const body = JSON.parse(call![0].body);

      expect(body.provider).toBe("github");
      expect(body.eventType).toBe("push");
      expect(body.deliveryId).toBe("fixture-push-002");
      expect(body.receivedAt).toBeGreaterThan(1_000_000_000_000); // ms epoch
    });

    it("extracts repository id as resourceId from push fixture", async () => {
      await signedRequest("/webhooks/github", PUSH_FIXTURE, {
        "x-github-delivery": "fixture-push-003",
        "x-github-event": "push",
      });

      const body = JSON.parse(mockWorkflowTrigger.mock.calls[0]![0].body);
      // push fixture has repository.id = 123456789
      expect(body.resourceId).toBe("123456789");
    });

    it("rejects push fixture with wrong signature", async () => {
      const badSig = computeHmac(PUSH_FIXTURE, "wrong-secret", "SHA-256");

      const res = await app.request("/webhooks/github", {
        method: "POST",
        headers: new Headers({
          "content-type": "application/json",
          "x-hub-signature-256": `sha256=${badSig}`,
          "x-github-delivery": "fixture-push-bad-sig",
          "x-github-event": "push",
        }),
        body: PUSH_FIXTURE,
      });

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "invalid_signature" });
      expect(mockWorkflowTrigger).not.toHaveBeenCalled();
    });
  });

  describe("installation event", () => {
    it("accepts the full installation fixture and triggers a workflow", async () => {
      const res = await signedRequest(
        "/webhooks/github",
        INSTALLATION_FIXTURE,
        {
          "x-github-delivery": "fixture-install-001",
          "x-github-event": "installation",
        }
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("accepted");
      expect(mockWorkflowTrigger).toHaveBeenCalledOnce();
    });

    it("workflow receives correct eventType for installation fixture", async () => {
      await signedRequest("/webhooks/github", INSTALLATION_FIXTURE, {
        "x-github-delivery": "fixture-install-002",
        "x-github-event": "installation",
      });

      const body = JSON.parse(mockWorkflowTrigger.mock.calls[0]![0].body);
      expect(body.provider).toBe("github");
      expect(body.eventType).toBe("installation");
    });
  });
});
