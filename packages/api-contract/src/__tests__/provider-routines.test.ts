import { describe, expect, it } from "vitest";
import {
  mcpProviderRoutineCallCommandInputSchema,
  mcpProviderRoutineFindCommandInputSchema,
  parseProviderRoutineId,
  providerRoutineCallInputSchema,
  providerRoutineErrorCodeSchema,
  providerRoutineFindInputSchema,
  providerRoutineFindOutputSchema,
  providerRoutineId,
  providerRoutineIdSchema,
  providerRoutineSourceSurfaceSchema,
} from "../provider-routines";

describe("provider routine contract", () => {
  it("formats and parses provider routine ids", () => {
    const routineId = providerRoutineId("linear", "create_issue");

    expect(routineId).toBe("linear__create_issue");
    expect(parseProviderRoutineId(routineId)).toEqual({
      provider: "linear",
      providerToolName: "create_issue",
    });
    expect(providerRoutineIdSchema.parse(routineId)).toBe(routineId);
  });

  it("accepts case-preserving X provider routine ids", () => {
    const routineId = providerRoutineId("x", "getUsersByUsername");

    expect(routineId).toBe("x__getUsersByUsername");
    expect(parseProviderRoutineId(routineId)).toEqual({
      provider: "x",
      providerToolName: "getUsersByUsername",
    });
    expect(providerRoutineIdSchema.parse(routineId)).toBe(routineId);
  });

  it("preserves provider tool names containing double underscores", () => {
    expect(parseProviderRoutineId("linear__foo__bar")).toEqual({
      provider: "linear",
      providerToolName: "foo__bar",
    });
  });

  it("rejects unsupported routine ids", () => {
    expect(() => providerRoutineIdSchema.parse("foo__create_issue")).toThrow();
    expect(() => providerRoutineId("linear", "Create Issue")).toThrow();
    expect(() => parseProviderRoutineId("linear_create_issue")).toThrow();
  });

  it("accepts chat as a provider routine source surface", () => {
    expect(providerRoutineSourceSurfaceSchema.parse("chat")).toBe("chat");
  });

  it("parses compact find input", () => {
    expect(
      providerRoutineFindInputSchema.parse({
        includeSchema: true,
        limit: 5,
        provider: "linear",
        query: "create issue",
      })
    ).toEqual({
      includeSchema: true,
      limit: 5,
      provider: "linear",
      query: "create issue",
    });
  });

  it("requires proxy call input to be a JSON object", () => {
    expect(
      providerRoutineCallInputSchema.parse({
        input: { title: "Bug" },
        routineId: "linear__create_issue",
      })
    ).toEqual({
      input: { title: "Bug" },
      routineId: "linear__create_issue",
    });

    expect(() =>
      providerRoutineCallInputSchema.parse({
        input: ["not", "an", "object"],
        routineId: "linear__create_issue",
      })
    ).toThrow();
  });

  it("parses reconnect-required find warnings", () => {
    expect(
      providerRoutineFindOutputSchema.parse({
        routines: [],
        warnings: [
          {
            code: "PROVIDER_ROUTINE_RECONNECT_REQUIRED",
            message: "Reconnect Linear to enable write access.",
            provider: "linear",
            requiredScopes: ["write"],
          },
        ],
      })
    ).toEqual({
      routines: [],
      warnings: [
        {
          code: "PROVIDER_ROUTINE_RECONNECT_REQUIRED",
          message: "Reconnect Linear to enable write access.",
          provider: "linear",
          requiredScopes: ["write"],
        },
      ],
    });
  });

  it("includes reconnect-required as a provider routine error code", () => {
    expect(
      providerRoutineErrorCodeSchema.parse(
        "PROVIDER_ROUTINE_RECONNECT_REQUIRED"
      )
    ).toBe("PROVIDER_ROUTINE_RECONNECT_REQUIRED");
  });

  it("parses MCP provider routine proxy commands with actor and scope context", () => {
    expect(
      mcpProviderRoutineFindCommandInputSchema.parse({
        actor: {
          clientId: "mcp_client_test",
          grantId: "mcp_grant_test",
          kind: "mcp",
          orgId: "org_test",
          userId: "user_test",
        },
        input: {
          query: "issues",
        },
        scopes: {
          providerRoutineRead: true,
          providerRoutineWrite: false,
        },
      })
    ).toEqual({
      actor: {
        clientId: "mcp_client_test",
        grantId: "mcp_grant_test",
        kind: "mcp",
        orgId: "org_test",
        userId: "user_test",
      },
      input: {
        query: "issues",
      },
      scopes: {
        providerRoutineRead: true,
        providerRoutineWrite: false,
      },
    });

    expect(() =>
      mcpProviderRoutineCallCommandInputSchema.parse({
        actor: {
          clientId: "mcp_client_test",
          grantId: "mcp_grant_test",
          kind: "mcp",
          orgId: "org_test",
          userId: "user_test",
        },
        input: {
          input: ["not", "an", "object"],
          routineId: "linear__create_issue",
        },
        scopes: {
          providerRoutineRead: true,
          providerRoutineWrite: false,
        },
      })
    ).toThrow();
  });
});
