import type { Database } from "@db/app";
import { NATIVE_AUTH_HEADERS } from "@repo/native-auth-contract";
import {
  providerRoutineCallSuccessSchema,
  providerRoutineFindOutputSchema,
} from "@repo/provider-routine-contract";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = { kind: "mock-db" } as unknown as Database;
const resolveAuthContextFromClerk = vi.fn();
const findProviderRoutines = vi.fn();
const callProviderRoutine = vi.fn();

vi.mock("@db/app/client", () => ({ db }));

vi.mock("@api/app/auth/identity", () => ({
  resolveAuthContextFromClerk,
}));

vi.mock("@repo/provider-routines", () => ({
  callProviderRoutine,
  findProviderRoutines,
}));

function activeCliAuth() {
  return {
    access: {
      client: "cli",
      clientId: "cli_client_test",
      kind: "clerk-oauth",
      scopes: ["openid", "profile", "email"],
      userId: "user_test",
    },
    identity: {
      orgGate: { bindingStatus: "bound", setupRequirement: null },
      orgId: "org_test",
      type: "active",
      userId: "user_test",
    },
  };
}

function nativeRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("authorization", "Bearer native_access_token");
  headers.set(NATIVE_AUTH_HEADERS.client, "cli");
  headers.set(NATIVE_AUTH_HEADERS.organizationId, "org_test");
  return new Request(`https://app.test${path}`, {
    ...init,
    headers,
  });
}

describe("native proxy routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAuthContextFromClerk.mockResolvedValue(activeCliAuth());
    findProviderRoutines.mockResolvedValue({
      routines: [
        {
          classification: "write",
          provider: "linear",
          providerToolName: "create_issue",
          routineId: "linear__create_issue",
          title: "Create Issue",
        },
      ],
    });
    callProviderRoutine.mockResolvedValue({
      provider: "linear",
      providerRoutineCallId: "provider_routine_call_123",
      providerToolName: "create_issue",
      result: { id: "issue_123" },
      routineId: "linear__create_issue",
      status: "succeeded",
    });
  });

  it("returns 401 when native OAuth bearer auth is missing", async () => {
    resolveAuthContextFromClerk.mockResolvedValueOnce({
      identity: { type: "unauthenticated" },
    });

    const { GET } = await import(
      "../../../../app/(app)/(native-proxy)/api/native/proxy/routines/route"
    );
    const res = await GET(
      new Request("https://app.test/api/native/proxy/routines")
    );

    await expect(res.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Lightfast native CLI OAuth authentication required.",
      },
    });
    expect(res.status).toBe(401);
    expect(findProviderRoutines).not.toHaveBeenCalled();
  });

  it("returns 403 when the native CLI request is not bound to an organization", async () => {
    resolveAuthContextFromClerk.mockResolvedValueOnce({
      access: {
        client: "cli",
        clientId: "cli_client_test",
        kind: "clerk-oauth",
        scopes: ["openid", "profile", "email"],
        userId: "user_test",
      },
      identity: { type: "pending", userId: "user_test" },
    });

    const { GET } = await import(
      "../../../../app/(app)/(native-proxy)/api/native/proxy/routines/route"
    );
    const res = await GET(
      nativeRequest("/api/native/proxy/routines", {
        headers: {
          authorization: "Bearer native_access_token",
          [NATIVE_AUTH_HEADERS.client]: "cli",
        },
      })
    );

    await expect(res.json()).resolves.toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Lightfast native CLI organization binding required.",
      },
    });
    expect(res.status).toBe(403);
  });

  it("returns 401 when the native OAuth org header is not a membership", async () => {
    resolveAuthContextFromClerk.mockResolvedValueOnce({
      identity: { type: "unauthenticated" },
    });

    const { POST } = await import(
      "../../../../app/(app)/(native-proxy)/api/native/proxy/call/route"
    );
    const res = await POST(
      nativeRequest("/api/native/proxy/call", {
        method: "POST",
        body: JSON.stringify({
          input: { title: "Bug" },
          routineId: "linear__create_issue",
        }),
      })
    );

    await expect(res.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Lightfast native CLI OAuth authentication required.",
      },
    });
    expect(res.status).toBe(401);
    expect(callProviderRoutine).not.toHaveBeenCalled();
  });

  it("finds provider routines for active native CLI OAuth requests", async () => {
    const { GET } = await import(
      "../../../../app/(app)/(native-proxy)/api/native/proxy/routines/route"
    );
    const res = await GET(
      nativeRequest(
        "/api/native/proxy/routines?query=create&provider=linear&includeSchema=true&limit=5&readOnly=true"
      )
    );
    const json = await res.json();

    expect(providerRoutineFindOutputSchema.parse(json)).toEqual(json);
    expect(res.status).toBe(200);
    expect(findProviderRoutines).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { orgId: "org_test", userId: "user_test" },
        db,
        scopes: {
          providerRoutineRead: true,
          providerRoutineWrite: true,
        },
        source: {
          clientId: "cli_client_test",
          ref: "org_test",
          surface: "native_cli",
        },
      }),
      {
        includeSchema: true,
        limit: 5,
        provider: "linear",
        query: "create",
        readOnly: true,
      }
    );
  });

  it("calls provider routines for active native CLI OAuth requests", async () => {
    const { POST } = await import(
      "../../../../app/(app)/(native-proxy)/api/native/proxy/call/route"
    );
    const res = await POST(
      nativeRequest("/api/native/proxy/call", {
        method: "POST",
        body: JSON.stringify({
          input: { title: "Bug" },
          routineId: "linear__create_issue",
        }),
      })
    );
    const json = await res.json();

    expect(providerRoutineCallSuccessSchema.parse(json)).toEqual(json);
    expect(res.status).toBe(200);
    expect(callProviderRoutine).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { orgId: "org_test", userId: "user_test" },
        db,
        scopes: {
          providerRoutineRead: true,
          providerRoutineWrite: true,
        },
        source: {
          clientId: "cli_client_test",
          ref: "org_test",
          surface: "native_cli",
        },
      }),
      {
        input: { title: "Bug" },
        routineId: "linear__create_issue",
      }
    );
  });
});
