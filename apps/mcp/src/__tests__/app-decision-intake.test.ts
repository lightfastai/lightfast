import { jwtVerify } from "@vendor/jose";
import { afterEach, describe, expect, it, vi } from "vitest";

const jwtSecret = "test-service-jwt-secret-at-least-32-chars";
const decisionId = "provider_routine_call_123";
const createdAt = "2026-06-01T00:00:00.000Z";
const finishedAt = "2026-06-01T00:01:00.000Z";

async function importAdapter() {
  vi.stubEnv("APP_INTERNAL_URL", "https://app-internal.lightfast.ai");
  vi.stubEnv("MCP_AUTH_ISSUER", "https://issuer.lightfast.ai");
  vi.stubEnv("MCP_RESOURCE_URL", "https://mcp.lightfast.ai/mcp");
  vi.stubEnv("SERVICE_JWT_SECRET", jwtSecret);
  return await import("../tools/app-decision-intake");
}

const decisionContext = {
  actor: {
    orgId: "org_test",
    scopes: ["mcp:decisions:read"],
    userId: "user_test",
  },
  scopes: {
    decisionRead: true,
  },
  source: {
    clientId: "mcp_client_test",
    ref: "mcp_grant_test",
    surface: "hosted_mcp",
  },
} as const;

const decisionSummary = {
  calledById: "automation_run_123",
  calledByKind: "automation",
  calledByUserId: null,
  classification: "write",
  createdAt,
  errorCode: null,
  errorMessage: null,
  finishedAt,
  id: decisionId,
  provider: "linear",
  providerToolName: "create_issue",
  routineId: "linear__create_issue",
  snippet: "Linear / Create Issue succeeded from Automation",
  sourceSurface: "automation",
  startedAt: createdAt,
  status: "succeeded",
  title: "Create Issue",
} as const;

describe("app decision intake adapter", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("posts MCP decision find commands to the app with service auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        items: [decisionSummary],
        nextCursor: null,
      })
    );
    const { findDecisionsViaApp } = await importAdapter();

    await expect(
      findDecisionsViaApp(
        decisionContext,
        { query: "linear create" },
        { fetch: fetchMock }
      )
    ).resolves.toEqual({
      items: [
        {
          ...decisionSummary,
          createdAt: new Date(createdAt),
          finishedAt: new Date(finishedAt),
          startedAt: new Date(createdAt),
        },
      ],
      nextCursor: null,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://app-internal.lightfast.ai/api/internal/mcp/decisions/find",
      expect.objectContaining({
        method: "POST",
      })
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const authorization = (init.headers as Record<string, string>)
      .authorization;
    const bearer = authorization!.replace(/^Bearer\s+/, "");
    const { payload } = await jwtVerify(
      bearer,
      new TextEncoder().encode(jwtSecret),
      { audience: "lightfast-app" }
    );
    expect(payload).toMatchObject({
      iss: "mcp",
      token_use: "service_access",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      actor: {
        clientId: "mcp_client_test",
        grantId: "mcp_grant_test",
        kind: "mcp",
        orgId: "org_test",
        scopes: ["mcp:decisions:read"],
        userId: "user_test",
      },
      input: {
        query: "linear create",
      },
      scopes: {
        decisionRead: true,
      },
    });
  });

  it("posts MCP decision get commands to the app", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        ...decisionSummary,
        inputRedacted: { present: true },
        outputRedacted: { present: true },
        providerActorId: "actor_123",
        providerAttempted: true,
        providerConnectionId: 42,
        providerRoutineCallId: decisionId,
        providerWorkspaceId: "workspace_123",
        sourceClientId: "mcp_client_test",
        sourceRef: "mcp_grant_test",
        updatedAt: finishedAt,
      })
    );
    const { getDecisionViaApp } = await importAdapter();

    await expect(
      getDecisionViaApp(
        decisionContext,
        { id: decisionId },
        { fetch: fetchMock }
      )
    ).resolves.toMatchObject({
      id: decisionId,
      inputRedacted: { present: true },
      providerRoutineCallId: decisionId,
      updatedAt: new Date(finishedAt),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://app-internal.lightfast.ai/api/internal/mcp/decisions/get",
      expect.objectContaining({
        method: "POST",
      })
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      actor: {
        clientId: "mcp_client_test",
        grantId: "mcp_grant_test",
        kind: "mcp",
        orgId: "org_test",
        scopes: ["mcp:decisions:read"],
        userId: "user_test",
      },
      input: {
        id: decisionId,
      },
      scopes: {
        decisionRead: true,
      },
    });
  });

  it("returns undefined when the app reports a missing decision", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          error: "not_found",
          message: "Decision not found.",
        },
        { status: 404 }
      )
    );
    const { getDecisionViaApp } = await importAdapter();

    await expect(
      getDecisionViaApp(
        decisionContext,
        { id: decisionId },
        { fetch: fetchMock }
      )
    ).resolves.toBeUndefined();
  });
});
