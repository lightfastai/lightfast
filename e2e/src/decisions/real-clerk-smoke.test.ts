import { providerRoutineId } from "@repo/api-contract";
import { verifyServiceJWT } from "@repo/service-jwt";
import { describe, expect, it } from "vitest";

import {
  buildDecisionsSmokeConfig,
  callRuntimeDecisionThroughAppProxy,
  createUniqueDecisionsOrgSlug,
  formatCommandForError,
} from "./real-clerk-smoke";

const serviceJwtSecret = "test-service-jwt-secret-at-least-32-chars";

function appProxySuccessResponse() {
  return Response.json({
    provider: "linear",
    providerRoutineCallId: "provider_routine_call_smoke",
    providerToolName: "get_team",
    result: { marker: "get_team" },
    routineId: providerRoutineId("linear", "get_team"),
    status: "succeeded",
  });
}

describe("real Clerk Decisions smoke helpers", () => {
  it("creates stable slug-safe org names from a timestamp", () => {
    expect(
      createUniqueDecisionsOrgSlug({
        nowMs: Date.parse("2026-06-02T04:00:00.000Z"),
        prefix: "Decisions E2E!",
      })
    ).toBe("decisions-e2e-1780372800000");
  });

  it("resolves config from explicit smoke inputs", () => {
    const config = buildDecisionsSmokeConfig({
      env: {
        CLERK_SECRET_KEY: "sk_test_123",
        LIGHTFAST_E2E_AGENT_BROWSER_SESSION: "decisions-session",
        LIGHTFAST_E2E_APP_URL: "https://custom.app.lightfast.localhost/",
        LIGHTFAST_E2E_DECISIONS_EMAIL_PREFIX: "Decision Runner",
        LIGHTFAST_E2E_DECISIONS_ORG_SLUG: "lf-decisions-fixed",
        LIGHTFAST_E2E_DECISIONS_RUNTIME_CALL: "0",
        LIGHTFAST_E2E_LINEAR_MCP_ENDPOINT:
          "https://linear.lightfast.localhost/mcp",
      },
      nowMs: Date.parse("2026-06-02T04:00:00.000Z"),
    });

    expect(config).toMatchObject({
      appOrigin: "https://custom.app.lightfast.localhost",
      clerkSecretKey: "sk_test_123",
      emailAddress: "decision-runner-1780372800000@lightfast.ai",
      linearMcpEndpoint: "https://linear.lightfast.localhost/mcp",
      orgSlug: "lf-decisions-fixed",
      runtimeDecisionEnabled: false,
      sessionName: "decisions-session",
    });
  });

  it("uses the worktree Linear emulator endpoint for runtime Decision proof by default", () => {
    const config = buildDecisionsSmokeConfig({
      env: {
        CLERK_SECRET_KEY: "sk_test_123",
        SERVICE_JWT_SECRET: serviceJwtSecret,
      },
      getPortlessUrl: (name) =>
        `https://integration-call-ledger.${name}.localhost`,
      nowMs: Date.parse("2026-06-02T04:00:00.000Z"),
    });

    expect(config).toMatchObject({
      linearMcpEndpoint:
        "https://integration-call-ledger.linear.lightfast.localhost/mcp",
      runtimeDecisionEnabled: true,
      sessionName: "lightfast-decisions-smoke-1780372800000",
    });
  });

  it("requires a service JWT secret before runtime Decision proof setup starts", () => {
    expect(() =>
      buildDecisionsSmokeConfig({
        env: {
          CLERK_SECRET_KEY: "sk_test_123",
          SERVICE_JWT_SECRET: "too-short",
        },
        getPortlessUrl: (name) => `https://${name}.localhost`,
        nowMs: Date.parse("2026-06-02T04:00:00.000Z"),
      })
    ).toThrow("SERVICE_JWT_SECRET must be at least 32 characters");
  });

  it("redacts agent-browser eval scripts from command failure messages", () => {
    const formatted = formatCommandForError("agent-browser", [
      "--session",
      "smoke",
      "eval",
      "const ticket = 'secret-sign-in-ticket'",
    ]);

    expect(formatted).toContain("agent-browser --session smoke eval <script>");
    expect(formatted).not.toContain("secret-sign-in-ticket");
  });

  it("requires a Clerk secret key so smoke runs can create dev users", () => {
    expect(() =>
      buildDecisionsSmokeConfig({
        env: {},
        getPortlessUrl: (name) => `https://${name}.localhost`,
        nowMs: Date.parse("2026-06-02T04:00:00.000Z"),
      })
    ).toThrow("CLERK_SECRET_KEY");
  });

  it("calls the app-owned internal MCP proxy with service auth and routine input", async () => {
    const calls: Array<{
      init?: RequestInit;
      request: RequestInfo | URL;
    }> = [];
    const fetchFn: typeof fetch = async (request, init) => {
      calls.push({ init, request });
      return appProxySuccessResponse();
    };

    await callRuntimeDecisionThroughAppProxy({
      appOrigin: "https://app.lightfast.localhost",
      fetchFn,
      orgId: "org_123",
      serviceJwtSecret,
      timeoutMs: 5000,
      userId: "user_123",
    });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(String(call.request)).toBe(
      "https://app.lightfast.localhost/api/internal/mcp/proxy/call"
    );
    expect(call.init?.method).toBe("POST");
    expect(call.init?.signal).toBeInstanceOf(AbortSignal);

    const headers = new Headers(call.init?.headers);
    expect(headers.get("content-type")).toBe("application/json");
    const authorization = headers.get("authorization");
    expect(authorization).toMatch(/^Bearer /);
    const token = authorization!.replace(/^Bearer\s+/, "");
    await expect(
      verifyServiceJWT({
        allowedCallers: ["mcp"],
        audience: "lightfast-app",
        jwtSecret: serviceJwtSecret,
        token,
      })
    ).resolves.toEqual({
      audience: "lightfast-app",
      caller: "mcp",
    });

    expect(typeof call.init?.body).toBe("string");
    expect(JSON.parse(call.init?.body as string)).toEqual({
      actor: {
        clientId: "decisions-runtime-smoke",
        grantId: "decisions-runtime-smoke:org_123",
        kind: "mcp",
        orgId: "org_123",
        userId: "user_123",
      },
      input: {
        input: { id: "team-lightfast" },
        routineId: providerRoutineId("linear", "get_team"),
      },
      scopes: {
        providerRoutineRead: true,
        providerRoutineWrite: true,
      },
    });
  });

  it("reports non-OK app proxy responses", async () => {
    const fetchFn: typeof fetch = async () =>
      Response.json({ error: "service_not_configured" }, { status: 500 });

    await expect(
      callRuntimeDecisionThroughAppProxy({
        appOrigin: "https://app.lightfast.localhost",
        fetchFn,
        orgId: "org_123",
        serviceJwtSecret,
        userId: "user_123",
      })
    ).rejects.toThrow("Runtime Decision proof failed through app proxy");
  });

  it("rejects invalid app proxy response bodies", async () => {
    const fetchFn: typeof fetch = async () => new Response("not-json");

    await expect(
      callRuntimeDecisionThroughAppProxy({
        appOrigin: "https://app.lightfast.localhost",
        fetchFn,
        orgId: "org_123",
        serviceJwtSecret,
        userId: "user_123",
      })
    ).rejects.toThrow("invalid response");
  });

  it("times out stalled app proxy calls", async () => {
    const fetchFn: typeof fetch = async (_request, init) =>
      await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true }
        );
      });

    await expect(
      callRuntimeDecisionThroughAppProxy({
        appOrigin: "https://app.lightfast.localhost",
        fetchFn,
        orgId: "org_123",
        serviceJwtSecret,
        timeoutMs: 1,
        userId: "user_123",
      })
    ).rejects.toThrow("timed out after 1ms");
  });
});
