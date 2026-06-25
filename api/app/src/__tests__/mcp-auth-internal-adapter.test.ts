import { signServiceJWT } from "@repo/service-jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: { kind: "mock-db" },
  getMcpOauthGrantByPublicId: vi.fn(),
}));

vi.mock("@db/app", () => ({
  getMcpOauthGrantByPublicId: mocks.getMcpOauthGrantByPublicId,
}));

vi.mock("@db/app/client", () => ({
  db: mocks.db,
}));

const { handleValidateMcpGrantInternalRequest } = await import(
  "../adapters/internal/mcp-auth"
);

const originalServiceJwtSecret = process.env.SERVICE_JWT_SECRET;
const originalMcpResourceUrl = process.env.MCP_RESOURCE_URL;
const jwtSecret = "test-mcp-jwt-secret-test-mcp-jwt-secret";
const resource = "https://mcp.lightfast.localhost/mcp";

async function serviceToken(input: { caller?: "app" | "mcp" } = {}) {
  return signServiceJWT({
    audience: "lightfast-app",
    caller: input.caller ?? "mcp",
    jwtSecret,
  });
}

function jsonRequest(input: { body: unknown; token?: string }) {
  return new Request(
    "https://lightfast.localhost/api/internal/mcp/auth/validate",
    {
      body: JSON.stringify(input.body),
      headers: input.token
        ? {
            authorization: `Bearer ${input.token}`,
            "content-type": "application/json",
          }
        : { "content-type": "application/json" },
      method: "POST",
    }
  );
}

async function responseJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe("MCP auth internal adapter", () => {
  beforeEach(() => {
    process.env.SERVICE_JWT_SECRET = jwtSecret;
    process.env.MCP_RESOURCE_URL = resource;
    vi.clearAllMocks();
    mocks.getMcpOauthGrantByPublicId.mockResolvedValue({
      clientPublicId: "mcp_client_test",
      clerkOrgId: "org_test",
      clerkUserId: "user_test",
      publicId: "mcp_grant_test",
      resource,
      status: "active",
    });
  });

  afterEach(() => {
    if (originalServiceJwtSecret === undefined) {
      delete process.env.SERVICE_JWT_SECRET;
    } else {
      process.env.SERVICE_JWT_SECRET = originalServiceJwtSecret;
    }
    if (originalMcpResourceUrl === undefined) {
      delete process.env.MCP_RESOURCE_URL;
    } else {
      process.env.MCP_RESOURCE_URL = originalMcpResourceUrl;
    }
  });

  it("validates active grants bound to the token claims", async () => {
    const response = await handleValidateMcpGrantInternalRequest(
      jsonRequest({
        body: {
          clientId: "mcp_client_test",
          grantId: "mcp_grant_test",
          orgId: "org_test",
          resource,
          userId: "user_test",
        },
        token: await serviceToken(),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    await expect(responseJson(response)).resolves.toEqual({ active: true });
    expect(mocks.getMcpOauthGrantByPublicId).toHaveBeenCalledWith(mocks.db, {
      publicId: "mcp_grant_test",
    });
  });

  it("rejects invalid request bodies before loading grants", async () => {
    const response = await handleValidateMcpGrantInternalRequest(
      jsonRequest({
        body: {
          clientId: "mcp_client_test",
          grantId: "",
          orgId: "org_test",
          resource,
          userId: "user_test",
        },
        token: await serviceToken(),
      })
    );

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "invalid_request",
    });
    expect(mocks.getMcpOauthGrantByPublicId).not.toHaveBeenCalled();
  });

  it("rejects service callers other than MCP before loading grants", async () => {
    const response = await handleValidateMcpGrantInternalRequest(
      jsonRequest({
        body: {
          clientId: "mcp_client_test",
          grantId: "mcp_grant_test",
          orgId: "org_test",
          resource,
          userId: "user_test",
        },
        token: await serviceToken({ caller: "app" }),
      })
    );

    expect(response.status).toBe(403);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "disallowed_caller",
    });
    expect(mocks.getMcpOauthGrantByPublicId).not.toHaveBeenCalled();
  });

  it("rejects revoked grants", async () => {
    mocks.getMcpOauthGrantByPublicId.mockResolvedValueOnce({
      clientPublicId: "mcp_client_test",
      clerkOrgId: "org_test",
      clerkUserId: "user_test",
      publicId: "mcp_grant_test",
      resource,
      status: "revoked",
    });

    const response = await handleValidateMcpGrantInternalRequest(
      jsonRequest({
        body: {
          clientId: "mcp_client_test",
          grantId: "mcp_grant_test",
          orgId: "org_test",
          resource,
          userId: "user_test",
        },
        token: await serviceToken(),
      })
    );

    expect(response.status).toBe(403);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "mcp_grant_invalid",
    });
  });

  it("rejects grants whose stored bindings differ from token claims", async () => {
    const response = await handleValidateMcpGrantInternalRequest(
      jsonRequest({
        body: {
          clientId: "mcp_client_other",
          grantId: "mcp_grant_test",
          orgId: "org_test",
          resource,
          userId: "user_test",
        },
        token: await serviceToken(),
      })
    );

    expect(response.status).toBe(403);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "mcp_grant_invalid",
    });
  });

  it("rejects grants whose stored resource differs from the validated MCP resource", async () => {
    mocks.getMcpOauthGrantByPublicId.mockResolvedValueOnce({
      clientPublicId: "mcp_client_test",
      clerkOrgId: "org_test",
      clerkUserId: "user_test",
      publicId: "mcp_grant_test",
      resource: "https://other.lightfast.localhost/mcp",
      status: "active",
    });

    const response = await handleValidateMcpGrantInternalRequest(
      jsonRequest({
        body: {
          clientId: "mcp_client_test",
          grantId: "mcp_grant_test",
          orgId: "org_test",
          resource,
          userId: "user_test",
        },
        token: await serviceToken(),
      })
    );

    expect(response.status).toBe(403);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "mcp_grant_invalid",
    });
  });
});
