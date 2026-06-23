import { signServiceJWT } from "@repo/service-jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../domain/errors";

const mocks = vi.hoisted(() => ({
  assertHostedMcpOrgAccess: vi.fn(),
  createAndQueueSignal: vi.fn(),
  createSignalCommandRun: vi.fn(),
  getVisibleSignalByPublicId: vi.fn(),
  getSignalCommandRun: vi.fn(),
  isSignalCreateQueueError: vi.fn(),
  listSignalEntityLinksForSignal: vi.fn(),
}));

vi.mock("@db/app/client", () => ({
  db: {},
}));

vi.mock("@db/app", () => ({
  getVisibleSignalByPublicId: mocks.getVisibleSignalByPublicId,
  listSignalEntityLinksForSignal: mocks.listSignalEntityLinksForSignal,
}));

vi.mock("../mcp-oauth/resource-access", () => ({
  assertHostedMcpOrgAccess: mocks.assertHostedMcpOrgAccess,
}));

vi.mock("../domain/signals", () => ({
  createSignalCommand: {
    run: mocks.createSignalCommandRun,
  },
  getSignalCommand: {
    run: mocks.getSignalCommandRun,
  },
}));

vi.mock("../signals/create-signal", () => ({
  createAndQueueSignal: mocks.createAndQueueSignal,
  isSignalCreateQueueError: mocks.isSignalCreateQueueError,
}));

const {
  handleCreateMcpSignalInternalRequest,
  handleGetMcpSignalInternalRequest,
} = await import("../adapters/internal/mcp-signals");

const originalServiceJwtSecret = process.env.SERVICE_JWT_SECRET;
const jwtSecret = "test-mcp-jwt-secret-test-mcp-jwt-secret";
const invisibleSignalId = "signal_123e4567-e89b-12d3-a456-426614174000";
const actor = {
  clientId: "client_1",
  grantId: "grant_1",
  kind: "mcp" as const,
  orgId: "org_1",
  userId: "user_1",
};

async function serviceToken(
  input: { caller?: "app" | "mcp"; ttlSeconds?: number } = {}
) {
  return signServiceJWT({
    audience: "lightfast-app",
    caller: input.caller ?? "mcp",
    jwtSecret,
    ttlSeconds: input.ttlSeconds,
  });
}

function jsonRequest(input: { body: unknown; token?: string }) {
  return new Request("https://lightfast.localhost/api/internal/mcp/signals", {
    body: JSON.stringify(input.body),
    headers: input.token
      ? {
          authorization: `Bearer ${input.token}`,
          "content-type": "application/json",
        }
      : { "content-type": "application/json" },
    method: "POST",
  });
}

async function responseJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe("MCP signal internal adapter", () => {
  beforeEach(() => {
    process.env.SERVICE_JWT_SECRET = jwtSecret;
    vi.clearAllMocks();
    mocks.createSignalCommandRun.mockResolvedValue({
      id: invisibleSignalId,
      status: "queued",
      visibilityScope: "user",
    });
    mocks.getSignalCommandRun.mockResolvedValue({
      classification: null,
      createdAt: new Date("2026-05-27T01:00:00.000Z"),
      entityLinks: [],
      input: "hello",
      publicId: invisibleSignalId,
      status: "queued",
      updatedAt: new Date("2026-05-27T01:01:00.000Z"),
      visibilityScope: "user",
    });
  });

  afterEach(() => {
    if (originalServiceJwtSecret === undefined) {
      delete process.env.SERVICE_JWT_SECRET;
      return;
    }
    process.env.SERVICE_JWT_SECRET = originalServiceJwtSecret;
  });

  it("rejects missing service JWTs before parsing create commands", async () => {
    const response = await handleCreateMcpSignalInternalRequest(
      jsonRequest({ body: { actor, input: "hello" } })
    );

    expect(response.status).toBe(401);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "missing_token",
    });
    expect(mocks.assertHostedMcpOrgAccess).not.toHaveBeenCalled();
    expect(mocks.createSignalCommandRun).not.toHaveBeenCalled();
  });

  it("rejects expired service JWTs before org access checks", async () => {
    const response = await handleCreateMcpSignalInternalRequest(
      jsonRequest({
        body: { actor, input: "hello" },
        token: await serviceToken({ ttlSeconds: -1 }),
      })
    );

    expect(response.status).toBe(401);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "invalid_token",
    });
    expect(mocks.assertHostedMcpOrgAccess).not.toHaveBeenCalled();
    expect(mocks.createSignalCommandRun).not.toHaveBeenCalled();
  });

  it("rejects service JWTs from non-MCP callers", async () => {
    const response = await handleCreateMcpSignalInternalRequest(
      jsonRequest({
        body: { actor, input: "hello" },
        token: await serviceToken({ caller: "app" }),
      })
    );

    expect(response.status).toBe(403);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "disallowed_caller",
    });
    expect(mocks.assertHostedMcpOrgAccess).not.toHaveBeenCalled();
    expect(mocks.createSignalCommandRun).not.toHaveBeenCalled();
  });

  it("rejects create commands when hosted MCP org access is denied", async () => {
    const denied = Object.assign(new Error("No access to this organization."), {
      status: 403,
    });
    mocks.assertHostedMcpOrgAccess.mockRejectedValueOnce(denied);

    const response = await handleCreateMcpSignalInternalRequest(
      jsonRequest({
        body: { actor, input: "hello", scopes: ["mcp:signals:write"] },
        token: await serviceToken(),
      })
    );

    expect(response.status).toBe(403);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "org_access_denied",
      message: "No access to this organization.",
    });
    expect(mocks.createSignalCommandRun).not.toHaveBeenCalled();
  });

  it("rejects get commands when hosted MCP org access is denied", async () => {
    const denied = Object.assign(new Error("No access to this organization."), {
      status: 403,
    });
    mocks.assertHostedMcpOrgAccess.mockRejectedValueOnce(denied);

    const response = await handleGetMcpSignalInternalRequest(
      jsonRequest({
        body: { actor, id: invisibleSignalId, scopes: ["mcp:signals:read"] },
        token: await serviceToken(),
      })
    );

    expect(response.status).toBe(403);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "org_access_denied",
      message: "No access to this organization.",
    });
    expect(mocks.getSignalCommandRun).not.toHaveBeenCalled();
  });

  it("creates signals through the domain command as an apps-mcp service caller", async () => {
    const response = await handleCreateMcpSignalInternalRequest(
      jsonRequest({
        body: { actor, input: "hello", scopes: ["mcp:signals:write"] },
        token: await serviceToken(),
      })
    );

    expect(response.status).toBe(200);
    await expect(responseJson(response)).resolves.toMatchObject({
      id: invisibleSignalId,
      status: "queued",
      visibilityScope: "user",
    });
    expect(mocks.createSignalCommandRun).toHaveBeenCalledWith({
      ctx: {
        actor: {
          clientId: "client_1",
          grantId: "grant_1",
          kind: "mcpClient",
          orgId: "org_1",
          scopes: ["mcp:signals:write"],
          userId: "user_1",
        },
        caller: { kind: "service", service: "apps-mcp" },
        request: { id: expect.any(String), source: "mcp" },
      },
      deps: expect.objectContaining({
        createAndQueueSignal: expect.any(Function),
        isSignalCreateQueueError: mocks.isSignalCreateQueueError,
      }),
      input: { input: "hello" },
    });
  });

  it("gets signals through the domain command and maps public MCP output", async () => {
    const response = await handleGetMcpSignalInternalRequest(
      jsonRequest({
        body: { actor, id: invisibleSignalId, scopes: ["mcp:signals:read"] },
        token: await serviceToken(),
      })
    );

    expect(response.status).toBe(200);
    await expect(responseJson(response)).resolves.toMatchObject({
      classification: null,
      createdAt: "2026-05-27T01:00:00.000Z",
      entityLinks: [],
      id: invisibleSignalId,
      input: "hello",
      status: "queued",
      updatedAt: "2026-05-27T01:01:00.000Z",
      visibilityScope: "user",
    });
    expect(mocks.getSignalCommandRun).toHaveBeenCalledWith({
      ctx: {
        actor: {
          clientId: "client_1",
          grantId: "grant_1",
          kind: "mcpClient",
          orgId: "org_1",
          scopes: ["mcp:signals:read"],
          userId: "user_1",
        },
        caller: { kind: "service", service: "apps-mcp" },
        request: { id: expect.any(String), source: "mcp" },
      },
      deps: expect.objectContaining({
        getVisibleSignalByPublicId: expect.any(Function),
        listSignalEntityLinksForSignal: expect.any(Function),
      }),
      input: { publicId: invisibleSignalId },
    });
  });

  it("returns not found when a requested signal is outside actor visibility", async () => {
    mocks.getSignalCommandRun.mockRejectedValueOnce(
      new NotFoundError("SIGNAL_NOT_FOUND", "Signal not found.")
    );

    const response = await handleGetMcpSignalInternalRequest(
      jsonRequest({
        body: { actor, id: invisibleSignalId, scopes: ["mcp:signals:read"] },
        token: await serviceToken(),
      })
    );

    expect(response.status).toBe(404);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "not_found",
    });
    expect(mocks.getSignalCommandRun).toHaveBeenCalled();
  });
});
