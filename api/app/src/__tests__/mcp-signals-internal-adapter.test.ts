import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { signServiceJWT } from "../service-jwt";

const mocks = vi.hoisted(() => ({
  assertHostedMcpOrgAccess: vi.fn(),
  createSignalForActor: vi.fn(),
  getVisibleSignalByPublicId: vi.fn(),
}));

vi.mock("@db/app", () => ({
  getVisibleSignalByPublicId: mocks.getVisibleSignalByPublicId,
}));

vi.mock("@db/app/client", () => ({
  db: {},
}));

vi.mock("../mcp-oauth/resource-access", () => ({
  assertHostedMcpOrgAccess: mocks.assertHostedMcpOrgAccess,
}));

vi.mock("../signals/service", () => ({
  createSignalForActor: mocks.createSignalForActor,
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
    expect(mocks.createSignalForActor).not.toHaveBeenCalled();
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
    expect(mocks.createSignalForActor).not.toHaveBeenCalled();
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
    expect(mocks.createSignalForActor).not.toHaveBeenCalled();
  });

  it("rejects create commands when hosted MCP org access is denied", async () => {
    const denied = Object.assign(new Error("No access to this organization."), {
      status: 403,
    });
    mocks.assertHostedMcpOrgAccess.mockRejectedValueOnce(denied);

    const response = await handleCreateMcpSignalInternalRequest(
      jsonRequest({
        body: { actor, input: "hello" },
        token: await serviceToken(),
      })
    );

    expect(response.status).toBe(403);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "org_access_denied",
      message: "No access to this organization.",
    });
    expect(mocks.createSignalForActor).not.toHaveBeenCalled();
  });

  it("rejects get commands when hosted MCP org access is denied", async () => {
    const denied = Object.assign(new Error("No access to this organization."), {
      status: 403,
    });
    mocks.assertHostedMcpOrgAccess.mockRejectedValueOnce(denied);

    const response = await handleGetMcpSignalInternalRequest(
      jsonRequest({
        body: { actor, id: invisibleSignalId },
        token: await serviceToken(),
      })
    );

    expect(response.status).toBe(403);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "org_access_denied",
      message: "No access to this organization.",
    });
    expect(mocks.getVisibleSignalByPublicId).not.toHaveBeenCalled();
  });

  it("returns not found when a requested signal is outside actor visibility", async () => {
    mocks.getVisibleSignalByPublicId.mockResolvedValueOnce(null);

    const response = await handleGetMcpSignalInternalRequest(
      jsonRequest({
        body: { actor, id: invisibleSignalId },
        token: await serviceToken(),
      })
    );

    expect(response.status).toBe(404);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "not_found",
    });
    expect(mocks.getVisibleSignalByPublicId).toHaveBeenCalledWith(
      {},
      {
        clerkOrgId: "org_1",
        createdByUserId: "user_1",
        publicId: invisibleSignalId,
      }
    );
  });
});
