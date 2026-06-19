import { signServiceJWT } from "@repo/service-jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: { kind: "mock-db" },
  recordMcpAuditEvent: vi.fn(),
}));

vi.mock("@db/app", () => ({
  recordMcpAuditEvent: mocks.recordMcpAuditEvent,
}));

vi.mock("@db/app/client", () => ({
  db: mocks.db,
}));

const { handleRecordMcpAuditInternalRequest } = await import(
  "../adapters/internal/mcp-audit"
);

const originalServiceJwtSecret = process.env.SERVICE_JWT_SECRET;
const jwtSecret = "test-mcp-jwt-secret-test-mcp-jwt-secret";

async function serviceToken() {
  return signServiceJWT({
    audience: "lightfast-app",
    caller: "mcp",
    jwtSecret,
  });
}

function jsonRequest(input: { body: unknown; token?: string }) {
  return new Request("https://lightfast.localhost/api/internal/mcp/audit", {
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

describe("MCP audit internal adapter", () => {
  beforeEach(() => {
    process.env.SERVICE_JWT_SECRET = jwtSecret;
    vi.clearAllMocks();
    mocks.recordMcpAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalServiceJwtSecret === undefined) {
      delete process.env.SERVICE_JWT_SECRET;
      return;
    }
    process.env.SERVICE_JWT_SECRET = originalServiceJwtSecret;
  });

  it("rejects missing service JWTs before parsing audit events", async () => {
    const response = await handleRecordMcpAuditInternalRequest(
      jsonRequest({
        body: {
          eventName: "mcp.system.health",
          outcome: "success",
        },
      })
    );

    expect(response.status).toBe(401);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "missing_token",
    });
    expect(mocks.recordMcpAuditEvent).not.toHaveBeenCalled();
  });

  it("rejects invalid audit request bodies", async () => {
    const response = await handleRecordMcpAuditInternalRequest(
      jsonRequest({
        body: {
          eventName: "",
          outcome: "success",
        },
        token: await serviceToken(),
      })
    );

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "invalid_request",
    });
    expect(mocks.recordMcpAuditEvent).not.toHaveBeenCalled();
  });

  it("records valid audit events through app-owned persistence", async () => {
    const response = await handleRecordMcpAuditInternalRequest(
      jsonRequest({
        body: {
          clientPublicId: "mcp_client_test",
          clerkOrgId: "org_test",
          clerkUserId: "user_test",
          eventName: "mcp.system.health",
          grantPublicId: "mcp_grant_test",
          metadata: {
            contractPath: "system.health",
            latencyMs: 10,
          },
          outcome: "success",
        },
        token: await serviceToken(),
      })
    );

    expect(response.status).toBe(200);
    await expect(responseJson(response)).resolves.toEqual({ success: true });
    expect(mocks.recordMcpAuditEvent).toHaveBeenCalledWith(mocks.db, {
      clientPublicId: "mcp_client_test",
      clerkOrgId: "org_test",
      clerkUserId: "user_test",
      eventName: "mcp.system.health",
      grantPublicId: "mcp_grant_test",
      metadata: {
        contractPath: "system.health",
        latencyMs: 10,
      },
      outcome: "success",
    });
  });
});
