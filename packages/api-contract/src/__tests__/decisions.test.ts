import { describe, expect, it } from "vitest";
import {
  decisionDetailSchema,
  decisionFindInputSchema,
  decisionFindOutputSchema,
  decisionGetInputSchema,
  mcpDecisionFindCommandInputSchema,
  mcpDecisionGetCommandInputSchema,
} from "../decisions";

describe("decision contract", () => {
  it("parses compact decision find input", () => {
    expect(
      decisionFindInputSchema.parse({
        limit: 10,
        providers: ["linear"],
        query: "linear create",
        since: "2026-06-18T00:00:00.000Z",
        sourceSurfaces: ["automation"],
        statuses: ["succeeded"],
        until: "2026-06-25T00:00:00.000Z",
      })
    ).toMatchObject({
      limit: 10,
      providers: ["linear"],
      query: "linear create",
      sourceSurfaces: ["automation"],
      statuses: ["succeeded"],
    });
  });

  it("parses decision get input", () => {
    expect(
      decisionGetInputSchema.parse({
        id: "provider_routine_call_123",
      })
    ).toEqual({
      id: "provider_routine_call_123",
    });
  });

  it("parses MCP decision commands with decision read scope context", () => {
    expect(
      mcpDecisionFindCommandInputSchema.parse({
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
      })
    ).toEqual({
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

    expect(() =>
      mcpDecisionGetCommandInputSchema.parse({
        actor: {
          clientId: "mcp_client_test",
          grantId: "mcp_grant_test",
          kind: "mcp",
          orgId: "org_test",
          scopes: ["mcp:provider_routines:read"],
          userId: "user_test",
        },
        input: {
          id: "provider_routine_call_123",
        },
        scopes: {
          decisionRead: true,
        },
      })
    ).toThrow();
  });

  it("separates compact find output from detail output", () => {
    const base = {
      calledById: "automation_run_123",
      calledByKind: "automation",
      calledByUserId: null,
      classification: "write",
      createdAt: new Date("2026-06-25T00:00:00.000Z"),
      errorCode: null,
      errorMessage: null,
      finishedAt: new Date("2026-06-25T00:00:05.000Z"),
      id: "provider_routine_call_123",
      provider: "linear",
      providerToolName: "create_issue",
      routineId: "linear__create_issue",
      snippet: "Linear / Create Issue succeeded from Automation",
      sourceSurface: "automation",
      startedAt: new Date("2026-06-25T00:00:00.000Z"),
      status: "succeeded",
      title: "Create Issue",
    } as const;

    expect(
      decisionFindOutputSchema.parse({
        items: [base],
        nextCursor: null,
      })
    ).toEqual({
      items: [base],
      nextCursor: null,
    });

    expect(
      decisionDetailSchema.parse({
        ...base,
        inputRedacted: { present: true },
        outputRedacted: { present: true },
        providerActorId: "actor_123",
        providerAttempted: true,
        providerConnectionId: 42,
        providerRoutineCallId: "provider_routine_call_123",
        providerWorkspaceId: "workspace_123",
        sourceClientId: null,
        sourceRef: "automation_run_123",
        updatedAt: new Date("2026-06-25T00:00:05.000Z"),
      })
    ).toMatchObject({
      id: "provider_routine_call_123",
      providerRoutineCallId: "provider_routine_call_123",
      inputRedacted: { present: true },
    });
  });
});
