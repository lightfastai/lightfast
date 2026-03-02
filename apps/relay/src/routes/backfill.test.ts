import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock externals (vi.hoisted runs before vi.mock hoisting) ──

const { mockPublishJSON, mockEnv } = vi.hoisted(() => {
  const env = {
    GATEWAY_API_KEY: "test-api-key",
  };
  return {
    mockPublishJSON: vi.fn().mockResolvedValue({ messageId: "msg-1" }),
    mockEnv: env,
  };
});

vi.mock("../env", () => ({
  env: mockEnv,
  getEnv: () => mockEnv,
}));

vi.mock("@vendor/qstash", () => ({
  getQStashClient: () => ({ publishJSON: mockPublishJSON }),
  Receiver: class {
    verify() {
      return Promise.resolve(true);
    }
  },
}));

vi.mock("../lib/urls", () => ({
  backfillUrl: "https://backfill.test/api",
}));

// ── Import after mocks ──

import { Hono } from "hono";
import { backfill } from "./backfill.js";

const app = new Hono();
app.route("/api/backfill", backfill);

function request(
  path: string,
  init: {
    body?: string | Record<string, unknown>;
    headers?: Record<string, string>;
  } = {},
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

describe("POST /api/backfill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPublishJSON.mockResolvedValue({ messageId: "msg-1" });
  });

  // ── Auth ──

  it("returns 401 without X-API-Key", async () => {
    const res = await request("/api/backfill", {
      body: { installationId: "inst-1", provider: "github", orgId: "org-1" },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "unauthorized" });
  });

  it("returns 401 with wrong X-API-Key", async () => {
    const res = await request("/api/backfill", {
      body: { installationId: "inst-1", provider: "github", orgId: "org-1" },
      headers: { "X-API-Key": "wrong-key" },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "unauthorized" });
  });

  // ── Validation ──

  it("returns 400 for invalid JSON body", async () => {
    const res = await request("/api/backfill", {
      body: "not-json{",
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_json" });
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request("/api/backfill", {
      body: { installationId: "inst-1" }, // missing provider and orgId
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "validation_error" });
  });

  it("returns 400 when installationId is empty", async () => {
    const res = await request("/api/backfill", {
      body: { installationId: "", provider: "github", orgId: "org-1" },
      headers: { "X-API-Key": "test-api-key" },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "validation_error" });
  });

  // ── Success ──

  it("forwards to QStash and returns queued status", async () => {
    const res = await request("/api/backfill", {
      body: { installationId: "inst-1", provider: "github", orgId: "org-1" },
      headers: { "X-API-Key": "test-api-key" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "queued",
      installationId: "inst-1",
      provider: "github",
    });

    expect(mockPublishJSON).toHaveBeenCalledWith({
      url: "https://backfill.test/api/trigger",
      headers: { "X-API-Key": "test-api-key", "X-Correlation-Id": undefined },
      body: {
        installationId: "inst-1",
        provider: "github",
        orgId: "org-1",
        depth: 30,
        entityTypes: undefined,
      },
      retries: 3,
      deduplicationId: "backfill:github:inst-1:org-1:d=30:e=",
    });
  });

  it("forwards optional depth and entityTypes to QStash", async () => {
    const res = await request("/api/backfill", {
      body: {
        installationId: "inst-2",
        provider: "linear",
        orgId: "org-2",
        depth: 30,
        entityTypes: ["Issue", "Comment"],
      },
      headers: { "X-API-Key": "test-api-key" },
    });

    expect(res.status).toBe(200);
    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          installationId: "inst-2",
          provider: "linear",
          orgId: "org-2",
          depth: 30,
          entityTypes: ["Issue", "Comment"],
        },
      }),
    );
  });

  // ── Error ──

  it("returns 502 when QStash publish fails", async () => {
    mockPublishJSON.mockRejectedValue(new Error("QStash down"));

    const res = await request("/api/backfill", {
      body: { installationId: "inst-1", provider: "github", orgId: "org-1" },
      headers: { "X-API-Key": "test-api-key" },
    });

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "forward_failed" });
  });
});
