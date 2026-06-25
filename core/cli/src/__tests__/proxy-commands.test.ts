import type { NativeSession } from "@repo/native-auth-contract";
import { NATIVE_AUTH_HEADERS } from "@repo/native-auth-contract";
import { describe, expect, it, vi } from "vitest";

import { createProgram } from "../program";

function createOutput() {
  let output = "";
  return {
    stream: {
      write(chunk: string | Uint8Array) {
        output += String(chunk);
        return true;
      },
    } as NodeJS.WritableStream,
    read: () => output,
  };
}

function session(): NativeSession {
  return {
    appUrl: "https://app.lightfast.test",
    client: "cli",
    oauth: {
      clientId: "cli_client_test",
      issuer: "https://clerk.example.com",
    },
    organization: { id: "org_1", name: "Acme", slug: "acme" },
    schemaVersion: 2,
    tokens: {
      accessToken: "access_token_test",
      expiresAt: 4_102_444_800_000,
      refreshToken: "refresh_token_test",
      tokenType: "Bearer",
    },
    user: { email: "dev@example.com", id: "user_1" },
  };
}

function store(currentSession: NativeSession | null = session()) {
  return {
    clear: vi.fn(),
    get: vi.fn(async () => currentSession),
    set: vi.fn(),
  };
}

describe("CLI proxy commands", () => {
  it("sends native auth headers and query through CLI RPC for proxy find", async () => {
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      Response.json({ ok: true, result: { routines: [] } })
    );
    const output = createOutput();

    await createProgram({
      appUrl: "https://app.lightfast.test",
      fetchImpl: fetchMock,
      stdout: output.stream,
      store: store(),
    }).parseAsync(["node", "lightfast", "proxy", "find", "create", "issue"]);

    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);

    expect(requestUrl.pathname).toBe("/api/cli/rpc");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      command: "providerRoutines.find",
      input: { query: "create issue" },
    });
    expect(headers.get("authorization")).toBe("Bearer access_token_test");
    expect(headers.get(NATIVE_AUTH_HEADERS.client)).toBe("cli");
    expect(headers.get(NATIVE_AUTH_HEADERS.organizationId)).toBe("org_1");
    expect(JSON.parse(output.read())).toEqual({ routines: [] });
  });

  it("surfaces CLI RPC error envelopes for proxy find", async () => {
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      Response.json(
        {
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Lightfast native CLI OAuth authentication required.",
          },
        },
        { status: 401 }
      )
    );

    await expect(
      createProgram({
        appUrl: "https://app.lightfast.test",
        fetchImpl: fetchMock,
        store: store(),
      }).parseAsync(["node", "lightfast", "proxy", "find", "create"])
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Lightfast native CLI OAuth authentication required.",
      name: "ProxyClientError",
      status: 401,
    });
  });

  it("sets provider and includeSchema for proxy find", async () => {
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      Response.json({ ok: true, result: { routines: [] } })
    );
    const output = createOutput();

    await createProgram({
      appUrl: "https://app.lightfast.test",
      fetchImpl: fetchMock,
      stdout: output.stream,
      store: store(),
    }).parseAsync([
      "node",
      "lightfast",
      "proxy",
      "find",
      "--provider",
      "linear",
      "--include-schema",
      "create",
      "issue",
    ]);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      command: "providerRoutines.find",
      input: {
        includeSchema: true,
        provider: "linear",
        query: "create issue",
      },
    });
  });

  it("sends routine id and JSON-object input for proxy call", async () => {
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      Response.json({
        ok: true,
        result: {
          provider: "linear",
          providerRoutineCallId: "provider_routine_call_123",
          providerToolName: "create_issue",
          result: { id: "issue_123" },
          routineId: "linear__create_issue",
          status: "succeeded",
        },
      })
    );
    const output = createOutput();

    await createProgram({
      appUrl: "https://app.lightfast.test",
      fetchImpl: fetchMock,
      stdout: output.stream,
      store: store(),
    }).parseAsync([
      "node",
      "lightfast",
      "proxy",
      "call",
      "linear__create_issue",
      "--json",
      '{"title":"Bug"}',
    ]);

    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;

    expect(requestUrl.pathname).toBe("/api/cli/rpc");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      command: "providerRoutines.call",
      input: {
        input: { title: "Bug" },
        routineId: "linear__create_issue",
      },
    });
    expect(JSON.parse(output.read())).toMatchObject({
      providerRoutineCallId: "provider_routine_call_123",
    });
  });

  it("rejects non-object proxy call JSON before sending a request", async () => {
    const fetchMock = vi.fn();

    await expect(
      createProgram({
        appUrl: "https://app.lightfast.test",
        fetchImpl: fetchMock,
        store: store(),
      }).parseAsync([
        "node",
        "lightfast",
        "proxy",
        "call",
        "linear__create_issue",
        "--json",
        "[]",
      ])
    ).rejects.toThrow("--json must be a JSON object.");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
