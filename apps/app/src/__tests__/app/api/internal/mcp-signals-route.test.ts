import { signServiceJWT } from "@api/app/service-jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";

const assertHostedMcpOrgAccessMock = vi.fn();
const createSignalForActorMock = vi.fn();

vi.mock("@api/app/mcp-oauth/resource-access", () => ({
  assertHostedMcpOrgAccess: assertHostedMcpOrgAccessMock,
}));

vi.mock("@api/app/signals/service", () => ({
  createSignalForActor: createSignalForActorMock,
}));

vi.mock("@db/app/client", () => ({
  db: { kind: "mock-db" },
}));

vi.mock("~/env", () => ({
  env: {
    SERVICE_JWT_SECRET: "test-service-jwt-secret-at-least-32-chars",
  },
}));

const jwtSecret = "test-service-jwt-secret-at-least-32-chars";

async function token(
  input: {
    audience?: "lightfast-app" | "lightfast-platform";
    caller?: "app" | "mcp";
  } = {}
) {
  return await signServiceJWT({
    audience: input.audience ?? "lightfast-app",
    caller: input.caller ?? "mcp",
    jwtSecret,
  });
}

function request(body: unknown, bearerToken?: string): Request {
  return new Request("https://lightfast.ai/api/internal/mcp/signals", {
    body: JSON.stringify(body),
    headers: {
      ...(bearerToken ? { authorization: `Bearer ${bearerToken}` } : {}),
      "content-type": "application/json",
    },
    method: "POST",
  });
}

describe("internal MCP signal route", () => {
  beforeEach(() => {
    assertHostedMcpOrgAccessMock.mockReset();
    assertHostedMcpOrgAccessMock.mockResolvedValue(undefined);
    createSignalForActorMock.mockReset();
  });

  it("rejects missing service bearer tokens", async () => {
    const { POST } = await import(
      "~/app/(internal)/api/internal/mcp/signals/route"
    );

    const res = await POST(request({ input: "Signal" }));

    expect(res.status).toBe(401);
    expect(createSignalForActorMock).not.toHaveBeenCalled();
  });

  it("rejects service tokens with the wrong audience", async () => {
    const { POST } = await import(
      "~/app/(internal)/api/internal/mcp/signals/route"
    );

    const res = await POST(
      request(
        { input: "Signal" },
        await token({ audience: "lightfast-platform" })
      )
    );

    expect(res.status).toBe(401);
    expect(createSignalForActorMock).not.toHaveBeenCalled();
  });

  it("rejects service callers other than mcp", async () => {
    const { POST } = await import(
      "~/app/(internal)/api/internal/mcp/signals/route"
    );

    const res = await POST(
      request({ input: "Signal" }, await token({ caller: "app" }))
    );

    expect(res.status).toBe(403);
    expect(createSignalForActorMock).not.toHaveBeenCalled();
  });

  it("rejects invalid command bodies", async () => {
    const { POST } = await import(
      "~/app/(internal)/api/internal/mcp/signals/route"
    );

    const res = await POST(request({ input: "" }, await token()));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "invalid_request",
    });
    expect(createSignalForActorMock).not.toHaveBeenCalled();
  });

  it("creates a signal with MCP attribution", async () => {
    createSignalForActorMock.mockResolvedValueOnce({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      status: "queued",
      visibilityScope: "user",
    });
    const { POST } = await import(
      "~/app/(internal)/api/internal/mcp/signals/route"
    );

    const res = await POST(
      request(
        {
          actor: {
            clientId: "mcp_client_test",
            grantId: "mcp_grant_test",
            kind: "mcp",
            orgId: "org_test",
            userId: "user_test",
          },
          input: "  Production smoke signal  ",
        },
        await token()
      )
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      status: "queued",
      visibilityScope: "user",
    });
    expect(assertHostedMcpOrgAccessMock).toHaveBeenCalledWith(
      { kind: "mock-db" },
      {
        orgId: "org_test",
        userId: "user_test",
      }
    );
    expect(createSignalForActorMock).toHaveBeenCalledWith(
      { kind: "mock-db" },
      {
        actor: {
          clientId: "mcp_client_test",
          grantId: "mcp_grant_test",
          kind: "mcp",
          orgId: "org_test",
          userId: "user_test",
        },
        input: "Production smoke signal",
      }
    );
  });

  it("maps signal queue failures to a stable command error", async () => {
    const queueError = new Error("Failed to queue signal for classification.");
    queueError.name = "SignalCreateQueueError";
    createSignalForActorMock.mockRejectedValueOnce(queueError);
    const { POST } = await import(
      "~/app/(internal)/api/internal/mcp/signals/route"
    );

    const res = await POST(
      request(
        {
          actor: {
            clientId: "mcp_client_test",
            grantId: "mcp_grant_test",
            kind: "mcp",
            orgId: "org_test",
            userId: "user_test",
          },
          input: "Production smoke signal",
        },
        await token()
      )
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "signal_enqueue_failed",
      message: "Failed to queue signal for classification.",
    });
  });

  it("rejects app-side organization access failures", async () => {
    assertHostedMcpOrgAccessMock.mockRejectedValueOnce(
      Object.assign(new Error("MCP organization is not connected."), {
        status: 403,
      })
    );
    const { POST } = await import(
      "~/app/(internal)/api/internal/mcp/signals/route"
    );

    const res = await POST(
      request(
        {
          actor: {
            clientId: "mcp_client_test",
            grantId: "mcp_grant_test",
            kind: "mcp",
            orgId: "org_test",
            userId: "user_test",
          },
          input: "Production smoke signal",
        },
        await token()
      )
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: "org_access_denied",
      message: "MCP organization is not connected.",
    });
    expect(createSignalForActorMock).not.toHaveBeenCalled();
  });
});
