import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInngestSend } = vi.hoisted(() => ({
  mockInngestSend: vi.fn().mockResolvedValue({ ids: ["evt-1"] }),
}));

vi.mock("../env", () => ({
  env: { GATEWAY_API_KEY: "test-key" },
}));

vi.mock("../inngest/client", () => ({
  inngest: { send: mockInngestSend },
}));

import { Hono } from "hono";
import { trigger } from "./trigger";

const app = new Hono();
app.route("/trigger", trigger);

function request(
  path: string,
  init: {
    method?: string;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {},
) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  return app.request(path, {
    method: init.method ?? "POST",
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
}

const validBody = {
  installationId: "inst-1",
  provider: "github",
  orgId: "org-1",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /trigger/", () => {
  it("returns 200 with valid request", async () => {
    const res = await request("/trigger", {
      body: validBody,
      headers: { "X-API-Key": "test-key" },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; installationId: string };
    expect(json.status).toBe("accepted");
    expect(json.installationId).toBe("inst-1");
  });

  it("returns 401 when X-API-Key header is missing", async () => {
    const res = await request("/trigger", { body: validBody });
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong X-API-Key value", async () => {
    const res = await request("/trigger", {
      body: validBody,
      headers: { "X-API-Key": "wrong-key" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 when installationId is missing", async () => {
    const res = await request("/trigger", {
      body: { provider: "github", orgId: "org-1" },
      headers: { "X-API-Key": "test-key" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when provider is missing", async () => {
    const res = await request("/trigger", {
      body: { installationId: "inst-1", orgId: "org-1" },
      headers: { "X-API-Key": "test-key" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when orgId is missing", async () => {
    const res = await request("/trigger", {
      body: { installationId: "inst-1", provider: "github" },
      headers: { "X-API-Key": "test-key" },
    });
    expect(res.status).toBe(400);
  });

  it('calls inngest.send with name "apps-backfill/run.requested"', async () => {
    await request("/trigger", {
      body: validBody,
      headers: { "X-API-Key": "test-key" },
    });
    expect(mockInngestSend).toHaveBeenCalledOnce();
    const call = mockInngestSend.mock.calls[0]![0];
    expect(call.name).toBe("apps-backfill/run.requested");
    expect(call.data).toMatchObject({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
    });
  });

  it("depth defaults to 30 when not provided in body", async () => {
    await request("/trigger", {
      body: validBody,
      headers: { "X-API-Key": "test-key" },
    });
    const call = mockInngestSend.mock.calls[0]![0];
    expect(call.data.depth).toBe(30);
  });

  it("custom depth: 90 passes through", async () => {
    await request("/trigger", {
      body: { ...validBody, depth: 90 },
      headers: { "X-API-Key": "test-key" },
    });
    const call = mockInngestSend.mock.calls[0]![0];
    expect(call.data.depth).toBe(90);
  });

  it('custom entityTypes: ["pull_request"] passes through', async () => {
    await request("/trigger", {
      body: { ...validBody, entityTypes: ["pull_request"] },
      headers: { "X-API-Key": "test-key" },
    });
    const call = mockInngestSend.mock.calls[0]![0];
    expect(call.data.entityTypes).toEqual(["pull_request"]);
  });

  it("inngest.send rejection → 500 response", async () => {
    mockInngestSend.mockRejectedValueOnce(new Error("inngest error"));
    const res = await request("/trigger", {
      body: validBody,
      headers: { "X-API-Key": "test-key" },
    });
    expect(res.status).toBe(500);
  });
});

describe("POST /trigger/cancel", () => {
  it("returns 200 with valid request", async () => {
    const res = await request("/trigger/cancel", {
      body: { installationId: "inst-1" },
      headers: { "X-API-Key": "test-key" },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; installationId: string };
    expect(json.status).toBe("cancelled");
    expect(json.installationId).toBe("inst-1");
  });

  it("returns 401 when X-API-Key is missing", async () => {
    const res = await request("/trigger/cancel", {
      body: { installationId: "inst-1" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong X-API-Key", async () => {
    const res = await request("/trigger/cancel", {
      body: { installationId: "inst-1" },
      headers: { "X-API-Key": "wrong" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 when installationId is missing", async () => {
    const res = await request("/trigger/cancel", {
      body: {},
      headers: { "X-API-Key": "test-key" },
    });
    expect(res.status).toBe(400);
  });

  it('calls inngest.send with name "apps-backfill/run.cancelled"', async () => {
    await request("/trigger/cancel", {
      body: { installationId: "inst-1" },
      headers: { "X-API-Key": "test-key" },
    });
    expect(mockInngestSend).toHaveBeenCalledOnce();
    const call = mockInngestSend.mock.calls[0]![0];
    expect(call.name).toBe("apps-backfill/run.cancelled");
    expect(call.data).toEqual({ installationId: "inst-1" });
  });

  it("inngest.send rejection → 500 response", async () => {
    mockInngestSend.mockRejectedValueOnce(new Error("inngest error"));
    const res = await request("/trigger/cancel", {
      body: { installationId: "inst-1" },
      headers: { "X-API-Key": "test-key" },
    });
    expect(res.status).toBe(500);
  });
});
